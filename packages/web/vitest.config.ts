import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.component.test.{js,ts,tsx}"],
    setupFiles: [],
  },
});
