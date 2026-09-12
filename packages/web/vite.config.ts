import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const proxyTarget = process.env.VITE_API_URL || 'http://127.0.0.1:8001';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      'src': path.resolve(__dirname, 'src'),
      '@': path.resolve(__dirname, 'src'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@layouts': path.resolve(__dirname, 'src/layouts'),
      '@context': path.resolve(__dirname, 'src/context'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@types': path.resolve(__dirname, 'src/types'),
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/echarts") || id.includes("echarts-for-react")) return "echarts";
          if (id.includes("src/components/dashboard/") || id.includes("src/features/dashboard/")) return "dashboard";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) return "react-vendor";
        },
      },
    },
  },
});