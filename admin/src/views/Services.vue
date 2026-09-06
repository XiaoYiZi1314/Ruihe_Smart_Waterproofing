<template>
  <div class="services-page">
    <!-- 筛选栏 -->
    <el-card shadow="never" class="filter-card">
      <el-form inline :model="filter">
        <el-form-item label="分类">
          <el-select v-model="filter.category_id" placeholder="全部分类" clearable style="width: 160px">
            <el-option
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="已上架" value="active" />
            <el-option label="已下架" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="filter.keyword"
            placeholder="服务名称"
            clearable
            style="width: 180px"
            @keyup.enter="loadServices"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadServices">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
          <el-button type="success" @click="openDialog()">
            <el-icon><Plus /></el-icon>新增服务
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 服务列表 -->
    <el-card shadow="never">
      <el-table :data="services" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="封面" width="90">
          <template #default="{ row }">
            <el-image
              v-if="row.cover_image"
              :src="row.cover_image"
              style="width: 60px; height: 60px"
              fit="cover"
              :preview-src-list="[row.cover_image]"
              preview-teleported
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="服务名称" width="180" show-overflow-tooltip />
        <el-table-column prop="category_name" label="分类" width="120" />
        <el-table-column label="价格区间" width="150">
          <template #default="{ row }">
            <span v-if="row.price_min || row.price_max">
              ¥{{ row.price_min || 0 }} - ¥{{ row.price_max || 0 }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="热门" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.is_hot === 1"
              @change="toggleHot(row)"
              inline-prompt
            />
          </template>
        </el-table-column>
        <el-table-column label="上架" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.is_active === 1"
              @change="toggleActive(row)"
              inline-prompt
            />
          </template>
        </el-table-column>
        <el-table-column prop="order_count" label="预约数" width="90" align="center" />
        <el-table-column prop="view_count" label="浏览数" width="90" align="center" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除该服务吗？" @confirm="handleDelete(row)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
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
          @size-change="loadServices"
          @current-change="loadServices"
        />
      </div>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑服务' : '新增服务'"
      width="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="服务名称" prop="name">
          <el-input v-model="form.name" placeholder="如：屋面防水补漏" maxlength="100" />
        </el-form-item>
        <el-form-item label="所属分类" prop="category_id">
          <el-select v-model="form.category_id" placeholder="请选择分类" style="width: 100%">
            <el-option
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id"
              :disabled="!c.is_active"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="服务描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="服务的详细介绍..."
            maxlength="1000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="价格区间">
          <div class="price-range">
            <el-input-number v-model="form.price_min" :min="0" :precision="2" placeholder="最低价" />
            <span class="price-sep">至</span>
            <el-input-number v-model="form.price_max" :min="0" :precision="2" placeholder="最高价" />
            <el-input v-model="form.price_unit" class="price-unit" placeholder="单位" />
          </div>
        </el-form-item>
        <el-form-item label="封面图">
          <div class="cover-upload">
            <el-image
              v-if="form.cover_image"
              :src="form.cover_image"
              class="cover-preview"
              fit="cover"
            />
            <el-upload
              :show-file-list="false"
              :http-request="uploadCover"
              accept="image/*"
            >
              <el-button size="small">{{ form.cover_image ? '更换封面' : '上传封面' }}</el-button>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="热门">
          <el-switch v-model="form.is_hot" />
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
const services = ref([]);
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const editing = ref(null);
const formRef = ref();

const filter = reactive({
  category_id: '',
  status: '',
  keyword: ''
});

const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

const defaultForm = {
  name: '',
  category_id: null,
  description: '',
  cover_image: '',
  price_min: null,
  price_max: null,
  price_unit: '元',
  is_hot: false,
  sort_order: 0
};

const form = reactive({ ...defaultForm });

const rules = {
  name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }]
};

async function loadCategories() {
  try {
    const res = await api.get('/admin/categories');
    categories.value = res.data.categories || [];
  } catch (err) {
    // 拦截器已处理
  }
}

async function loadServices() {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    };
    if (filter.category_id) params.category_id = filter.category_id;
    if (filter.status) params.status = filter.status;
    if (filter.keyword) params.keyword = filter.keyword;

    const res = await api.get('/admin/services', { params });
    services.value = res.data.services || [];
    pagination.total = res.data.pagination.total || 0;
  } catch (err) {
    // 拦截器已处理
  } finally {
    loading.value = false;
  }
}

function resetFilter() {
  filter.category_id = '';
  filter.status = '';
  filter.keyword = '';
  pagination.page = 1;
  loadServices();
}

function openDialog(row) {
  editing.value = row || null;
  Object.assign(form, {
    name: row ? row.name : '',
    category_id: row ? row.category_id : null,
    description: row ? (row.description || '') : '',
    cover_image: row ? (row.cover_image || '') : '',
    price_min: row ? row.price_min : null,
    price_max: row ? row.price_max : null,
    price_unit: row ? (row.price_unit || '元') : '元',
    is_hot: row ? row.is_hot === 1 : false,
    sort_order: row ? row.sort_order : 0
  });
  dialogVisible.value = true;
}

async function uploadCover({ file }) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await api.post('/admin/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    form.cover_image = res.data.url;
  } catch (err) {
    ElMessage.error('封面上传失败');
  }
}

async function handleSave() {
  await formRef.value.validate();
  submitting.value = true;
  try {
    const payload = { ...form, is_hot: form.is_hot ? 1 : 0 };
    if (editing.value) {
      await api.put(`/admin/services/${editing.value.id}`, payload);
      ElMessage.success('服务已更新');
    } else {
      await api.post('/admin/services', payload);
      ElMessage.success('服务创建成功');
    }
    dialogVisible.value = false;
    loadServices();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

async function toggleActive(row) {
  try {
    await api.put(`/admin/services/${row.id}/toggle`);
    ElMessage.success(row.is_active ? '已下架' : '已上架');
    loadServices();
  } catch (err) {
    // 拦截器已处理
  }
}

async function toggleHot(row) {
  try {
    await api.put(`/admin/services/${row.id}/hot`);
    ElMessage.success(row.is_hot ? '已取消热门' : '已设为热门');
    loadServices();
  } catch (err) {
    // 拦截器已处理
  }
}

async function handleDelete(row) {
  try {
    await api.delete(`/admin/services/${row.id}`);
    ElMessage.success('服务已删除');
    loadServices();
  } catch (err) {
    // 拦截器已处理
  }
}

onMounted(() => {
  loadCategories();
  loadServices();
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

.price-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.price-sep {
  color: #9ca3af;
}

.price-unit {
  width: 80px;
}

.cover-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cover-preview {
  width: 120px;
  height: 80px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
</style>
