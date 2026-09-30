<template>
  <div class="order-manage">
    <div v-if="order.correction_count > 0 || order.price_corrected_at" class="manage-tip">
      <el-tag type="warning" size="small">已更正 {{ order.correction_count || 0 }} 次</el-tag>
      <el-tag v-if="order.price_corrected_at" type="danger" size="small">
        费用已更正（原 ¥{{ order.price_before_correction }} → ¥{{ order.final_price }}）
      </el-tag>
    </div>

    <div class="manage-actions">
      <el-button type="primary" size="small" @click="openEdit">编辑信息 / 更正费用</el-button>
      <el-button size="small" :disabled="!canReassign" @click="openReassign">改派师傅</el-button>
      <el-button size="small" :disabled="!(order.allowed_corrections || []).length" @click="openStatus">更正状态</el-button>
      <el-button size="small" @click="openImages">现场图片</el-button>
      <el-button size="small" @click="openFollowup">写跟进</el-button>
    </div>

    <el-divider content-position="left">操作记录</el-divider>
    <div v-loading="timelineLoading" class="timeline-wrap">
      <el-empty v-if="!timelineLoading && !timeline.length" description="暂无记录" :image-size="60" />
      <el-timeline v-else>
        <el-timeline-item
          v-for="item in timeline"
          :key="item.key"
          :timestamp="`${formatTime(item.time)}${item.operator_name ? ' · ' + item.operator_name : ''}`"
          :type="item.type === 'request' ? 'warning' : item.type === 'followup' ? 'success' : item.source === 'admin_edit' ? 'danger' : 'primary'"
          placement="top"
        >
          <template v-if="item.type === 'change'">
            <div class="tl-title">
              {{ item.action_label }}
              <el-tag v-if="item.source === 'admin_edit'" size="small" type="danger" effect="plain">后台更正</el-tag>
              <el-tag v-if="item.reason_label" size="small" effect="plain">{{ item.reason_label }}</el-tag>
            </div>
            <ul v-if="item.entries.length" class="tl-entries">
              <li v-for="(entry, i) in item.entries" :key="i">
                <b>{{ entry.label }}</b>：<span class="old">{{ showValue(entry.old_value) }}</span> → <span class="new">{{ showValue(entry.new_value) }}</span>
              </li>
            </ul>
            <div v-if="item.reason_note" class="tl-note">{{ item.reason_note }}</div>
          </template>

          <template v-else-if="item.type === 'followup'">
            <div class="tl-title">
              内部跟进
              <el-tag size="small" type="success" effect="plain">{{ item.target_label }} · {{ item.channel_label }}</el-tag>
            </div>
            <div class="tl-note">{{ item.content }}</div>
            <div class="tl-sub">沟通时间：{{ formatTime(item.contacted_at) }}（仅后台可见）</div>
          </template>

          <template v-else>
            <div class="tl-title">
              师傅现场申请：{{ item.request_label }}
              <el-tag size="small" :type="requestTag(item).type">{{ requestTag(item).text }}</el-tag>
            </div>
            <div class="tl-note">{{ item.content }}</div>
            <div v-if="item.proposed_door_fee != null" class="tl-sub">
              建议费用：上门 {{ item.proposed_door_fee }} / 材料 {{ item.proposed_material_fee }} / 人工 {{ item.proposed_labor_fee }}
              （合计 ¥{{ proposedTotal(item) }}）
            </div>
            <div v-if="item.proposed_time" class="tl-sub">建议上门时间：{{ formatTime(item.proposed_time) }}</div>
            <div v-if="item.status !== 'pending'" class="tl-sub">
              {{ item.handled_by_name }} 于 {{ formatTime(item.handled_at) }} 处理{{ item.handle_note ? '：' + item.handle_note : '' }}
            </div>
            <div v-else class="tl-actions">
              <el-button v-if="canApply(item)" size="small" type="primary" @click="handleRequest(item, 'approve', true)">同意并更新工单</el-button>
              <el-button size="small" @click="handleRequest(item, 'approve', false)">仅同意（手动更正）</el-button>
              <el-button size="small" type="danger" plain @click="handleRequest(item, 'reject', false)">驳回</el-button>
            </div>
          </template>
        </el-timeline-item>
      </el-timeline>
    </div>

    <!-- 编辑信息 / 更正费用 -->
    <el-dialog v-model="editVisible" title="编辑工单信息" width="620px" :close-on-click-modal="false" append-to-body>
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
        title="所有修改都会记录修改前后的值、操作人和原因，无法撤销，请谨慎填写。" />
      <el-form label-width="96px" size="default">
        <el-divider content-position="left">客户信息</el-divider>
        <el-form-item label="联系人"><el-input v-model="form.contact_name" maxlength="50" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contact_phone" maxlength="11" /></el-form-item>
        <el-form-item label="服务地址"><el-input v-model="form.full_address" type="textarea" :rows="2" maxlength="500" /></el-form-item>
        <el-form-item label="服务项目">
          <el-select v-model="form.service_id" filterable style="width: 100%">
            <el-option v-for="s in services" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="2000" /></el-form-item>
        <el-form-item label="期望价格">
          <el-input-number v-model="form.expected_price" :min="0" :precision="2" :controls="false" style="width: 100%" placeholder="未填写" />
        </el-form-item>

        <el-divider content-position="left">预约与上门</el-divider>
        <el-form-item label="预约日期">
          <el-date-picker v-model="form.appointment_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" clearable />
        </el-form-item>
        <el-form-item label="预约时段">
          <el-select v-model="form.appointment_slot" clearable style="width: 100%">
            <el-option v-for="slot in slots" :key="slot" :label="slot" :value="slot" />
          </el-select>
        </el-form-item>
        <el-form-item label="上门时间">
          <el-date-picker v-model="form.estimated_time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" clearable />
        </el-form-item>

        <el-divider content-position="left">费用（三项需同时填写）</el-divider>
        <el-form-item label="上门费"><el-input-number v-model="form.door_fee" :min="0" :precision="2" :controls="false" style="width: 100%" /></el-form-item>
        <el-form-item label="材料费"><el-input-number v-model="form.material_fee" :min="0" :precision="2" :controls="false" style="width: 100%" /></el-form-item>
        <el-form-item label="人工费"><el-input-number v-model="form.labor_fee" :min="0" :precision="2" :controls="false" style="width: 100%" /></el-form-item>
        <el-form-item label="最终价格"><b class="total">¥{{ formTotal }}</b></el-form-item>

        <el-collapse>
          <el-collapse-item title="高级：节点时间（仅用于纠正录错的时间）" name="times">
            <el-form-item v-for="(label, key) in timeLabels" :key="key" :label="label">
              <el-date-picker v-model="form[key]" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" clearable />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>

        <el-divider content-position="left">更正原因（必填）</el-divider>
        <el-form-item label="原因类型">
          <el-select v-model="reason.type" placeholder="请选择" style="width: 100%">
            <el-option v-for="r in reasonTypes" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因说明"><el-input v-model="reason.note" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="例如：客户来电更换手机号" /></el-form-item>
      </el-form>
      <el-alert v-if="editDiffs.length" type="warning" :closable="false" style="margin-top: 8px" title="本次将修改：">
        <div v-for="d in editDiffs" :key="d.key" class="diff-line"><b>{{ d.label }}</b>：{{ showValue(d.old) }} → {{ showValue(d.new) }}</div>
      </el-alert>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!editDiffs.length" @click="submitEdit">保存修改</el-button>
      </template>
    </el-dialog>

    <!-- 改派 -->
    <el-dialog v-model="reassignVisible" title="改派师傅" width="480px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="当前师傅">{{ order.worker_name || '-' }}</el-form-item>
        <el-form-item label="新师傅">
          <el-select v-model="reassign.worker_id" placeholder="请选择" style="width: 100%">
            <el-option v-for="w in workers" :key="w.id" :label="`${w.nickname}（${w.worker_status === 'working' ? '上班中' : '休息中'}）`" :value="w.id"
              :disabled="w.worker_status !== 'working' || w.id === order.worker_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="上门时间">
          <el-date-picker v-model="reassign.estimated_time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" placeholder="不修改则留空" />
        </el-form-item>
        <el-form-item label="原因类型">
          <el-select v-model="reason.type" style="width: 100%"><el-option v-for="r in reasonTypes" :key="r.value" :label="r.label" :value="r.value" /></el-select>
        </el-form-item>
        <el-form-item label="原因说明"><el-input v-model="reason.note" type="textarea" :rows="2" maxlength="500" /></el-form-item>
        <el-alert type="info" :closable="false" title="未完工改派后，新师傅需要重新接单；施工中改派还会退回已指派并清空开工时间。原师傅、新师傅和客户都会收到站内通知。" />
      </el-form>
      <template #footer>
        <el-button @click="reassignVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReassign">确认改派</el-button>
      </template>
    </el-dialog>

    <!-- 状态更正 -->
    <el-dialog v-model="statusVisible" title="更正工单状态" width="500px" append-to-body>
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 12px"
        title="仅用于纠正误操作。状态更正不会替代正常流转，且会清空对应的时间节点。" />
      <el-form label-width="90px">
        <el-form-item label="当前状态"><b>{{ statusLabels[order.status] }}</b></el-form-item>
        <el-form-item label="更正为">
          <el-radio-group v-model="statusForm.to_status">
            <el-radio v-for="c in order.allowed_corrections || []" :key="c.to" :value="c.to" style="display: block">{{ c.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="原因类型">
          <el-select v-model="reason.type" style="width: 100%"><el-option v-for="r in reasonTypes" :key="r.value" :label="r.label" :value="r.value" /></el-select>
        </el-form-item>
        <el-form-item label="原因说明"><el-input v-model="reason.note" type="textarea" :rows="2" maxlength="500" placeholder="必填" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusVisible = false">取消</el-button>
        <el-button type="danger" :loading="saving" @click="submitStatus">确认更正</el-button>
      </template>
    </el-dialog>

    <!-- 现场图片 -->
    <el-dialog v-model="imagesVisible" title="现场图片" width="560px" append-to-body>
      <div class="image-grid">
        <div v-for="image in order.images || []" :key="image.id" class="image-item">
          <el-image :src="image.image_url" :preview-src-list="(order.images || []).map(i => i.image_url)" preview-teleported fit="cover" style="width: 100px; height: 100px" />
          <el-button link type="danger" size="small" @click="removeImage(image)">删除</el-button>
        </div>
        <el-empty v-if="!(order.images || []).length" description="暂无图片" :image-size="50" />
      </div>
      <el-divider />
      <el-upload :show-file-list="false" accept="image/*" :http-request="uploadImage">
        <el-button type="primary" size="small" :loading="saving">补充一张图片</el-button>
      </el-upload>
      <div class="tl-sub" style="margin-top: 6px">删除为软删除，记录和原文件仍会保留用于追溯；最多 9 张。</div>
    </el-dialog>

    <!-- 跟进 -->
    <el-dialog v-model="followupVisible" title="添加内部跟进" width="480px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="沟通对象">
          <el-radio-group v-model="followup.target"><el-radio v-for="t in meta.followup_targets" :key="t.value" :value="t.value">{{ t.label }}</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="沟通方式">
          <el-radio-group v-model="followup.channel"><el-radio v-for="t in meta.followup_channels" :key="t.value" :value="t.value">{{ t.label }}</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="沟通时间"><el-date-picker v-model="followup.contacted_at" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
        <el-form-item label="沟通内容"><el-input v-model="followup.content" type="textarea" :rows="4" maxlength="1000" show-word-limit /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followupVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitFollowup">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../api';

const props = defineProps({ order: { type: Object, required: true } });
const emit = defineEmits(['changed']);

const EDIT_KEYS = ['contact_name', 'contact_phone', 'full_address', 'service_id', 'remark', 'expected_price', 'appointment_date', 'appointment_slot', 'estimated_time',
  'door_fee', 'material_fee', 'labor_fee', 'confirmed_at', 'started_at', 'completed_at', 'finished_at'];
const LABELS = { contact_name: '联系人', contact_phone: '联系电话', full_address: '服务地址', service_id: '服务项目', remark: '备注', expected_price: '期望价格',
  appointment_date: '预约日期', appointment_slot: '预约时段', estimated_time: '上门时间', door_fee: '上门费', material_fee: '材料费', labor_fee: '人工费',
  confirmed_at: '接单时间', started_at: '开工时间', completed_at: '完工提交时间', finished_at: '订单完成时间' };
const FEE_KEYS = ['door_fee', 'material_fee', 'labor_fee'];
const MONEY_KEYS = ['expected_price', ...FEE_KEYS];
const TIME_KEYS = ['estimated_time', 'confirmed_at', 'started_at', 'completed_at', 'finished_at'];
const timeLabels = { confirmed_at: '接单时间', started_at: '开工时间', completed_at: '完工提交时间', finished_at: '订单完成时间' };
const REASSIGN_STATUSES = ['confirmed', 'in_progress', 'pending_review', 'price_negotiating'];

const meta = reactive({ reason_types: [], slots: [], followup_targets: [], followup_channels: [], status_labels: {} });
const reasonTypes = computed(() => meta.reason_types);
const slots = computed(() => meta.slots);
const statusLabels = computed(() => meta.status_labels);
const services = ref([]);
const workers = ref([]);
const saving = ref(false);

const timeline = ref([]);
const timelineLoading = ref(false);
let timelineSeq = 0;

const editVisible = ref(false);
const reassignVisible = ref(false);
const statusVisible = ref(false);
const imagesVisible = ref(false);
const followupVisible = ref(false);

const form = reactive({});
let snapshot = {};
let openedRevision = 0;
const reason = reactive({ type: '', note: '' });
const reassign = reactive({ worker_id: null, estimated_time: '' });
const statusForm = reactive({ to_status: '' });
const followup = reactive({ target: 'customer', channel: 'phone', content: '', contacted_at: '' });

const canReassign = computed(() => REASSIGN_STATUSES.includes(props.order.status));

function pad(n) { return String(n).padStart(2, '0'); }
function nowText() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function showValue(value) { return value === null || value === undefined || value === '' ? '（空）' : value; }
function toForm(order) {
  const values = {};
  for (const key of EDIT_KEYS) {
    let value = order[key];
    if (MONEY_KEYS.includes(key)) value = value === null || value === undefined || value === '' ? null : Number(value);
    else if (TIME_KEYS.includes(key)) value = value ? formatSeconds(value) : null;
    else if (key === 'appointment_date') value = value ? String(value).slice(0, 10) : null;
    else if (key === 'service_id') value = order.service_id;
    else value = value === undefined ? null : value;
    values[key] = value;
  }
  return values;
}
function formatSeconds(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const formTotal = computed(() => {
  if (FEE_KEYS.some(key => form[key] === null || form[key] === undefined || form[key] === '')) return '-';
  return (FEE_KEYS.reduce((sum, key) => sum + Number(form[key]), 0)).toFixed(2);
});
function same(key, a, b) {
  const empty = v => v === null || v === undefined || v === '';
  if (empty(a) && empty(b)) return true;
  if (empty(a) || empty(b)) return false;
  if (MONEY_KEYS.includes(key)) return Number(a) === Number(b);
  return String(a) === String(b);
}
const editDiffs = computed(() => {
  const list = [];
  for (const key of EDIT_KEYS) {
    if (!same(key, snapshot[key], form[key])) {
      const name = key === 'service_id' ? (id => (services.value.find(s => s.id === id) || {}).name || id) : v => v;
      list.push({ key, label: LABELS[key], old: name(snapshot[key]), new: name(form[key]) });
    }
  }
  return list;
});
function changesPayload() {
  const changes = {};
  for (const d of editDiffs.value) {
    let value = form[d.key];
    if (value === '' || value === undefined) value = null;
    changes[d.key] = value;
  }
  // 费用三项需同时提交
  if (FEE_KEYS.some(key => key in changes)) for (const key of FEE_KEYS) changes[key] = form[key];
  if ('appointment_date' in changes || 'appointment_slot' in changes) { changes.appointment_date = form.appointment_date; changes.appointment_slot = form.appointment_slot; }
  return changes;
}

async function loadMeta() {
  try {
    const res = await api.get('/admin/orders/edit-meta');
    Object.assign(meta, res.data);
  } catch (err) { /* 拦截器已处理 */ }
}
async function loadServices() {
  if (services.value.length) return;
  try {
    const res = await api.get('/admin/services', { params: { limit: 200 } });
    services.value = res.data.services || [];
  } catch (err) { /* 拦截器已处理 */ }
}
async function loadWorkers() {
  try {
    const res = await api.get('/admin/workers', { params: { limit: 100 } });
    workers.value = (res.data.workers || []).filter(w => w.status !== 'inactive');
  } catch (err) { /* 拦截器已处理 */ }
}
async function loadTimeline() {
  const seq = ++timelineSeq;
  timelineLoading.value = !timeline.value.length;
  try {
    const res = await api.get(`/admin/orders/${props.order.id}/timeline`);
    if (seq === timelineSeq) timeline.value = res.data || [];
  } catch (err) { /* 拦截器已处理 */ } finally {
    if (seq === timelineSeq) timelineLoading.value = false;
  }
}

async function openEdit() {
  await loadServices();
  snapshot = toForm(props.order);
  Object.assign(form, snapshot);
  openedRevision = props.order.revision;
  reason.type = ''; reason.note = '';
  editVisible.value = true;
}
function checkReason(noteRequired = false) {
  if (!reason.type) { ElMessage.warning('请选择更正原因'); return false; }
  if ((noteRequired || reason.type === 'other') && reason.note.trim().length < 2) { ElMessage.warning('请填写原因说明'); return false; }
  return true;
}
async function afterSave(message) {
  ElMessage.success(message);
  emit('changed');
  loadTimeline();
}
async function conflictRefresh(err) {
  if (err && err.response && err.response.status === 409) { emit('changed'); loadTimeline(); }
}
async function submitEdit() {
  if (!checkReason()) return;
  const changes = changesPayload();
  const feeChanged = FEE_KEYS.some(key => key in changes);
  if (feeChanged && reason.note.trim().length < 2) { ElMessage.warning('修改费用必须填写原因说明'); return; }
  const payload = { revision: openedRevision, reason_type: reason.type, reason_note: reason.note.trim(), changes };
  if (feeChanged && props.order.status === 'completed') {
    try {
      await ElMessageBox.confirm('该订单已完成，客户已经看到最终费用。修改后客户端会显示「费用已更正」及原金额，并通知客户和师傅。确定要更正费用吗？', '更正已完成订单的费用', {
        type: 'warning', confirmButtonText: '确认更正', cancelButtonText: '再想想' });
      payload.confirm_completed_fee = true;
    } catch (e) { return; }
  }
  saving.value = true;
  try {
    await api.put(`/admin/orders/${props.order.id}`, payload);
    editVisible.value = false;
    await afterSave('已保存');
  } catch (err) { conflictRefresh(err); } finally { saving.value = false; }
}
async function openReassign() {
  await loadWorkers();
  reassign.worker_id = null; reassign.estimated_time = '';
  reason.type = ''; reason.note = '';
  openedRevision = props.order.revision;
  reassignVisible.value = true;
}
async function submitReassign() {
  if (!reassign.worker_id) { ElMessage.warning('请选择新的师傅'); return; }
  if (!checkReason()) return;
  saving.value = true;
  try {
    await api.put(`/admin/orders/${props.order.id}/reassign`, { revision: openedRevision, worker_id: reassign.worker_id, estimated_time: reassign.estimated_time || undefined, reason_type: reason.type, reason_note: reason.note.trim() });
    reassignVisible.value = false;
    await afterSave('已改派');
  } catch (err) { conflictRefresh(err); } finally { saving.value = false; }
}
function openStatus() {
  statusForm.to_status = (props.order.allowed_corrections || [])[0]?.to || '';
  reason.type = ''; reason.note = '';
  openedRevision = props.order.revision;
  statusVisible.value = true;
}
async function submitStatus() {
  if (!statusForm.to_status) { ElMessage.warning('请选择要更正为的状态'); return; }
  if (!checkReason(true)) return;
  try {
    await ElMessageBox.confirm(`确定把状态从「${statusLabels.value[props.order.status]}」更正为「${statusLabels.value[statusForm.to_status]}」吗？`, '再次确认', { type: 'warning', confirmButtonText: '确定更正', cancelButtonText: '取消' });
  } catch (e) { return; }
  saving.value = true;
  try {
    await api.put(`/admin/orders/${props.order.id}/correct-status`, { revision: openedRevision, to_status: statusForm.to_status, reason_type: reason.type, reason_note: reason.note.trim() });
    statusVisible.value = false;
    await afterSave('状态已更正');
  } catch (err) { conflictRefresh(err); } finally { saving.value = false; }
}
function openImages() { imagesVisible.value = true; }
async function uploadImage({ file }) {
  saving.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const up = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    await api.post(`/admin/orders/${props.order.id}/images`, { revision: props.order.revision, image_url: up.data.url, reason_type: 'data_fix', reason_note: '后台补充现场图片' });
    await afterSave('图片已添加');
  } catch (err) { conflictRefresh(err); } finally { saving.value = false; }
}
async function removeImage(image) {
  let value;
  try {
    ({ value } = await ElMessageBox.prompt('请填写删除原因（必填，将记录在操作记录中）', '删除现场图片', { inputValidator: v => (v && v.trim().length >= 2 ? true : '请填写原因'), confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }));
  } catch (e) { return; }
  try {
    await api.delete(`/admin/orders/${props.order.id}/images/${image.id}`, { data: { revision: props.order.revision, reason_type: 'data_fix', reason_note: value.trim() } });
    await afterSave('图片已删除');
  } catch (err) { conflictRefresh(err); }
}
function openFollowup() {
  followup.target = 'customer'; followup.channel = 'phone'; followup.content = ''; followup.contacted_at = nowText();
  followupVisible.value = true;
}
async function submitFollowup() {
  if (followup.content.trim().length < 2) { ElMessage.warning('请填写沟通内容'); return; }
  saving.value = true;
  try {
    await api.post(`/admin/orders/${props.order.id}/followups`, { ...followup, content: followup.content.trim() });
    followupVisible.value = false;
    ElMessage.success('跟进记录已保存');
    loadTimeline();
  } catch (err) { /* 拦截器已处理 */ } finally { saving.value = false; }
}

function requestTag(item) {
  if (item.status === 'pending') return { type: 'warning', text: '待处理' };
  if (item.status === 'approved') return { type: 'success', text: item.applied ? '已同意并更新' : '已同意' };
  return { type: 'info', text: '已驳回' };
}
function canApply(item) {
  if (item.proposed_time) return true;
  if (item.proposed_door_fee != null) return props.order.status === 'pending_review';
  return false;
}
function proposedTotal(item) { return (Number(item.proposed_door_fee) + Number(item.proposed_material_fee) + Number(item.proposed_labor_fee)).toFixed(2); }
async function handleRequest(item, decision, apply) {
  let note = '';
  try {
    const { value } = await ElMessageBox.prompt(decision === 'reject' ? '请填写驳回原因（师傅会收到通知）' : '处理说明（可选，师傅会收到通知）', decision === 'reject' ? '驳回申请' : '同意申请', {
      inputValidator: v => (decision === 'reject' && !(v && v.trim().length >= 2) ? '请填写原因' : true), confirmButtonText: '确定', cancelButtonText: '取消' });
    note = (value || '').trim();
  } catch (e) { return; }
  try {
    await api.put(`/admin/change-requests/${item.id}`, { decision, apply, note });
    ElMessage.success('已处理');
    emit('changed');
    loadTimeline();
  } catch (err) { emit('changed'); loadTimeline(); }
}

watch(() => [props.order.id, props.order.revision], () => loadTimeline());
onMounted(() => { loadMeta(); loadTimeline(); });
</script>

<style scoped>
.manage-tip { display: flex; gap: 8px; margin: 12px 0 0; flex-wrap: wrap; }
.manage-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.timeline-wrap { min-height: 60px; padding: 4px 6px 0 2px; }
.tl-title { font-weight: 600; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.tl-entries { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: #374151; }
.tl-entries .old { color: #9ca3af; text-decoration: line-through; }
.tl-entries .new { color: #059669; font-weight: 600; }
.tl-note { margin-top: 6px; font-size: 13px; color: #4b5563; white-space: pre-wrap; }
.tl-sub { margin-top: 4px; font-size: 12px; color: #9ca3af; }
.tl-actions { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
.total { color: #ef4444; font-size: 18px; }
.diff-line { font-size: 13px; line-height: 1.7; }
.image-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.image-item { display: flex; flex-direction: column; align-items: center; }
</style>
