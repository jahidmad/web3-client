import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: '.',
  base: './', // 关键：使用相对路径，适配 Electron
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
});