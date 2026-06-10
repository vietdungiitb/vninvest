// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
const reactActEnvironment = globalThis;
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
let createElement;
let act;
let createRoot;
let useLongPress;
beforeAll(async () => {
    ({ createElement, act } = await import("react"));
    ({ createRoot } = await import("react-dom/client"));
    ({ useLongPress } = await import("./useLongPress"));
});
afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});
// Minimal renderHook using react-dom/client — matches project test patterns (no @testing-library/react)
function renderHook(useHookFn) {
    const store = { value: null };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    function Probe() {
        store.value = useHookFn();
        return null;
    }
    act(() => {
        root.render(createElement(Probe));
    });
    return {
        result: {
            get current() {
                return store.value;
            },
        },
    };
}
function makePointerEvent(overrides = {}) {
    return {
        pointerType: "touch",
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        currentTarget: null,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        ...overrides,
    };
}
describe("useLongPress", () => {
    it("calls callback after default 500 ms without movement", () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const { result } = renderHook(() => useLongPress(cb));
        act(() => {
            result.current.onPointerDown(makePointerEvent());
        });
        expect(cb).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(cb).toHaveBeenCalledTimes(1);
    });
    it("does NOT call callback if pointer moves more than moveThreshold", () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const { result } = renderHook(() => useLongPress(cb, { moveThreshold: 10 }));
        act(() => {
            result.current.onPointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
            // Move 15px — exceeds 10px threshold
            result.current.onPointerMove(makePointerEvent({ clientX: 15, clientY: 0 }));
        });
        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(cb).not.toHaveBeenCalled();
    });
    it("cancels if pointerUp fires before delay", () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const { result } = renderHook(() => useLongPress(cb, { delay: 500 }));
        act(() => {
            result.current.onPointerDown(makePointerEvent());
        });
        act(() => {
            result.current.onPointerUp(makePointerEvent());
        });
        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(cb).not.toHaveBeenCalled();
    });
    it("cancels if pointerCancel fires before delay", () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const { result } = renderHook(() => useLongPress(cb, { delay: 500 }));
        act(() => {
            result.current.onPointerDown(makePointerEvent());
        });
        act(() => {
            result.current.onPointerCancel(makePointerEvent());
        });
        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(cb).not.toHaveBeenCalled();
    });
    it("skips pointer events with pointerType=mouse", () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const { result } = renderHook(() => useLongPress(cb));
        act(() => {
            result.current.onPointerDown(makePointerEvent({ pointerType: "mouse" }));
        });
        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(cb).not.toHaveBeenCalled();
    });
    it("accepts a custom delay", () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const { result } = renderHook(() => useLongPress(cb, { delay: 800 }));
        act(() => {
            result.current.onPointerDown(makePointerEvent());
        });
        act(() => {
            vi.advanceTimersByTime(799);
        });
        expect(cb).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(cb).toHaveBeenCalledTimes(1);
    });
    it("does NOT cancel for movement exactly at threshold (Math.hypot(10,0)=10; 10>10 is false)", () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const { result } = renderHook(() => useLongPress(cb, { moveThreshold: 10 }));
        act(() => {
            result.current.onPointerDown(makePointerEvent({ clientX: 0, clientY: 0 }));
            // Exactly 10px movement — NOT > threshold → timer survives
            result.current.onPointerMove(makePointerEvent({ clientX: 10, clientY: 0 }));
        });
        act(() => {
            vi.advanceTimersByTime(600);
        });
        expect(cb).toHaveBeenCalledTimes(1);
    });
});
