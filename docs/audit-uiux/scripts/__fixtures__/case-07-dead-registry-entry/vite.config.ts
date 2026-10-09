import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cố tình KHÔNG khai `root`: mặc định của Vite là thư mục chứa config, giống hệt
// packages/web/vite.config.ts của repo thật (repo đó cũng không khai root).
export default {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
