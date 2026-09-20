import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.component.test.{js,ts,tsx}"],
    setupFiles: [],
  },
  resolve: {
    // Mirror vite.config.ts aliases so tests can import ui/* modules
    // (e.g. SocScreenerPanel → ConfirmModal → ui/button → @/lib/utils).
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@components": path.resolve(__dirname, "src/components"),
    },
  },
});
