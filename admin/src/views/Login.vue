<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">瑞和</div>
        <h1>瑞和防水管理后台</h1>
        <p>防水堵漏预约服务平台</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @keyup.enter="handleLogin"
      >
        <el-form-item label="账号" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入管理员账号"
            :prefix-icon="User"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>

        <el-button
          type="primary"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import api from '../api';

const router = useRouter();
const formRef = ref();
const loading = ref(false);

const form = reactive({
  username: '',
  password: ''
});

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function handleLogin() {
  await formRef.value.validate();

  loading.value = true;
  try {
    const res = await api.post('/auth/admin-login', {
      username: form.username,
      password: form.password
    });
    localStorage.setItem('admin_token', res.data.token);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (err) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a5cff 0%, #2b7be4 100%);
}

.login-card {
  width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a5cff, #2b7be4);
  color: #fff;
  font-size: 22px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-header h1 {
  font-size: 22px;
  color: #1f2937;
  margin-bottom: 8px;
}

.login-header p {
  font-size: 14px;
  color: #9ca3af;
}

.login-btn {
  width: 100%;
  margin-top: 8px;
  background: linear-gradient(135deg, #1a5cff, #2b7be4);
  border: none;
  height: 44px;
  font-size: 16px;
}

.login-btn:hover {
  opacity: 0.9;
}
</style>
