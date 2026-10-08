<template>
  <div class="site-config-page">
    <el-tabs v-model="activeTab" tab-position="left">
      <!-- 轮播图管理 -->
      <el-tab-pane label="轮播图" name="banners">
        <div class="tab-content">
          <div class="tab-header">
            <h3>轮播图管理</h3>
            <el-button type="primary" size="small" @click="openBannerDialog()">
              <el-icon><Plus /></el-icon>新增轮播图
            </el-button>
          </div>

          <el-table :data="banners" v-loading="bannersLoading" stripe>
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="图片" width="160">
              <template #default="{ row }">
                <el-image
                  :src="row.image_url"
                  style="width: 120px; height: 54px"
                  fit="cover"
                  :preview-src-list="[row.image_url]"
                  preview-teleported
                />
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" width="140">
              <template #default="{ row }">{{ row.title || '-' }}</template>
            </el-table-column>
            <el-table-column label="跳转" min-width="160">
              <template #default="{ row }">
                <span v-if="row.link_type === 'none'">无跳转</span>
                <span v-else-if="row.link_type === 'service'">服务 ID: {{ row.link_value }}</span>
                <span v-else class="link-url">{{ row.link_value }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="sort_order" label="排序" width="70" align="center" />
            <el-table-column label="启用" width="80" align="center">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.is_active === 1"
                  @change="toggleBanner(row)"
                  inline-prompt
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openBannerDialog(row)">编辑</el-button>
                <el-popconfirm title="确定删除该轮播图吗？" @confirm="deleteBanner(row)">
                  <template #reference>
                    <el-button link type="danger" size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 联系方式 -->
      <el-tab-pane label="联系方式" name="contact">
        <div class="tab-content">
          <h3>联系方式</h3>
          <el-form
            v-loading="configLoading"
            :model="contactForm"
            label-width="100px"
            style="max-width: 500px"
          >
            <el-form-item label="联系电话">
              <el-input v-model="contactForm.contact_phone" placeholder="如：400-888-6688" />
            </el-form-item>
            <el-form-item label="联系地址">
              <el-input
                v-model="contactForm.contact_address"
                type="textarea"
                :rows="2"
                placeholder="公司地址"
              />
            </el-form-item>
            <el-form-item label="微信号">
              <el-input v-model="contactForm.contact_wechat" placeholder="用于客户复制联系" />
            </el-form-item>
            <el-form-item label="营业时间">
              <el-input v-model="contactForm.contact_hours" placeholder="如：周一至周日 8:00-18:00" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig('contact')">保存</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 关于我们 -->
      <el-tab-pane label="关于我们" name="about">
        <div class="tab-content">
          <h3>关于我们</h3>
          <el-form v-loading="configLoading" label-width="100px" style="max-width: 700px">
            <el-form-item label="内容">
              <el-input
                v-model="aboutForm.about_us"
                type="textarea"
                :rows="12"
                placeholder="公司介绍、企业文化等..."
                maxlength="5000"
                show-word-limit
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig('about')">保存</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 加盟信息 -->
      <el-tab-pane label="加盟信息" name="join">
        <div class="tab-content">
          <h3>加盟信息</h3>
          <el-form
            v-loading="configLoading"
            :model="joinForm"
            class="join-form"
            label-width="132px"
            style="max-width: 640px"
          >
            <el-form-item label="合作品牌/公司">
              <el-input v-model="joinForm.partners" type="textarea" :rows="4" placeholder="每行一家合作品牌或公司" maxlength="2000" />
            </el-form-item>
            <el-form-item label="合作说明">
              <el-input
                v-model="joinForm.brand_intro"
                type="textarea"
                :rows="6"
                placeholder="品牌介绍..."
                maxlength="2000"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="加盟电话">
              <el-input v-model="joinForm.join_phone" placeholder="加盟咨询电话" />
            </el-form-item>
            <el-form-item label="加盟优势">
              <el-input
                v-model="joinForm.advantages"
                type="textarea"
                :rows="6"
                placeholder="每行一条加盟优势"
                maxlength="2000"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveConfig('join')">保存</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 轮播图编辑弹窗 -->
    <el-dialog v-model="bannerDialogVisible" :title="editingBanner ? '编辑轮播图' : '新增轮播图'" width="520px">
      <el-form ref="bannerFormRef" :model="bannerForm" :rules="bannerRules" label-width="90px">
        <el-form-item label="图片" prop="image_url">
          <div class="banner-upload">
            <el-image
              v-if="bannerForm.image_url"
              :src="bannerForm.image_url"
              class="banner-preview"
              fit="cover"
            />
            <el-upload
              :show-file-list="false"
              :http-request="uploadBanner"
              accept="image/*"
            >
              <el-button size="small">{{ bannerForm.image_url ? '更换图片' : '上传图片' }}</el-button>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="bannerForm.title" placeholder="轮播图标题（可选）" maxlength="100" />
        </el-form-item>
        <el-form-item label="跳转类型">
          <el-select v-model="bannerForm.link_type" style="width: 100%">
            <el-option label="无跳转" value="none" />
            <el-option label="跳转服务" value="service" />
            <el-option label="外部链接" value="url" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="bannerForm.link_type !== 'none'"
          :label="bannerForm.link_type === 'service' ? '服务ID' : '链接地址'"
        >
          <el-input
            v-model="bannerForm.link_value"
            :placeholder="bannerForm.link_type === 'service' ? '输入服务项目 ID' : '输入完整 URL'"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="bannerForm.sort_order" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bannerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveBanner">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api';

const activeTab = ref('banners');

// 轮播图
const banners = ref([]);
const bannersLoading = ref(false);
const bannerDialogVisible = ref(false);
const editingBanner = ref(null);
const submitting = ref(false);
const bannerFormRef = ref();

const bannerForm = reactive({
  title: '',
  image_url: '',
  link_type: 'none',
  link_value: '',
  sort_order: 0
});

const bannerRules = {
  image_url: [{ required: true, message: '请上传图片', trigger: 'change' }]
};

// 配置
const configLoading = ref(false);
const saving = ref(false);

const contactForm = reactive({
  contact_phone: '',
  contact_address: '',
  contact_hours: '',
  contact_wechat: ''
});

const aboutForm = reactive({
  about_us: ''
});

const joinForm = reactive({
  partners: '',
  brand_intro: '',
  join_phone: '',
  advantages: ''
});

async function loadBanners() {
  bannersLoading.value = true;
  try {
    const res = await api.get('/admin/banners');
    banners.value = res.data.banners || [];
  } catch (err) {
    // 拦截器已处理
  } finally {
    bannersLoading.value = false;
  }
}

function openBannerDialog(row) {
  editingBanner.value = row || null;
  Object.assign(bannerForm, {
    title: row ? (row.title || '') : '',
    image_url: row ? row.image_url : '',
    link_type: row ? row.link_type : 'none',
    link_value: row ? (row.link_value || '') : '',
    sort_order: row ? row.sort_order : 0
  });
  bannerDialogVisible.value = true;
}

async function uploadBanner({ file }) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await api.post('/admin/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    bannerForm.image_url = res.data.url;
  } catch (err) {
    ElMessage.error('图片上传失败');
  }
}

