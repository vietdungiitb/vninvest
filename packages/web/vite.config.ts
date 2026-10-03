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
          // B3 — `__vitePreload` phải có chunk riêng, ĐẶT TRƯỚC TẤT CẢ rule
          // khác.
          //
          // Bằng chứng (2026-09-26, đọc export block của `dashboard-*.js` trong
          // `dist/`): shell (`main.tsx` → AppShell → Sidebar/Header) chỉ dùng
          // MỘT symbol từ chunk "dashboard" — `{_ as c}` — và symbol đó hoá ra
          // là `__vitePreload` của Vite, tức helper runtime chứ không phải module
          // dashboard. Rollup không có rule nào khớp nên đặt nó vào chunk
          // "dashboard"; hệ quả là MỌI route (vì đều nạp shell) đều phải tải
          // chunk dashboard, kéo theo `echarts` 623 KB dù trang đó không vẽ biểu
          // đồ nào.
          if (id.includes("vite/preload-helper") || id.includes("vite/modulepreload-polyfill")) return "vite-helpers";

          if (id.includes("node_modules/vninvestcharts-widget")) return "widget";
          if (id.includes("node_modules/echarts") || id.includes("echarts-for-react")) return "echarts";

          // B3 — các nhóm dùng chung HÀNH ĐẾN MỌI TRANG phải có chunk riêng.
          //
          // Bằng chứng (2026-09-26, đo bằng `scripts/measure-route-graph.mjs` +
          // đọc sourcemap Rollup): trước khi sửa, static closure của
          // `/ai-advisory` kéo theo `echarts` 623 KB + chunk "dashboard" 659 KB.
          // Tên chunk khiến người ta tưởng lỗi nằm ở trang advisory, nhưng
          // sourcemap cho thấy chunk "dashboard" chứa 108 module, trong đó có
          // `src/i18n/vi.js` + `en.js` (TOÀN BỘ từ điển), `LangContext`,
          // `PortfolioContext`, `PaginationBar`, 60 icon `lucide-react`,
          // `@casl/ability` — tức đúng những thứ MỌI trang đều cần — cộng
          // thêm `PortfolioHeatmap` / `WhaleAnalyticsTab` (chỉ dashboard dùng,
          // nhưng chúng import echarts).
          //
          // Nguyên nhân gốc: `manualChunks` gán theo ĐƯỜNG DẪN, nên một module
          // dùng chung (ví dụ `LangContext`) bị Rollup gộp vào chunk
          // "dashboard" cùng các module dashboard. Trang advisory cần
          // `LangContext` để hiển thị chữ, nên bị buộc tải cả echarts dù trang
          // không hề vẽ biểu đồ.
          //
          // Cách sửa: khai báo từng nhóm dùng chung thành chunk riêng để
          // không còn module nào bị "dính" vào chunk theo đường dẫn của route
          // khác. Thứ tự QUAN TRỌNG: rule hẹp (adapters) phải đứng trước
          // rule rộng (components).
          if (id.includes("/src/adapters/") || id.includes("\\src\\adapters\\")) return "adapters";
          if (id.includes("/src/i18n/") || id.includes("\\src\\i18n\\")) return "i18n";
          if (id.includes("/src/context/") || id.includes("\\src\\context\\")) return "context";
          if (id.includes("/src/components/ui/") || id.includes("\\src\\components\\ui\\")) return "ui";
          if (id.includes("/src/components/shared/") || id.includes("\\src\\components\\shared\\")) return "shared";
          if (id.includes("/src/utils/") || id.includes("\\src\\utils\\")) return "utils";
          if (id.includes("/src/hooks/") || id.includes("\\src\\hooks\\")) return "hooks";
          if (id.includes("node_modules/lucide-react")) return "icons";
          if (id.includes("node_modules/@casl") || id.includes("node_modules/@ucast")) return "casl";
          if (id.includes("src/components/dashboard/") || id.includes("src/features/dashboard/")) return "dashboard";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) return "react-vendor";
          if (id.includes("node_modules/@tanstack")) return "tanstack";
        },
      },
    },
  },
});