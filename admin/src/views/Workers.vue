<template>
  <div class="workers-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>师傅列表</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>新增师傅
          </el-button>
        </div>
      </template>

      <el-table :data="workers" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="nickname" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="工作状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.worker_status === 'working' ? 'success' : 'info'" size="small">
              {{ row.worker_status === 'working' ? '上班中' : '休息中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="assign_count" label="指派次数" width="100" align="center" />
        <el-table-column prop="reject_count" label="拒单次数" width="100" align="center" />
        <el-table-column label="拒单率" width="140">
          <template #default="{ row }">
            <el-progress
              :percentage="parseFloat(row.reject_rate) || 0"
              :color="row.reject_rate > 20 ? '#ef4444' : '#10b981'"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button
              link
              :type="row.worker_status === 'working' ? 'warning' : 'success'"
              size="small"
              @click="toggleWorkerStatus(row)"
            >
              {{ row.worker_status === 'working' ? '设为休息' : '设为上班' }}
            </el-button>
            <el-button link type="warning" size="small" @click="resetPassword(row)">重置密码</el-button>
            <el-popconfirm title="确定停用该师傅吗？停用后该账号将无法登录（有未完成工单时不能停用）。" width="260" @confirm="handleDelete(row)">
              <template #reference>
                <el-button link type="danger" size="small">停用</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadWorkers"
          @current-change="loadWorkers"
        />
      </div>
    </el-card>

    <!-- 新增师傅弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新增师傅" width="440px">
      <el-form ref="formRef" :model="createForm" :rules="createRules" label-width="90px">
        <el-form-item label="姓名" prop="nickname">
          <el-input v-model="createForm.nickname" placeholder="师傅姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="createForm.phone" placeholder="11位手机号" maxlength="11" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑师傅弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑师傅" width="440px">
      <el-form ref="editFormRef" :model="editForm" :rules="createRules" label-width="90px">
        <el-form-item label="姓名" prop="nickname">
          <el-input v-model="editForm.nickname" placeholder="师傅姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="editForm.phone" placeholder="11位手机号" maxlength="11" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';

const workers = ref([]);
const loading = ref(false);
const submitting = ref(false);

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

const createDialogVisible = ref(false);
const formRef = ref();

// 编辑师傅
const editDialogVisible = ref(false);
const editFormRef = ref();
const editingWorker = ref(null);
const editForm = reactive({
  nickname: '',
  phone: ''
});

function openEditDialog(row) {
  editingWorker.value = row;
  editForm.nickname = row.nickname;
  editForm.phone = row.phone;
  editDialogVisible.value = true;
}

async function handleEdit() {
  await editFormRef.value.validate();
  submitting.value = true;
  try {
    await api.put(`/admin/workers/${editingWorker.value.id}`, editForm);
    ElMessage.success('师傅信息已更新');
    editDialogVisible.value = false;
    loadWorkers();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

async function toggleWorkerStatus(row) {
  const next = row.worker_status === 'working' ? 'resting' : 'working';
  try {
    await api.put(`/admin/workers/${row.id}/status`, { status: next });
    ElMessage.success(next === 'working' ? '已设为上班状态' : '已设为休息状态');
    loadWorkers();
  } catch (err) {
    // 拦截器已处理
  }
}

const createForm = reactive({
  nickname: '',
  phone: ''
});

const createRules = {
  nickname: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
};

async function loadWorkers() {
  loading.value = true;
  try {
    const res = await api.get('/admin/workers', {
      params: { page: pagination.page, limit: pagination.limit }
    });
    workers.value = res.data.workers || [];
    pagination.total = res.data.pagination.total || 0;
  } catch (err) {
    // 拦截器已处理
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  createForm.nickname = '';
  createForm.phone = '';
  createDialogVisible.value = true;
}

async function handleCreate() {
  await formRef.value.validate();
  submitting.value = true;
  try {
    const res = await api.post('/admin/workers', createForm);
    const initialPassword = res.data && res.data.initial_password;
    createDialogVisible.value = false;
    if (initialPassword) {
      showPassword('创建成功', '初始密码', initialPassword);
    } else {
      ElMessage.success('师傅创建成功');
    }
    loadWorkers();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row) {
  try {
    await api.delete(`/admin/workers/${row.id}`);
    ElMessage.success('师傅已停用');
    loadWorkers();
  } catch (err) {
    // 拦截器已处理
  }
}

async function resetPassword(row) {
  try {
    await ElMessageBox.confirm(`重置 ${row.nickname} 的密码并使旧登录失效？`, '重置密码');
    const res = await api.post(`/admin/workers/${row.id}/reset-password`);
    await showPassword('密码已重置', '临时密码', res.data.initial_password);
  } catch (error) { /* cancellation or interceptor handles failure */ }
}

// 复制文本：优先使用剪贴板 API，失败时退回 textarea + execCommand
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(input);
    return ok;
  }
}

// 展示一次性密码：提供“复制密码”，避免管理员手动抄写出错
async function showPassword(title, label, password) {
  try {
    await ElMessageBox.confirm(
      `${label}：${password}\n请通过安全渠道交给师傅，首次登录需修改密码。`,
      title,
      {
        confirmButtonText: '复制密码',
        cancelButtonText: '我已记录',
        type: 'success',
        distinguishCancelAndClose: true,
        closeOnClickModal: false
      }
    );
    const copied = await copyText(password);
    if (copied) ElMessage.success('密码已复制');
    else ElMessage.warning('复制失败，请手动记录密码');
  } catch (error) { /* 点击“我已记录”或关闭 */ }
}

onMounted(loadWorkers);
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
