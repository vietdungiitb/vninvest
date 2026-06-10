import { describe, expect, it } from "vitest";
import { WebGLLineRenderer } from "./WebGLLineRenderer";
function createCanvasWithoutWebGL() {
    const canvas = {
        width: 800,
        height: 400,
        getContext: (contextId) => (contextId === "webgl" ? null : null),
    };
    return canvas;
}
describe("WebGLLineRenderer", () => {
    it("constructor does not throw when WebGL context is unavailable", () => {
        const canvas = createCanvasWithoutWebGL();
        expect(() => new WebGLLineRenderer(canvas)).not.toThrow();
        const renderer = new WebGLLineRenderer(canvas);
        expect(renderer.isAvailable).toBe(false);
    });
    it("drawLine is a no-op and does not throw when isAvailable=false", () => {
        const renderer = new WebGLLineRenderer(createCanvasWithoutWebGL());
        expect(renderer.isAvailable).toBe(false);
        expect(() => renderer.drawLine([
            { x: 10, y: 20 },
            { x: 40, y: 60 },
        ], { color: "#4ade80", width: 2 })).not.toThrow();
        expect(() => renderer.flush()).not.toThrow();
    });
    it("dispose does not throw when context is null", () => {
        const renderer = new WebGLLineRenderer(createCanvasWithoutWebGL());
        expect(() => renderer.dispose()).not.toThrow();
    });
});
