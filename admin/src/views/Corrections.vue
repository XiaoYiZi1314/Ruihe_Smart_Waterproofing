<template>
  <div class="corrections-page">
    <el-card shadow="never" class="filter-card">
      <el-form inline>
        <el-form-item label="日期范围">
          <el-date-picker v-model="range" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期"
            value-format="YYYY-MM-DD" style="width: 260px" :clearable="false" @change="reloadAll" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="reloadAll">刷新</el-button>
          <el-button type="success" @click="exportLogs"><el-icon><Download /></el-icon>导出变更记录</el-button>
        </el-form-item>
      </el-form>
      <div class="hint">上方统计按工单创建日计算更正率；下方变更记录与导出按操作发生时间筛选同一区间。</div>
    </el-card>

    <el-row :gutter="16" class="stat-row" v-loading="statsLoading">
      <el-col :span="6"><el-card shadow="never"><div class="stat-label">期间工单数</div><div class="stat-value">{{ stats.totals.total_orders }}</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="never"><div class="stat-label">被更正的工单</div><div class="stat-value">{{ stats.totals.corrected_orders }}</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="never"><div class="stat-label">更正率</div><div class="stat-value" :class="{ warn: stats.totals.correction_rate >= 10 }">{{ stats.totals.correction_rate }}%</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="never"><div class="stat-label">费用被更正的工单</div><div class="stat-value">{{ stats.totals.fee_corrected_orders }}</div></el-card></el-col>
    </el-row>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="8">
        <el-card shadow="never"><template #header>更正原因</template>
          <el-table :data="stats.reasons" size="small" :show-header="false" empty-text="暂无">
            <el-table-column prop="label" /><el-table-column prop="count" width="70" align="right" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never"><template #header>被改动最多的字段</template>
          <el-table :data="stats.fields" size="small" :show-header="false" empty-text="暂无">
            <el-table-column prop="label" /><el-table-column prop="count" width="70" align="right" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never"><template #header>操作人</template>
          <el-table :data="stats.operators" size="small" :show-header="false" empty-text="暂无">
            <el-table-column prop="name" /><el-table-column prop="count" width="70" align="right" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16" class="stat-row">
      <el-col :span="12">
        <el-card shadow="never"><template #header>更正最多的服务项目（工单数）</template>
          <el-table :data="stats.services" size="small" :show-header="false" empty-text="暂无">
            <el-table-column prop="name" /><el-table-column prop="corrected_orders" width="70" align="right" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never"><template #header>更正最多的师傅（工单数）</template>
          <el-table :data="stats.workers" size="small" :show-header="false" empty-text="暂无">
            <el-table-column prop="name" /><el-table-column prop="corrected_orders" width="70" align="right" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <el-tabs v-model="tab" @tab-change="onTab">
        <el-tab-pane label="变更记录" name="logs" />
        <el-tab-pane name="requests">
          <template #label>师傅变更申请<el-badge v-if="pendingRequests" :value="pendingRequests" class="tab-badge" /></template>
        </el-tab-pane>
      </el-tabs>

      <template v-if="tab === 'logs'">
        <el-form inline>
          <el-form-item><el-input v-model="logFilter.order_no" placeholder="工单号" clearable style="width: 180px" @keyup.enter="loadLogs(1)" /></el-form-item>
          <el-form-item>
            <el-select v-model="logFilter.reason_type" placeholder="原因类型" clearable style="width: 140px" @change="loadLogs(1)">
              <el-option v-for="r in meta.reason_types" :key="r.value" :label="r.label" :value="r.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="logFilter.source" style="width: 140px" @change="loadLogs(1)">
              <el-option label="仅后台更正" value="admin_edit" /><el-option label="业务流转" value="flow" /><el-option label="系统自动" value="system" /><el-option label="全部" value="all" />
            </el-select>
          </el-form-item>
          <el-form-item><el-button @click="loadLogs(1)">查询</el-button></el-form-item>
        </el-form>
        <el-table :data="logs" v-loading="logsLoading" stripe size="small">
          <el-table-column label="时间" width="160"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column>
          <el-table-column prop="order_no" label="工单号" width="170" />
          <el-table-column prop="operator_name" label="操作人" width="100" />
          <el-table-column prop="action_label" label="操作" width="120" />
          <el-table-column label="变更内容" min-width="220">
            <template #default="{ row }">
              <span v-if="row.field_label"><b>{{ row.field_label }}</b>：<span class="old">{{ row.old_value ?? '（空）' }}</span> → <span class="new">{{ row.new_value ?? '（空）' }}</span></span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="原因" min-width="180" show-overflow-tooltip>
            <template #default="{ row }"><el-tag v-if="row.reason_label" size="small" effect="plain">{{ row.reason_label }}</el-tag> {{ row.reason_note }}</template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right"><template #default="{ row }"><el-button link type="primary" size="small" @click="openOrder(row.order_no)">查看</el-button></template></el-table-column>
        </el-table>
        <div class="pager"><el-pagination v-model:current-page="logPage" :page-size="20" :total="logTotal" layout="total, prev, pager, next" @current-change="loadLogs" /></div>
      </template>

      <template v-else>
        <el-radio-group v-model="requestStatus" size="small" style="margin-bottom: 12px" @change="loadRequests(1)">
          <el-radio-button value="pending">待处理</el-radio-button><el-radio-button value="approved">已同意</el-radio-button><el-radio-button value="rejected">已驳回</el-radio-button>
        </el-radio-group>
        <el-table :data="requests" v-loading="requestsLoading" stripe size="small" empty-text="暂无申请">
          <el-table-column label="提交时间" width="160"><template #default="{ row }">{{ formatTime(row.created_at) }}</template></el-table-column>
          <el-table-column prop="order_no" label="工单号" width="170" />
          <el-table-column prop="worker_name" label="师傅" width="100" />
          <el-table-column prop="request_label" label="类型" width="120" />
          <el-table-column prop="content" label="现场说明" min-width="220" show-overflow-tooltip />
          <el-table-column label="建议费用" width="130">
            <template #default="{ row }"><span v-if="row.proposed_door_fee != null">¥{{ (Number(row.proposed_door_fee) + Number(row.proposed_material_fee) + Number(row.proposed_labor_fee)).toFixed(2) }}</span><span v-else class="muted">—</span></template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right"><template #default="{ row }"><el-button link type="primary" size="small" @click="openOrder(row.order_no)">{{ row.status === 'pending' ? '去处理' : '查看' }}</el-button></template></el-table-column>
        </el-table>
        <div class="pager"><el-pagination v-model:current-page="requestPage" :page-size="20" :total="requestTotal" layout="total, prev, pager, next" @current-change="loadRequests" /></div>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api';

