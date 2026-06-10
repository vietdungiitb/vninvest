import { defineConfig } from "tsup";
export default defineConfig({
    entry: {
        index: "src/index.ts",
        "LodBucketizer.worker": "src/engine/LodBucketizer.worker.ts",
    },
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
});
