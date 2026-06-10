import { defineConfig } from "tsup";
export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    tsconfig: "tsconfig.json",
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    outDir: "dist",
    outExtension({ format }) {
        return { js: format === "cjs" ? ".cjs" : ".js" };
    },
    external: [/^react$/, /^react-dom$/],
});
