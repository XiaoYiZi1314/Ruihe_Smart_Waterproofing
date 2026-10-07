<template>
  <div class="logs-page">
    <el-card shadow="never" class="filter-card">
      <el-form inline :model="filter">
        <el-form-item label="操作时间">
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
        <el-form-item label="操作类型">
          <el-select
            v-model="filter.action"
            placeholder="全部"
            clearable
            style="width: 180px"
          >
            <el-option
              v-for="item in ACTION_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="filter.keyword"
            placeholder="工单号 / 操作人 / 详情"
            clearable
            style="width: 220px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="user_name" label="操作人" width="120">
          <template #default="{ row }">{{ row.user_name || '系统' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="90">
          <template #default="{ row }">
            {{ ROLE_TEXT[row.user_role] || (row.user_name ? row.user_role : '系统') || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作类型" width="150">
          <template #default="{ row }">
            <el-tag size="small" :type="actionTagType(row.action)">
              {{ row.action_label || ACTION_TEXT[row.action] || '其他操作' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="order_no" label="关联工单" width="180">
          <template #default="{ row }">{{ row.order_no || '-' }}</template>
        </el-table-column>
        <el-table-column prop="detail" label="操作详情" min-width="240" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP地址" width="140">
          <template #default="{ row }">{{ row.ip || '-' }}</template>
        </el-table-column>
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
  register_order: '电话登记',
  assign: '指派工单',
  adjust_price: '调整价格',
  cancel: '取消工单',
  edit_order: '更正工单',
  reassign: '改派师傅',
  correct_status: '更正状态',
  image_add: '补充图片',
  image_remove: '删除图片',
  handle_change_request: '处理变更申请',
  create_worker: '创建师傅',
  update_worker: '编辑师傅',
  delete_worker: '停用师傅',
  update_worker_status: '切换师傅状态',
  reset_worker_password: '重置师傅密码',
  create_category: '新增分类',
  update_category: '编辑分类',
  delete_category: '删除分类',
  toggle_category: '切换分类状态',
  create_service: '新增服务',
  update_service: '编辑服务',
  delete_service: '删除服务',
  toggle_service: '上架/下架服务',
  toggle_hot: '设置热门服务',
  create_banner: '新增轮播',
  update_banner: '编辑轮播',
  delete_banner: '删除轮播',
  update_config: '更新站点配置',
  upload_image: '上传图片',
  change_password: '修改密码'
};

const ACTION_OPTIONS = ref(Object.entries(ACTION_TEXT).map(([value, label]) => ({ value, label })));

const ROLE_TEXT = {
  customer: '客户',
  worker: '师傅',
  admin: '管理员',
  system: '系统'
};

const logs = ref([]);
const loading = ref(false);

const filter = reactive({
  action: '',
  keyword: '',
  dateRange: null
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const pick = type => parts.find(part => part.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
}

function actionTagType(action) {
  const map = {
    create_order: 'primary',
    register_order: 'warning',
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

function search() {
  pagination.page = 1;
  loadLogs();
}

function resetFilter() {
  filter.action = '';
  filter.keyword = '';
  filter.dateRange = null;
  pagination.page = 1;
  loadLogs();
}

async function loadLogs() {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    };
    if (filter.action) params.action = filter.action;
    if (filter.keyword) params.keyword = filter.keyword.trim();
    if (filter.dateRange && filter.dateRange.length === 2) {
      params.start_date = filter.dateRange[0];
      params.end_date = filter.dateRange[1];
    }

    const res = await api.get('/admin/logs', { params });
    logs.value = res.data.logs || [];
    if (Array.isArray(res.data.action_options) && res.data.action_options.length) {
      ACTION_OPTIONS.value = res.data.action_options;
    }
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
.filter-card {
  margin-bottom: 16px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
