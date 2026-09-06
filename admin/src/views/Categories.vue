<template>
  <div class="categories-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>服务分类</span>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>新增分类
          </el-button>
        </div>
      </template>

      <el-table :data="categories" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="分类名称" width="180" />
        <el-table-column prop="icon" label="图标" width="120">
          <template #default="{ row }">
            <el-image
              v-if="row.icon"
              :src="row.icon"
              style="width: 40px; height: 40px"
              fit="contain"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="service_count" label="服务数量" width="100" align="center" />
        <el-table-column prop="sort_order" label="排序" width="80" align="center" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
              {{ row.is_active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-button link :type="row.is_active ? 'warning' : 'success'" size="small" @click="toggle(row)">
              {{ row.is_active ? '停用' : '启用' }}
            </el-button>
            <el-popconfirm title="确定删除该分类吗？" @confirm="handleDelete(row)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑分类' : '新增分类'" width="440px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="如：屋面防水" maxlength="50" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-upload">
            <el-image
              v-if="form.icon"
              :src="form.icon"
              class="icon-preview"
              fit="contain"
            />
            <el-upload
              :show-file-list="false"
              :http-request="uploadIcon"
              accept="image/*"
            >
              <el-button size="small">{{ form.icon ? '更换图标' : '上传图标' }}</el-button>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api';

const categories = ref([]);
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editing = ref(null);
const formRef = ref();

const form = reactive({
  name: '',
  icon: '',
  sort_order: 0
});

const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
};

async function loadCategories() {
  loading.value = true;
  try {
    const res = await api.get('/admin/categories');
    categories.value = res.data.categories || [];
  } catch (err) {
    // 拦截器已处理
  } finally {
    loading.value = false;
  }
}

function openDialog(row) {
  editing.value = row || null;
  form.name = row ? row.name : '';
  form.icon = row ? row.icon : '';
  form.sort_order = row ? row.sort_order : 0;
  dialogVisible.value = true;
}

async function uploadIcon({ file }) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await api.post('/admin/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    form.icon = res.data.url;
  } catch (err) {
    ElMessage.error('图标上传失败');
  }
}

async function handleSave() {
  await formRef.value.validate();
  submitting.value = true;
  try {
    if (editing.value) {
      await api.put(`/admin/categories/${editing.value.id}`, form);
      ElMessage.success('分类已更新');
    } else {
      await api.post('/admin/categories', form);
      ElMessage.success('分类创建成功');
    }
    dialogVisible.value = false;
    loadCategories();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

async function toggle(row) {
  try {
    await api.put(`/admin/categories/${row.id}/toggle`);
    ElMessage.success('状态已切换');
    loadCategories();
  } catch (err) {
    // 拦截器已处理
  }
}

async function handleDelete(row) {
  try {
    await api.delete(`/admin/categories/${row.id}`);
    ElMessage.success('分类已删除');
    loadCategories();
  } catch (err) {
    // 拦截器已处理
  }
}

onMounted(loadCategories);
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.icon-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-preview {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
</style>
