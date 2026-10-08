const db = require('../config/database');
const { nextOrderNo } = require('./orderNumber');
const ChangeLog = require('./orderChangeLog');
const { parseCalledAt, formatSqlDateTime, parseImportWorkbook } = require('./orderRegisterImport');

const BOOKING_SOURCES = { miniapp: '小程序', phone: '电话登记' };
const SLOTS = ['上午 08-12', '下午 13-18', '晚上 18-20'];

function withAppointmentLine(remark, date, slot) {
  const body = String(remark || '').split('\n').filter(line => !/^预约时间[：:]/.test(line)).join('\n');
  if (!date || !slot) return body;
  return body ? `预约时间：${date} ${slot}\n${body}` : `预约时间：${date} ${slot}`;
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function parseRegisterPayload(body = {}) {
  const contact_name = typeof body.contact_name === 'string' ? body.contact_name.trim() : '';
  if (!contact_name || Array.from(contact_name).length > 50) fail('请填写联系人姓名（1-50 个字）');
  const contact_phone = typeof body.contact_phone === 'string' ? body.contact_phone.trim() : '';
  if (!/^1[3-9]\d{9}$/.test(contact_phone)) fail('请填写正确的 11 位手机号');
  const full_address = typeof body.full_address === 'string' ? body.full_address.trim() : '';
  if (Array.from(full_address).length < 5 || Array.from(full_address).length > 500) fail('服务地址需为 5-500 个字');
  const service_id = Number(body.service_id);
  if (!Number.isInteger(service_id) || service_id <= 0) fail('请选择服务项目');
  let expected_price = null;
  if (body.expected_price != null && body.expected_price !== '') {
    const number = Number(body.expected_price);
    if (typeof body.expected_price === 'boolean' || !Number.isFinite(number) || number <= 0 || number > 9999999.99) {
      fail('期望价格必须大于 0');
    }
    expected_price = Math.round(number * 100) / 100;
  }
  const appointment_date = body.appointment_date ? String(body.appointment_date).trim().slice(0, 10) : null;
  const appointment_slot = body.appointment_slot ? String(body.appointment_slot).trim() : null;
  if (Boolean(appointment_date) !== Boolean(appointment_slot)) fail('预约日期和时段需要同时填写或同时留空');
  if (appointment_date && (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointment_date)) || !SLOTS.includes(appointment_slot))) {
    fail('预约日期或时段无效');
  }
  let remark = typeof body.remark === 'string' ? body.remark.trim() : '';
  if (remark.length > 2000) fail('备注最多 2000 字');
  remark = withAppointmentLine(remark, appointment_date, appointment_slot);
  const calledAt = parseCalledAt(body.called_at, { required: false });
  return {
    contact_name,
    contact_phone,
    full_address,
    service_id,
    expected_price,
    appointment_date: appointment_date || null,
    appointment_slot: appointment_slot || null,
    remark: remark || null,
    called_at: calledAt
  };
}

async function findOrCreateCustomer(connection, { contact_name, contact_phone }) {
  const [rows] = await connection.query(
    "SELECT id FROM users WHERE role='customer' AND phone=? AND status='active' ORDER BY id ASC LIMIT 1",
    [contact_phone]
  );
  if (rows.length) return rows[0].id;
  const openid = `phone_${contact_phone}`;
  try {
    const [result] = await connection.query(
      "INSERT INTO users (openid, phone, nickname, role) VALUES (?, ?, ?, 'customer')",
      [openid, contact_phone, contact_name]
    );
    return result.insertId;
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error;
    const [again] = await connection.query(
      "SELECT id FROM users WHERE openid=? OR (role='customer' AND phone=?) ORDER BY id ASC LIMIT 1",
      [openid, contact_phone]
    );
    if (!again.length) throw error;
    return again[0].id;
  }
}

async function insertPhoneOrder(connection, actor, payload, meta = {}) {
  const [services] = await connection.query('SELECT id, is_active FROM services WHERE id=? LIMIT 1', [payload.service_id]);
  if (!services.length) fail('服务项目不存在', 404);
  if (Number(services[0].is_active) !== 1) fail('该服务已下架，无法登记');

  const userId = await findOrCreateCustomer(connection, payload);
  const [address] = await connection.query(
    `INSERT INTO addresses (user_id, contact_name, contact_phone, detail_address, is_default)
     VALUES (?, ?, ?, ?, 0)`,
    [userId, payload.contact_name, payload.contact_phone, payload.full_address]
  );
  const calledAt = payload.called_at instanceof Date ? payload.called_at : parseCalledAt(payload.called_at);
  const orderNo = await nextOrderNo(connection, calledAt);
  const [result] = await connection.query(
    `INSERT INTO work_orders
     (order_no, user_id, service_id, address_id, contact_name, contact_phone,
      full_address, expected_price, remark, appointment_date, appointment_slot, status, booking_source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'phone', FROM_UNIXTIME(?))`,
    [orderNo, userId, payload.service_id, address.insertId, payload.contact_name, payload.contact_phone,
      payload.full_address, payload.expected_price, payload.remark, payload.appointment_date, payload.appointment_slot,
      Math.floor(calledAt.getTime() / 1000)]
  );
  const orderId = result.insertId;
  await ChangeLog.record(connection, {
    orderId,
    actor: { id: actor.id, role: 'admin', nickname: actor.nickname, username: actor.username },
    source: 'admin_edit',
    action: 'register',
    entries: [],
    ip: meta.ip
  });
  await connection.query('UPDATE services SET order_count = order_count + 1 WHERE id = ?', [payload.service_id]);
  return { id: orderId, order_no: orderNo, booking_source: 'phone', created_at: formatSqlDateTime(calledAt) };
}

async function withTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function registerPhoneOrder(actor, body, meta = {}) {
  const payload = parseRegisterPayload(body);
  return withTransaction(connection => insertPhoneOrder(connection, actor, payload, meta));
}

async function importPhoneOrders(actor, buffer, meta = {}) {
  const [services] = await db.query('SELECT id, name FROM services WHERE is_active=1 ORDER BY id');
  const parsed = await parseImportWorkbook(buffer, { services, now: new Date() });
  const payloads = [];
  for (const item of parsed.rows) {
    try {
      const payload = parseRegisterPayload({
        ...item.body,
        called_at: item.body.called_at
      });
      payload.called_at = item.body.calledAtDate;
      payload._row = item.row;
      payloads.push(payload);
    } catch (error) {
      parsed.errors.push({ row: item.row, message: error.message });
    }
  }
  if (parsed.errors.length) {
    const error = new Error(`有 ${parsed.errors.length} 行填写有误，未导入任何工单`);
    error.status = 400;
    error.errors = parsed.errors.sort((a, b) => a.row - b.row);
    throw error;
  }
  payloads.sort((a, b) => a.called_at - b.called_at || a._row - b._row);

  return withTransaction(async connection => {
    const results = [];
    for (const payload of payloads) {
      results.push(await insertPhoneOrder(connection, actor, payload, meta));
    }
    return results;
  });
}

module.exports = {
  BOOKING_SOURCES,
  parseRegisterPayload,
  registerPhoneOrder,
  importPhoneOrders
};