async function saveBanner() {
  await bannerFormRef.value.validate();
  submitting.value = true;
  try {
    if (editingBanner.value) {
      await api.put(`/admin/banners/${editingBanner.value.id}`, bannerForm);
      ElMessage.success('轮播图已更新');
    } else {
      await api.post('/admin/banners', bannerForm);
      ElMessage.success('轮播图创建成功');
    }
    bannerDialogVisible.value = false;
    loadBanners();
  } catch (err) {
    // 拦截器已处理
  } finally {
    submitting.value = false;
  }
}

async function toggleBanner(row) {
  try {
    await api.put(`/admin/banners/${row.id}/toggle`);
    ElMessage.success('状态已切换');
    loadBanners();
  } catch (err) {
    // 拦截器已处理
  }
}

async function deleteBanner(row) {
  try {
    await api.delete(`/admin/banners/${row.id}`);
    ElMessage.success('轮播图已删除');
    loadBanners();
  } catch (err) {
    // 拦截器已处理
  }
}

async function loadConfig() {
  configLoading.value = true;
  try {
    const res = await api.get('/admin/config');
    const config = res.data || {};

    const contact = config.contact_info || {};
    contactForm.contact_phone = config.contact_phone ?? contact.mobile ?? contact.phone ?? '';
    contactForm.contact_address = config.contact_address ?? contact.address ?? '';
    contactForm.contact_hours = config.contact_hours ?? contact.hours ?? contact.business_hours ?? '';
    contactForm.contact_wechat = config.contact_wechat ?? contact.wechat ?? '';

    aboutForm.about_us = config.about_us || '';

    const join = config.join_info || {};
    joinForm.partners = Array.isArray(join.partners) ? join.partners.join('\n') : join.partners || '';
    joinForm.brand_intro = join.brand_intro ?? join.description ?? join.content ?? '';
    joinForm.join_phone = join.join_phone ?? join.phone ?? '';
    joinForm.advantages = Array.isArray(join.advantages)
      ? join.advantages.join('\n')
      : join.advantages || '';
  } catch (err) {
    // 拦截器已处理
  } finally {
    configLoading.value = false;
  }
}

async function saveConfig(type) {
  saving.value = true;
  try {
    let payload = {};
    if (type === 'contact') {
      payload = { ...contactForm };
    } else if (type === 'about') {
      payload = { about_us: aboutForm.about_us };
    } else if (type === 'join') {
      payload = {
        join_info: {
          partners: joinForm.partners,
          brand_intro: joinForm.brand_intro,
          join_phone: joinForm.join_phone,
          advantages: joinForm.advantages
            ? joinForm.advantages.split('\n').map((s) => s.trim()).filter(Boolean)
            : []
        }
      };
    }

    await api.put('/admin/config', payload);
    ElMessage.success('配置已保存');
  } catch (err) {
    // 拦截器已处理
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadBanners();
  loadConfig();
});
</script>

<style scoped>
.site-config-page {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  min-height: 100%;
}

.tab-content {
  padding: 0 20px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tab-content h3 {
  font-size: 16px;
  color: #1f2937;
  margin-bottom: 16px;
}

.link-url {
  color: #2b7be4;
  word-break: break-all;
}

.banner-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.banner-preview {
  width: 160px;
  height: 72px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.join-form :deep(.el-form-item) {
  align-items: flex-start;
}

.join-form :deep(.el-form-item__label) {
  height: auto;
  line-height: 32px;
  white-space: nowrap;
}
</style>
