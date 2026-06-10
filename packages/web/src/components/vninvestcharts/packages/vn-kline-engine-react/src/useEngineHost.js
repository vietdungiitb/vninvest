import { createEngine } from "@vninvestcharts/vn-kline-engine-core";
import { useCallback, useEffect, useInsertionEffect, useRef, useState } from "react";
const DEFAULT_OVERLAY_INPUTS = {
    measurementEnabled: false,
    selectedPriceLabels: null,
    drawingPrimitives: null,
};
// React 18 polyfill for useEffectEvent (React 19+ native API)
function useEffectEvent(fn) {
    const ref = useRef(null);
    useInsertionEffect(() => { ref.current = fn; }, [fn]);
    return useCallback((...args) => ref.current?.(...args), []);
}
import { usePaneChromeBridge } from "./usePaneChromeBridge.js";
const LONG_PRESS_DELAY_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 10;
export function useEngineHost({ dataSource = null, engineOptions, engineFactory, locale = "vi", overlayInputs, onEngineDispose, onEngineReady, onOverlayStateChange, onPaneHover, onPaneSnapshotsChange, onPointerCancel, onPointerDown, onPointerLeave, onPointerMove, onPointerUp, onClick, onContextMenu, onDoubleClick, onVisibleRangeChange, panes = [], theme = { mode: "light" }, }) {
    const containerRef = useRef(null);
    const engineRef = useRef(null);
    const [engineState, setEngineState] = useState(null);
    const resolvedOverlayInputs = overlayInputs ?? DEFAULT_OVERLAY_INPUTS;
    const hoveredPaneIdRef = useRef(null);
    const longPressTimerRef = useRef(null);
    const longPressPointerIdRef = useRef(null);
    const longPressStartRef = useRef(null);
    const longPressContextRef = useRef(null);
    const { paneSnapshots } = usePaneChromeBridge({
        engine: engineState,
        onOverlayStateChange,
        onPaneSnapshotsChange,
        onVisibleRangeChange,
    });
    const emitContextMenu = useEffectEvent((context) => {
        onContextMenu?.(context);
    });
    const clearLongPress = useCallback(() => {
        if (longPressTimerRef.current !== null) {
            clearTimeout(longPressTimerRef.current);
        }
        longPressTimerRef.current = null;
        longPressPointerIdRef.current = null;
        longPressStartRef.current = null;
        longPressContextRef.current = null;
    }, []);
    const notifyPaneHover = useEffectEvent((paneId) => {
        if (hoveredPaneIdRef.current === paneId) {
            return;
        }
        hoveredPaneIdRef.current = paneId;
        onPaneHover?.(paneId);
    });
    const notifyEngineReady = useEffectEvent((engine) => {
        onEngineReady?.(engine);
        setEngineState(engine);
    });
    const notifyEngineDispose = useEffectEvent(() => {
        onEngineDispose?.();
    });
    useEffect(() => clearLongPress, [clearLongPress]);
    const PANE_HEADER_HEIGHT = 28;
    const resolvePointerContext = (event) => {
        const container = containerRef.current;
        if (container === null) {
            return null;
        }
        const rect = container.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const hoveredSnapshot = paneSnapshots.find((snapshot) => {
            const right = snapshot.bounds.left + snapshot.bounds.width;
            const bottom = snapshot.bounds.top + snapshot.bounds.height;
            return localX >= snapshot.bounds.left && localX <= right && localY >= snapshot.bounds.top && localY <= bottom;
        });
        return {
            paneId: hoveredSnapshot?.paneId ?? null,
            clientX: event.clientX,
            clientY: event.clientY,
            localX,
            localY,
            pointerType: "pointerType" in event ? event.pointerType || "mouse" : "mouse",
            buttons: event.buttons,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
        };
    };
    const resolveHoveredPaneId = (event) => {
        const context = resolvePointerContext(event);
        if (context === null) {
            return null;
        }
        // Only activate header hover when cursor is within the header strip, not the full pane.
        const hoveredSnapshot = paneSnapshots.find((snapshot) => {
            const headerTop = snapshot.headerAnchor.top;
            const headerBottom = headerTop + PANE_HEADER_HEIGHT;
            const right = snapshot.bounds.left + snapshot.bounds.width;
            return context.localX >= snapshot.bounds.left && context.localX <= right && context.localY >= headerTop && context.localY <= headerBottom;
        });
        return hoveredSnapshot?.paneId ?? null;
    };
    useEffect(() => {
        const container = containerRef.current;
        if (container === null) {
            return undefined;
        }
        const engine = engineFactory ? engineFactory() : createEngine(engineOptions);
        engineRef.current = engine;
        engine.mount(container);
        setEngineState(engine);
        notifyEngineReady(engine);
        return () => {
            hoveredPaneIdRef.current = null;
            notifyEngineDispose();
            engine.dispose("unmount");
            engineRef.current = null;
        };
    }, [engineFactory, engineOptions]);
    useEffect(() => {
        const container = containerRef.current;
        const engine = engineRef.current;
        if (container === null || engine === null) {
            return undefined;
        }
        if (typeof ResizeObserver === "undefined") {
            return undefined;
        }
        const observer = new ResizeObserver(() => {
            engine.resize();
        });
        observer.observe(container);
        return () => {
            observer.disconnect();
        };
    }, [engineState]);
    useEffect(() => {
        const engine = engineRef.current;
        if (engine === null) {
            return;
        }
        engine.setPaneSpecs(panes);
    }, [panes]);
    useEffect(() => {
        if (hoveredPaneIdRef.current && !paneSnapshots.some((snapshot) => snapshot.paneId === hoveredPaneIdRef.current)) {
            notifyPaneHover(null);
        }
    }, [paneSnapshots]);
    useEffect(() => {
        const engine = engineRef.current;
        if (engine === null) {
            return;
        }
        engine.setDataSource(dataSource);
    }, [dataSource]);
    useEffect(() => {
        const engine = engineRef.current;
        if (engine === null) {
            return;
        }
        engine.setTheme(theme);
    }, [theme]);
    useEffect(() => {
        const engine = engineRef.current;
        if (engine === null) {
            return;
        }
        engine.setLocale(locale);
    }, [locale]);
    useEffect(() => {
        const engine = engineRef.current;
        if (engine === null) {
            return;
        }
        engine.setOverlayInputs(resolvedOverlayInputs);
    }, [resolvedOverlayInputs]);
    return {
        containerRef,
        engineRef,
        handlePointerEnter: (event) => {
            notifyPaneHover(resolveHoveredPaneId(event));
        },
        handlePointerMove: (event) => {
            notifyPaneHover(resolveHoveredPaneId(event));
            const context = resolvePointerContext(event);
            if (context !== null) {
                if (event.pointerType !== "mouse"
                    && longPressTimerRef.current !== null
                    && longPressPointerIdRef.current === event.pointerId
                    && longPressStartRef.current) {
                    const deltaX = event.clientX - longPressStartRef.current.x;
                    const deltaY = event.clientY - longPressStartRef.current.y;
                    if (Math.hypot(deltaX, deltaY) > LONG_PRESS_MOVE_THRESHOLD_PX) {
                        clearLongPress();
                    }
                    else {
                        longPressContextRef.current = context;
                    }
                }
                onPointerMove?.(context);
            }
        },
        handlePointerDown: (event) => {
            const context = resolvePointerContext(event);
            if (context !== null) {
                onPointerDown?.(context);
                if (event.pointerType !== "mouse") {
                    clearLongPress();
                    longPressPointerIdRef.current = event.pointerId;
                    longPressStartRef.current = { x: event.clientX, y: event.clientY };
                    longPressContextRef.current = context;
                    longPressTimerRef.current = setTimeout(() => {
                        const pendingContext = longPressContextRef.current;
                        if (pendingContext) {
                            emitContextMenu(pendingContext);
                        }
                        clearLongPress();
                    }, LONG_PRESS_DELAY_MS);
                }
            }
        },
        handlePointerUp: (event) => {
            clearLongPress();
            const context = resolvePointerContext(event);
            if (context !== null) {
                onPointerUp?.(context);
            }
        },
        handlePointerCancel: (event) => {
            clearLongPress();
            const context = resolvePointerContext(event);
            if (context !== null) {
                onPointerCancel?.(context);
            }
        },
        handlePointerLeave: (event) => {
            clearLongPress();
            notifyPaneHover(null);
            const context = resolvePointerContext(event);
            if (context !== null) {
                onPointerLeave?.(context);
            }
        },
        handlePointerOut: (event) => {
            clearLongPress();
            notifyPaneHover(null);
            const context = resolvePointerContext(event);
            if (context !== null) {
                onPointerLeave?.(context);
            }
        },
        handleClick: (event) => {
            clearLongPress();
            const context = resolvePointerContext(event);
            if (context !== null) {
                onClick?.(context);
            }
        },
        handleDoubleClick: (event) => {
            clearLongPress();
            const context = resolvePointerContext(event);
            if (context !== null) {
                onDoubleClick?.(context);
            }
        },
        handleContextMenu: (event) => {
            clearLongPress();
            const context = resolvePointerContext(event);
            if (context !== null) {
                onContextMenu?.(context);
            }
        },
    };
}