const router = useRouter();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const end = new Date();
const start = new Date(Date.now() - 29 * 86400000);
const range = ref([ymd(start), ymd(end)]);

const meta = reactive({ reason_types: [] });
const stats = reactive({ totals: { total_orders: 0, corrected_orders: 0, correction_rate: 0, fee_corrected_orders: 0 }, reasons: [], fields: [], operators: [], services: [], workers: [] });
const statsLoading = ref(false);
const tab = ref('logs');
const logs = ref([]); const logsLoading = ref(false); const logPage = ref(1); const logTotal = ref(0);
const logFilter = reactive({ order_no: '', reason_type: '', source: 'admin_edit' });
const requests = ref([]); const requestsLoading = ref(false); const requestPage = ref(1); const requestTotal = ref(0);
const requestStatus = ref('pending'); const pendingRequests = ref(0);

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
async function loadStats() {
  statsLoading.value = true;
  try {
    const res = await api.get('/admin/corrections/stats', { params: { start_date: range.value[0], end_date: range.value[1] } });
    Object.assign(stats, res.data);
  } catch (err) { /* 拦截器已处理 */ } finally { statsLoading.value = false; }
}
async function loadLogs(page = 1) {
  logPage.value = typeof page === 'number' ? page : 1;
  logsLoading.value = true;
  try {
    const params = { page: logPage.value, limit: 20, source: logFilter.source, start_date: range.value[0], end_date: range.value[1] };
    if (logFilter.order_no) params.order_no = logFilter.order_no;
    if (logFilter.reason_type) params.reason_type = logFilter.reason_type;
    const res = await api.get('/admin/corrections/logs', { params });
    logs.value = res.data.logs; logTotal.value = res.data.total;
  } catch (err) { /* 拦截器已处理 */ } finally { logsLoading.value = false; }
}
async function loadRequests(page = 1) {
  requestPage.value = typeof page === 'number' ? page : 1;
  requestsLoading.value = true;
  try {
    const res = await api.get('/admin/change-requests', { params: { status: requestStatus.value, page: requestPage.value, limit: 20 } });
    requests.value = res.data.requests; requestTotal.value = res.data.total; pendingRequests.value = res.data.pending;
  } catch (err) { /* 拦截器已处理 */ } finally { requestsLoading.value = false; }
}
function onTab(name) { if (name === 'requests') loadRequests(1); else loadLogs(1); }
function reloadAll() { loadStats(); if (tab.value === 'logs') loadLogs(1); else loadRequests(1); }
function openOrder(orderNo) { router.push({ path: '/orders', query: { keyword: orderNo } }); }
async function exportLogs() {
  const params = new URLSearchParams({ source: logFilter.source, start_date: range.value[0], end_date: range.value[1] });
  if (logFilter.order_no) params.set('order_no', logFilter.order_no);
  if (logFilter.reason_type) params.set('reason_type', logFilter.reason_type);
  try {
    const res = await fetch(`/api/admin/corrections/export?${params.toString()}`, { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } });
    if (!res.ok) throw new Error('导出失败');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `order-changes-${ymd(new Date()).replaceAll('-', '')}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  } catch (err) { ElMessage.error('导出失败'); }
}
onMounted(async () => {
  try { meta.reason_types = (await api.get('/admin/orders/edit-meta')).data.reason_types; } catch (err) { /* 拦截器已处理 */ }
  loadStats(); loadLogs(1); loadRequests(1);
});
</script>

<style scoped>
.filter-card { margin-bottom: 16px; }
.hint { color: #9ca3af; font-size: 12px; }
.stat-row { margin-bottom: 16px; }
.stat-label { color: #6b7280; font-size: 13px; }
.stat-value { font-size: 28px; font-weight: 700; margin-top: 6px; }
.stat-value.warn { color: #ef4444; }
.pager { display: flex; justify-content: flex-end; margin-top: 12px; }
.old { color: #9ca3af; text-decoration: line-through; }
.new { color: #059669; font-weight: 600; }
.muted { color: #9ca3af; }
.tab-badge { margin-left: 6px; }
</style>
