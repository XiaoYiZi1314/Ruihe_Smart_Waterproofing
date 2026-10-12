<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">瑞和</div>
        <h1>瑞和防水管理后台</h1>
        <p>防水堵漏预约服务平台</p>
      </div>

      <el-form
        v-if="mode === 'login'"
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
        <el-button class="forgot-link" link type="primary" @click="startRecover">忘记密码</el-button>
      </el-form>

      <el-form
        v-else
        ref="recoverRef"
        :model="recover"
        :rules="recoverRules"
        label-position="top"
        size="large"
        @keyup.enter="question ? submitReset() : loadQuestion()"
      >
        <el-form-item label="账号" prop="username">
          <el-input
            v-model="recover.username"
            placeholder="请输入管理员账号"
            :prefix-icon="User"
            :disabled="Boolean(question)"
          />
        </el-form-item>
        <template v-if="question">
          <el-form-item label="密保问题">
            <el-input :model-value="question" disabled />
          </el-form-item>
          <el-form-item label="密保答案" prop="answer">
            <el-input v-model="recover.answer" placeholder="请输入密保答案" />
          </el-form-item>
          <el-form-item label="新密码" prop="new_password">
            <el-input
              v-model="recover.new_password"
              type="password"
              show-password
              placeholder="至少 8 位，需包含字母和数字"
            />
          </el-form-item>
        </template>
        <el-button
          type="primary"
          class="login-btn"
          :loading="loading"
          @click="question ? submitReset() : loadQuestion()"
        >
          {{ question ? '重置密码' : '下一步' }}
        </el-button>
        <el-button class="forgot-link" link @click="backToLogin">返回登录</el-button>
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
const recoverRef = ref();
const loading = ref(false);
const mode = ref('login');
const question = ref('');

const form = reactive({
  username: '',
  password: ''
});
const recover = reactive({
  username: '',
  answer: '',
  new_password: ''
});

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};
const recoverRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入密保答案', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (typeof value !== 'string' || value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) {
          callback(new Error('新密码需 8 位以上且包含字母和数字'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
};

function startRecover() {
  recover.username = form.username;
  recover.answer = '';
  recover.new_password = '';
  question.value = '';
  mode.value = 'recover';
}

function backToLogin() {
  form.username = recover.username;
  question.value = '';
  mode.value = 'login';
}

async function loadQuestion() {
  await recoverRef.value.validateField('username');
  loading.value = true;
  try {
    const res = await api.get('/auth/admin-security-question', { params: { username: recover.username } });
    question.value = res.data.question;
  } catch {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function submitReset() {
  await recoverRef.value.validate();
  loading.value = true;
  try {
    await api.post('/auth/admin-reset-password', {
      username: recover.username,
      answer: recover.answer,
      new_password: recover.new_password
    });
    form.username = recover.username;
    form.password = '';
    ElMessage.success('密码已重置，请使用新密码登录');
    backToLogin();
  } catch {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

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
  min-height: 100%;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  background: linear-gradient(135deg, #1a5cff 0%, #2b7be4 100%);
}

.login-card {
  width: 400px;
  max-width: 100%;
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.login-card :deep(.el-input__inner) {
  font-size: 16px;
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

.forgot-link {
  display: block;
  width: 100%;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .login-card {
    padding: 28px 20px;
  }
  .login-header h1 {
    font-size: 20px;
  }
}
</style>
