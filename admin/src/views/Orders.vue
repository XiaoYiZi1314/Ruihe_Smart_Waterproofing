<template>
  <div class="orders-page">
    <!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-form inline :model="filter">
        <el-form-item label="工单状态">
          <el-select v-model="filter.status" placeholder="全部" clearable style="width: 140px">
            <el-option
              v-for="(text, key) in STATUS_TEXT"
              :key="key"
              :label="text"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="filter.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filter.booking_source" placeholder="全部" clearable style="width: 140px">
            <el-option label="小程序" value="miniapp" />
            <el-option label="电话登记" value="phone" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="filter.keyword"
            placeholder="工单号/客户/电话"
            clearable
            style="width: 200px"
            @keyup.enter="loadOrders"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadOrders">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
          <el-button type="primary" @click="openRegisterDialog">电话登记</el-button>
          <el-button type="success" @click="exportOrders">
            <el-icon><Download /></el-icon>导出Excel
          </el-button>
        </el-form-item>
      </el-form>
      <div class="quick-filters">
        <span class="quick-label">快捷筛选：</span>
        <el-check-tag v-for="item in QUICK_FILTERS" :key="item.key" :checked="filter.quick === item.key" @change="toggleQuick(item.key)">
          {{ item.label }}<template v-if="item.key === 'request' && pendingRequestCount"> ({{ pendingRequestCount }})</template>
        </el-check-tag>
      </div>
    </el-card>

    <!-- 工单表格 -->
    <el-card shadow="never">
      <el-table :data="orders" v-loading="loading" stripe>
        <el-table-column prop="order_no" label="工单号" width="180" />
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="row.booking_source === 'phone' ? 'warning' : 'info'" size="small" effect="plain">
              {{ sourceText(row.booking_source) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column prop="contact_phone" label="联系电话" width="130" />
        <el-table-column prop="service_name" label="服务项目" width="140" />
        <el-table-column prop="full_address" label="地址" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ orderStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="师傅" width="100">
          <template #default="{ row }">
            {{ row.worker_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100">
          <template #default="{ row }">
            <span v-if="row.final_price" class="price">¥{{ row.final_price }}</span>
            <span v-else class="no-price">待报价</span>
          </template>
        </el-table-column>
        <el-table-column label="客户催单" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="Number(row.urge_count) > 0" type="warning" size="small">第{{ row.urge_count }}次催单</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="异常" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_exception" type="danger" size="small">异常</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="更正 / 申请" width="150" align="center">
          <template #default="{ row }">
            <el-tag v-if="Number(row.pending_requests) > 0" type="warning" size="small">待处理申请</el-tag>
            <el-tag v-if="Number(row.correction_count) > 0" type="danger" size="small" effect="plain">已更正{{ row.correction_count }}次</el-tag>
            <span v-if="!Number(row.pending_requests) && !Number(row.correction_count)">-</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="130">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="showDetail(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              link
              type="success"
              size="small"
              @click="openAssignDialog(row)"
            >
              指派
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadOrders"
          @current-change="loadOrders"
        />
      </div>
    </el-card>

    <!-- 电话登记 -->
    <el-dialog v-model="registerDialogVisible" title="电话登记工单" width="560px" destroy-on-close>
      <el-form ref="registerFormRef" :model="registerForm" :rules="registerRules" label-width="100px">
        <el-form-item label="联系人" prop="contact_name">
          <el-input v-model="registerForm.contact_name" maxlength="50" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="contact_phone">
          <el-input v-model="registerForm.contact_phone" maxlength="11" placeholder="11 位手机号" />
        </el-form-item>
        <el-form-item label="服务地址" prop="full_address">
          <el-input v-model="registerForm.full_address" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="省市区 + 门牌，至少 5 个字" />
        </el-form-item>
        <el-form-item label="服务项目" prop="service_id">
          <el-select v-model="registerForm.service_id" placeholder="请选择上架服务" filterable style="width: 100%">
            <el-option v-for="item in registerServices" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预约日期">
          <el-date-picker v-model="registerForm.appointment_date" type="date" value-format="YYYY-MM-DD" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="预约时段">
          <el-select v-model="registerForm.appointment_slot" clearable placeholder="与日期一起填写" style="width: 100%">
            <el-option v-for="slot in APPOINTMENT_SLOTS" :key="slot" :label="slot" :value="slot" />
          </el-select>
        </el-form-item>
        <el-form-item label="期望价格">
          <el-input-number v-model="registerForm.expected_price" :min="0" :precision="2" :controls="false" placeholder="可选" style="width: 100%" />
        </el-form-item>
        <el-form-item label="沟通备注">
          <el-input v-model="registerForm.remark" type="textarea" :rows="3" maxlength="2000" show-word-limit placeholder="来电诉求、漏水位置等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="registerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleRegister">确认登记</el-button>
      </template>
    </el-dialog>

    <!-- 指派弹窗 -->
    <el-dialog v-model="assignDialogVisible" title="指派工单" width="480px">
      <el-form label-width="100px">
        <el-form-item label="工单号">
          <span>{{ currentOrder?.order_no }}</span>
        </el-form-item>
        <el-form-item label="选择师傅">
          <el-select v-model="assignForm.worker_id" placeholder="请选择师傅" style="width: 100%">
            <el-option
              v-for="w in availableWorkers"
              :key="w.id"
              :label="`${w.nickname}（${w.worker_status === 'working' ? '上班中' : '休息中'}）`"
              :value="w.id"
              :disabled="w.worker_status === 'resting'"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预计上门">
          <el-date-picker
            v-model="assignForm.estimated_time"
            type="datetime"
            placeholder="选择预计上门时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAssign">确认指派</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="工单详情" size="680px">
      <template v-if="currentOrder">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="工单号">{{ currentOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ sourceText(currentOrder.booking_source) }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentOrder.status)" size="small">
              {{ orderStatusText(currentOrder) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="催单次数">{{ currentOrder.urge_count || 0 }} 次</el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentOrder.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentOrder.contact_phone }}</el-descriptions-item>
          <el-descriptions-item label="服务项目">{{ currentOrder.service_name }}</el-descriptions-item>
          <el-descriptions-item label="地址">{{ currentOrder.full_address }}</el-descriptions-item>
          <el-descriptions-item label="师傅">{{ currentOrder.worker_name || '未指派' }}</el-descriptions-item>
          <el-descriptions-item label="金额">
            {{ currentOrder.final_price ? `¥${currentOrder.final_price}` : '待报价' }}
          </el-descriptions-item>
          <el-descriptions-item label="问题描述"><span style="white-space: pre-wrap">{{ currentOrder.remark || '-' }}</span></el-descriptions-item>
          <el-descriptions-item label="期望价格">{{ currentOrder.expected_price ?? '未填写' }}</el-descriptions-item>
          <el-descriptions-item label="预计上门">{{ formatDate(currentOrder.estimated_time) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户预约">{{ currentOrder.appointment_date ? `${currentOrder.appointment_date} ${currentOrder.appointment_slot || ''}` : '-' }}</el-descriptions-item>
          <el-descriptions-item label="上门/材料/工时费">{{ currentOrder.door_fee ?? '-' }} / {{ currentOrder.material_fee ?? '-' }} / {{ currentOrder.labor_fee ?? '-' }}</el-descriptions-item>
          <el-descriptions-item v-for="(label, key) in timeFields" :key="key" :label="label">{{ formatDate(currentOrder[key]) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="现场图片">
            <el-image v-for="image in currentOrder.images || []" :key="image.id" :src="image.image_url" :preview-src-list="(currentOrder.images || []).map(i => i.image_url)" preview-teleported style="width:90px;height:90px;margin:4px" fit="cover" />
          </el-descriptions-item>
          <el-descriptions-item v-if="currentOrder.review" label="客户评价">
            <div>态度 {{ currentOrder.review.service_attitude_score }} / 质量 {{ currentOrder.review.quality_score }} / 收费 {{ currentOrder.review.price_score }}</div>
            <div>{{ currentOrder.review.comment }}</div>
            <div v-if="(currentOrder.review.images || []).length" style="margin-top:4px">
              <el-image v-for="image in currentOrder.review.images" :key="image.id" :src="image.image_url" :preview-src-list="currentOrder.review.images.map(i => i.image_url)" preview-teleported style="width:90px;height:90px;margin:4px" fit="cover" />
            </div>
            <video v-if="currentOrder.review.video_url" :src="currentOrder.review.video_url" controls style="width:100%" />
          </el-descriptions-item>
          <el-descriptions-item label="拒单理由" v-if="currentOrder.reject_reason">
            <span class="reject-reason">{{ currentOrder.reject_reason }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="价格异议" v-if="currentOrder.price_dispute_reason">
            <span class="reject-reason">{{ currentOrder.price_dispute_reason }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentOrder.created_at) }}</el-descriptions-item>
        </el-descriptions>

        <!-- 价格调整 -->
        <div class="drawer-actions" v-if="currentOrder.status === 'price_negotiating'">
          <el-button type="warning" @click="openAdjustDialog">调整价格</el-button>
        </div>

        <!-- 取消工单 -->
        <div class="drawer-actions" v-if="canCancel(currentOrder)">
          <el-button type="danger" @click="handleCancelOrder">取消工单</el-button>
        </div>

        <!-- 更正 / 改派 / 状态更正 / 操作记录 -->
        <OrderManage :key="currentOrder.id" :order="currentOrder" @changed="onOrderChanged" />
      </template>
    </el-drawer>

    <!-- 调价弹窗 -->
    <el-dialog v-model="adjustDialogVisible" title="调整价格" width="440px">
      <el-form label-width="90px">
        <el-form-item label="上门费">
          <el-input-number v-model="adjustForm.door_fee" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="材料费">
          <el-input-number v-model="adjustForm.material_fee" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="工时费">
          <el-input-number v-model="adjustForm.labor_fee" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdjust">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';
import OrderManage from '../components/order/OrderManage.vue';
import { formatDate } from '../utils/datetime';

const timeFields = { assigned_at: '指派时间', confirmed_at: '接单时间', started_at: '开始施工', completed_at: '完工时间', finished_at: '验收完成', cancelled_at: '取消时间' };
const STATUS_TEXT = {
  pending: '待指派',
  confirmed: '待接单 / 待开工',
  in_progress: '施工中',
  pending_review: '待验收',
  price_negotiating: '价格协商',
  completed: '已完成',
  cancelled: '已取消'
};

const orders = ref([]);
const loading = ref(false);
const submitting = ref(false);

const APPOINTMENT_SLOTS = ['上午 08-12', '下午 13-18', '晚上 18-20'];
const SOURCE_TEXT = { miniapp: '小程序', phone: '电话登记' };
function sourceText(source) {
  return SOURCE_TEXT[source] || '小程序';
}

const filter = reactive({
  status: '',
  keyword: '',
  quick: '',
  booking_source: '',
  dateRange: null
});

// 从「更正复盘」跳转过来时带上工单号
const route = useRoute();
if (route.query.keyword) filter.keyword = String(route.query.keyword);

const QUICK_FILTERS = [
  { key: 'unassigned', label: '超时未指派' },
  { key: 'unaccepted', label: '超时未接单' },
  { key: 'urged', label: '客户催单' },
  { key: 'dispute', label: '价格协商中' },
  { key: 'exception', label: '异常工单' },
  { key: 'request', label: '师傅变更申请' },
  { key: 'corrected', label: '已更正' }
];
const pendingRequestCount = ref(0);

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

// 指派
const assignDialogVisible = ref(false);
const currentOrder = ref(null);
const availableWorkers = ref([]);
const assignForm = reactive({
  worker_id: null,
  estimated_time: ''
});

// 调价
const adjustDialogVisible = ref(false);
const adjustForm = reactive({
  door_fee: 0,
  material_fee: 0,
  labor_fee: 0
});

// 详情
const detailVisible = ref(false);

function orderStatusText(order) {
  if (order.status === 'confirmed') return order.confirmed_at ? '已接单，待开工' : '待接单';
  return STATUS_TEXT[order.status] || order.status;
}

let disposed = false;
let listRequest = 0;
let detailRequest = 0;
let selectedDetailId = null;
let refreshTimer;

function statusTagType(status) {
  const map = {
    pending: 'warning',
    confirmed: 'primary',
    in_progress: 'success',
    pending_review: '',
    price_negotiating: 'danger',
    completed: 'info',
    cancelled: 'info'
  };
  return map[status] || 'info';
}

function canCancel(order) {
  return !['completed', 'cancelled'].includes(order.status);
}

async function loadOrders(options = {}) {
  const requestId = ++listRequest;
  if (!options.silent) loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    };
    if (filter.status) params.status = filter.status;
    if (filter.booking_source) params.booking_source = filter.booking_source;
    if (filter.keyword) params.keyword = filter.keyword;
    if (filter.quick) params.quick = filter.quick;
    if (filter.dateRange && filter.dateRange.length === 2) {
      params.start_date = filter.dateRange[0];
      params.end_date = filter.dateRange[1];
    }

    const res = await api.get('/admin/orders', { params });
    if (disposed || requestId !== listRequest) return;
    orders.value = res.data.orders || [];
    pagination.total = res.data.pagination.total || 0;
  } catch (err) {
    // 拦截器已处理
  } finally {
    if (!disposed && requestId === listRequest) loading.value = false;
  }
}

function resetFilter() {
  filter.status = '';
  filter.keyword = '';
  filter.quick = '';
  filter.booking_source = '';
  filter.dateRange = null;
  pagination.page = 1;
  loadOrders();
}

async function exportOrders() {
  const params = {};
  if (filter.keyword) params.keyword = filter.keyword;
  if (filter.quick) params.quick = filter.quick;
  if (filter.status) params.status = filter.status;
  if (filter.booking_source) params.booking_source = filter.booking_source;
  if (filter.dateRange && filter.dateRange.length === 2) {
    params.start_date = filter.dateRange[0];
    params.end_date = filter.dateRange[1];
  }

  const query = new URLSearchParams(params).toString();
  const token = localStorage.getItem('admin_token');

  try {
    const res = await fetch(`/api/admin/orders/export?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }).replaceAll('-', '')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    ElMessage.error('导出失败');
  }
}

async function loadOrderDetail(id) {
  const requestId = ++detailRequest;
  try {
    const res = await api.get(`/admin/orders/${id}`);
    if (disposed || requestId !== detailRequest || !detailVisible.value ||
        selectedDetailId !== id) return;
    currentOrder.value = res.data;
  } catch (err) {
    // 拦截器已处理
  }
}

function showDetail(row) {
  selectedDetailId = row.id;
  currentOrder.value = { ...row };
  detailVisible.value = true;
  return loadOrderDetail(row.id);
}

watch(detailVisible, visible => {
  if (!visible) {
    selectedDetailId = null;
    detailRequest += 1;
  }
});

const registerDialogVisible = ref(false);
const registerFormRef = ref();
const registerServices = ref([]);
const registerForm = reactive({
  contact_name: '',
  contact_phone: '',
  full_address: '',
  service_id: null,
  appointment_date: '',
  appointment_slot: '',
  expected_price: null,
  remark: ''
});
const registerRules = {
  contact_name: [{ required: true, message: '请填写联系人', trigger: 'blur' }],
  contact_phone: [
    { required: true, message: '请填写手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  full_address: [{ required: true, min: 5, message: '地址至少 5 个字', trigger: 'blur' }],
  service_id: [{ required: true, message: '请选择服务项目', trigger: 'change' }]
};

async function openRegisterDialog() {
  Object.assign(registerForm, {
    contact_name: '',
    contact_phone: '',
    full_address: '',
    service_id: null,
    appointment_date: '',
    appointment_slot: '',
    expected_price: null,
    remark: ''
  });
  registerDialogVisible.value = true;
  try {
    const res = await api.get('/admin/services', { params: { status: 'active', limit: 100 } });
    registerServices.value = res.data.services || [];
  } catch (err) {
    // 拦截器已处理
  }
}

async function handleRegister() {
  await registerFormRef.value.validate();
  submitting.value = true;
  try {
    const payload = {
      contact_name: registerForm.contact_name,
      contact_phone: registerForm.contact_phone,
      full_address: registerForm.full_address,
      service_id: registerForm.service_id,
      remark: registerForm.remark || undefined,
      expected_price: registerForm.expected_price || undefined,
      appointment_date: registerForm.appointment_date || undefined,
      appointment_slot: registerForm.appointment_slot || undefined
    };
    const res = await api.post('/admin/orders', payload);
    ElMessage.success(`已登记 ${res.data.order_no}`);
    registerDialogVisible.value = false;
    pagination.page = 1;
    loadOrders();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

async function openAssignDialog(row) {
  currentOrder.value = row;
  assignForm.worker_id = null;
  assignForm.estimated_time = '';

  // 加载可用师傅
  try {
    const res = await api.get('/admin/workers', { params: { limit: 100 } });
    availableWorkers.value = (res.data.workers || []).filter((w) => w.status !== 'inactive');
  } catch (err) {
    // 拦截器已处理
  }

  assignDialogVisible.value = true;
}

async function handleAssign() {
  if (!assignForm.worker_id) {
    ElMessage.warning('请选择师傅');
    return;
  }
  if (!assignForm.estimated_time) {
    ElMessage.warning('请选择预计上门时间');
    return;
  }

  submitting.value = true;
  try {
    await api.put(`/admin/orders/${currentOrder.value.id}/assign`, assignForm);
    ElMessage.success('指派成功');
    assignDialogVisible.value = false;
    loadOrders();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

function openAdjustDialog() {
  const o = currentOrder.value;
  adjustForm.door_fee = parseFloat(o.door_fee) || 0;
  adjustForm.material_fee = parseFloat(o.material_fee) || 0;
  adjustForm.labor_fee = parseFloat(o.labor_fee) || 0;
  adjustDialogVisible.value = true;
}

async function handleAdjust() {
  submitting.value = true;
  try {
    await api.put(`/admin/orders/${currentOrder.value.id}/adjust-price`, adjustForm);
    ElMessage.success('价格已调整');
    adjustDialogVisible.value = false;
    detailVisible.value = false;
    loadOrders();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

async function handleCancelOrder() {
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消工单', {
      confirmButtonText: '确认取消',
      cancelButtonText: '返回',
      inputPlaceholder: '取消原因（必填）',
      inputValidator: (v) => (v && v.trim() ? true : '取消原因不能为空')
    });

    await api.put(`/admin/orders/${currentOrder.value.id}/cancel`, { reason: value });
    ElMessage.success('工单已取消');
    detailVisible.value = false;
    loadOrders();
  } catch (err) {
    if (err !== 'cancel' && err.message !== 'cancel') {
      // 拦截器已处理
    }
  }
}

function toggleQuick(key) {
  filter.quick = filter.quick === key ? '' : key;
  pagination.page = 1;
  loadOrders();
}

async function loadPendingRequestCount() {
  try {
    const res = await api.get('/admin/change-requests', { params: { status: 'pending', limit: 1 } });
    if (!disposed) pendingRequestCount.value = res.data.pending || 0;
  } catch (err) {
    // 拦截器已处理
  }
}

// 更正 / 改派 / 状态更正 / 处理申请之后：刷新列表、详情和待处理申请数
function onOrderChanged() {
  loadOrders({ silent: true });
  if (selectedDetailId !== null) loadOrderDetail(selectedDetailId);
  loadPendingRequestCount();
}

function refreshCurrentOrders() {
  if (disposed || document.visibilityState === 'hidden') return;
  loadOrders({ silent: true });
  if (detailVisible.value && selectedDetailId !== null) loadOrderDetail(selectedDetailId);
}

onMounted(() => {
  loadOrders();
  loadPendingRequestCount();
  window.addEventListener('ruihe:orders-changed', refreshCurrentOrders);
  window.addEventListener('focus', refreshCurrentOrders);
  document.addEventListener('visibilitychange', refreshCurrentOrders);
  // Recover from missed socket messages; preserve filters, page and open detail.
  refreshTimer = window.setInterval(() => {
    if (!loading.value) refreshCurrentOrders();
  }, 15000);
});
onBeforeUnmount(() => {
  disposed = true;
  listRequest += 1;
  detailRequest += 1;
  window.clearInterval(refreshTimer);
  window.removeEventListener('ruihe:orders-changed', refreshCurrentOrders);
  window.removeEventListener('focus', refreshCurrentOrders);
  document.removeEventListener('visibilitychange', refreshCurrentOrders);
});
</script>

<style scoped>
.filter-card {
  margin-bottom: 16px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.price {
  color: #ef4444;
  font-weight: 600;
}

.no-price {
  color: #9ca3af;
  font-size: 12px;
}

.drawer-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}

.reject-reason {
  color: #ef4444;
  white-space: pre-wrap;
}

.quick-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.quick-label {
  color: #6b7280;
  font-size: 13px;
}
</style>
