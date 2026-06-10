import { useEffect, useRef, useState } from "react";
export function useCanvasResize() {
    const ref = useRef(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const element = ref.current;
        if (!element) {
            return undefined;
        }
        const updateSize = () => {
            setSize({
                width: element.clientWidth,
                height: element.clientHeight,
            });
        };
        updateSize();
        if (typeof ResizeObserver === "undefined") {
            return undefined;
        }
        const observer = new ResizeObserver(() => {
            updateSize();
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
        };
    }, []);
    return { ref, size };
}
