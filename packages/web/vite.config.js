import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyTarget = process.env.VITE_API_URL || 'http://127.0.0.1:8001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vninvestcharts/vn-kline-engine-core': path.resolve(__dirname, 'src/components/vninvestcharts/packages/vn-kline-engine-core/src/index.js'),
      '@vninvestcharts/vn-kline-engine-react': path.resolve(__dirname, 'src/components/vninvestcharts/packages/vn-kline-engine-react/src/index.js'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/core/v1': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: proxyTarget.replace(/^http/, 'ws'),
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
