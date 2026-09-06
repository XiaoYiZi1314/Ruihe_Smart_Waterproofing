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
          <el-button type="success" @click="exportOrders">
            <el-icon><Download /></el-icon>导出Excel
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 工单表格 -->
    <el-card shadow="never">
      <el-table :data="orders" v-loading="loading" stripe>
        <el-table-column prop="order_no" label="工单号" width="180" />
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column prop="contact_phone" label="联系电话" width="130" />
        <el-table-column prop="service_name" label="服务项目" width="140" />
        <el-table-column prop="full_address" label="地址" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ STATUS_TEXT[row.status] || row.status }}
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
        <el-table-column label="异常" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_exception" type="danger" size="small">异常</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
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
    <el-drawer v-model="detailVisible" title="工单详情" size="450px">
      <template v-if="currentOrder">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="工单号">{{ currentOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(currentOrder.status)" size="small">
              {{ STATUS_TEXT[currentOrder.status] }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户">{{ currentOrder.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ currentOrder.contact_phone }}</el-descriptions-item>
          <el-descriptions-item label="服务项目">{{ currentOrder.service_name }}</el-descriptions-item>
          <el-descriptions-item label="地址">{{ currentOrder.full_address }}</el-descriptions-item>
          <el-descriptions-item label="师傅">{{ currentOrder.worker_name || '未指派' }}</el-descriptions-item>
          <el-descriptions-item label="金额">
            {{ currentOrder.final_price ? `¥${currentOrder.final_price}` : '待报价' }}
          </el-descriptions-item>
          <el-descriptions-item label="问题描述">{{ currentOrder.description || '-' }}</el-descriptions-item>
          <el-descriptions-item label="拒单理由" v-if="currentOrder.reject_reason">
            <span class="reject-reason">{{ currentOrder.reject_reason }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="价格异议" v-if="currentOrder.price_dispute_reason">
            <span class="reject-reason">{{ currentOrder.price_dispute_reason }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentOrder.created_at }}</el-descriptions-item>
        </el-descriptions>

        <!-- 价格调整 -->
        <div class="drawer-actions" v-if="currentOrder.status === 'price_negotiating'">
          <el-button type="warning" @click="openAdjustDialog">调整价格</el-button>
        </div>

        <!-- 取消工单 -->
        <div class="drawer-actions" v-if="canCancel(currentOrder)">
          <el-button type="danger" @click="handleCancelOrder">取消工单</el-button>
        </div>
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
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';

const STATUS_TEXT = {
  pending: '待指派',
  confirmed: '待接单',
  in_progress: '施工中',
  pending_review: '待验收',
  price_negotiating: '价格协商',
  completed: '已完成',
  cancelled: '已取消'
};

const orders = ref([]);
const loading = ref(false);
const submitting = ref(false);

const filter = reactive({
  status: '',
  keyword: '',
  dateRange: null
});

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

async function loadOrders() {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    };
    if (filter.status) params.status = filter.status;
    if (filter.keyword) params.keyword = filter.keyword;
    if (filter.dateRange && filter.dateRange.length === 2) {
      params.start_date = filter.dateRange[0];
      params.end_date = filter.dateRange[1];
    }

    const res = await api.get('/admin/orders', { params });
    orders.value = res.data.orders || [];
    pagination.total = res.data.pagination.total || 0;
  } catch (err) {
    // 拦截器已处理
  } finally {
    loading.value = false;
  }
}

function resetFilter() {
  filter.status = '';
  filter.keyword = '';
  filter.dateRange = null;
  pagination.page = 1;
  loadOrders();
}

async function exportOrders() {
  const params = {};
  if (filter.status) params.status = filter.status;
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
    a.download = `工单导出_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    ElMessage.error('导出失败');
  }
}

async function showDetail(row) {
  try {
    const res = await api.get(`/admin/orders/${row.id}`);
    currentOrder.value = res.data;
    detailVisible.value = true;
  } catch (err) {
    // 拦截器已处理
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

onMounted(loadOrders);
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
</style>
