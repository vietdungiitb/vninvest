import { useEffect, useState } from "react";
function readViewportMetrics() {
    if (typeof window === "undefined") {
        return { width: 0, height: 0, offsetTop: 0, offsetLeft: 0, keyboardInsetBottom: 0 };
    }
    const viewport = window.visualViewport;
    if (!viewport) {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            offsetTop: 0,
            offsetLeft: 0,
            keyboardInsetBottom: 0,
        };
    }
    const keyboardInsetBottom = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
    return {
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        offsetTop: Math.round(viewport.offsetTop),
        offsetLeft: Math.round(viewport.offsetLeft),
        keyboardInsetBottom: Math.round(keyboardInsetBottom),
    };
}
export function useViewportMetrics() {
    const [metrics, setMetrics] = useState(() => readViewportMetrics());
    useEffect(() => {
        const update = () => setMetrics(readViewportMetrics());
        update();
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", update);
        window.visualViewport?.addEventListener("resize", update);
        window.visualViewport?.addEventListener("scroll", update);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("orientationchange", update);
            window.visualViewport?.removeEventListener("resize", update);
            window.visualViewport?.removeEventListener("scroll", update);
        };
    }, []);
    useEffect(() => {
        document.documentElement.style.setProperty("--gc-keyboard-inset-bottom", `${metrics.keyboardInsetBottom}px`);
        return () => {
            document.documentElement.style.removeProperty("--gc-keyboard-inset-bottom");
        };
    }, [metrics.keyboardInsetBottom]);
    return metrics;
}
