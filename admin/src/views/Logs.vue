<template>
  <div class="logs-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>操作日志</span>
          <el-select
            v-model="filter.action"
            placeholder="全部操作类型"
            clearable
            style="width: 180px"
            @change="loadLogs"
          >
            <el-option
              v-for="item in ACTION_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
      </template>

      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="操作类型" width="130">
          <template #default="{ row }">
            <el-tag size="small" :type="actionTagType(row.action)">
              {{ ACTION_TEXT[row.action] || row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="order_no" label="关联工单" width="180" />
        <el-table-column prop="user_name" label="操作人" width="120" />
        <el-table-column label="角色" width="90">
          <template #default="{ row }">
            {{ ROLE_TEXT[row.user_role] || row.user_role || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="操作详情" min-width="240" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP地址" width="130" />
        <el-table-column prop="created_at" label="操作时间" width="170" />
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import api from '../api';

const ACTION_TEXT = {
  create_order: '创建工单',
  assign: '指派工单',
  accept: '接受工单',
  reject: '拒绝工单',
  start: '开始施工',
  complete: '完工填价',
  urge: '催单',
  confirm: '确认完成',
  dispute_price: '价格异议',
  adjust_price: '调整价格',
  cancel: '取消工单',
  auto_complete: '自动完成',
  mark_exception: '标记异常',
  create_worker: '创建师傅',
  delete_worker: '删除师傅',
  review: '评价'
};

const ACTION_OPTIONS = Object.entries(ACTION_TEXT).map(([value, label]) => ({
  value,
  label
}));

const ROLE_TEXT = {
  customer: '客户',
  worker: '师傅',
  admin: '管理员',
  system: '系统'
};

const logs = ref([]);
const loading = ref(false);

const filter = reactive({
  action: ''
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

function actionTagType(action) {
  const map = {
    create_order: 'primary',
    assign: 'primary',
    accept: 'success',
    reject: 'danger',
    start: 'success',
    complete: 'success',
    urge: 'warning',
    confirm: 'success',
    dispute_price: 'danger',
    adjust_price: 'warning',
    cancel: 'danger',
    auto_complete: 'info',
    mark_exception: 'danger'
  };
  return map[action] || 'info';
}

async function loadLogs() {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    };
    if (filter.action) params.action = filter.action;

    const res = await api.get('/admin/logs', { params });
    logs.value = res.data.logs || [];
    pagination.total = res.data.pagination.total || 0;
  } catch (err) {
    // 拦截器已处理
  } finally {
    loading.value = false;
  }
}

onMounted(loadLogs);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
