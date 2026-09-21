import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
  return {
    plugins: [vue()],
    base: '/admin/',
    server: {
      port: 5173,
      proxy: {
        '/uploads': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, ws: true, changeOrigin: true },
        '/api': { target: apiTarget, changeOrigin: true }
      }
    }
  };
});
