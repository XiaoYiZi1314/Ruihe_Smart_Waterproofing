import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000
});

// 请求拦截器：附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        localStorage.removeItem('admin_token');
        ElMessage.error('登录已过期，请重新登录');
        router.push('/login');
      } else {
        ElMessage.error((data && data.message) || '请求失败');
      }
    } else {
      ElMessage.error('网络请求失败');
    }
    return Promise.reject(error);
  }
);

export default api;
