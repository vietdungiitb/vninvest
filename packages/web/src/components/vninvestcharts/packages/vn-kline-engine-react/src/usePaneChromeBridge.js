import { useCallback, useEffect, useInsertionEffect, useRef, useState } from "react";
// React 18 polyfill for useEffectEvent (React 19+ native API)
function useEffectEvent(fn) {
    const ref = useRef(null);
    useInsertionEffect(() => { ref.current = fn; }, [fn]);
    return useCallback((...args) => ref.current?.(...args), []);
}
export function usePaneChromeBridge({ engine, onOverlayStateChange, onPaneSnapshotsChange, onVisibleRangeChange, }) {
    const [paneSnapshots, setPaneSnapshots] = useState(() => engine?.getPaneSnapshots() ?? []);
    const [visibleRange, setVisibleRange] = useState(() => engine?.getVisibleRange() ?? null);
    const [overlayState, setOverlayState] = useState(() => engine?.getOverlayState() ?? null);
    const lastPaneSnapshotsKeyRef = useRef(null);
    const lastVisibleRangeRef = useRef(visibleRange);
    const lastOverlayStateKeyRef = useRef(null);
    const serializePaneSnapshots = useCallback((snapshots) => JSON.stringify(snapshots), []);
    const serializeOverlayState = useCallback((state) => JSON.stringify(state), []);
    const syncPaneSnapshots = useEffectEvent((nextEngine) => {
        const nextSnapshots = nextEngine.getPaneSnapshots();
        const nextSnapshotsKey = serializePaneSnapshots(nextSnapshots);
        if (lastPaneSnapshotsKeyRef.current === nextSnapshotsKey) {
            return;
        }
        lastPaneSnapshotsKeyRef.current = nextSnapshotsKey;
        setPaneSnapshots(nextSnapshots);
        onPaneSnapshotsChange?.(nextSnapshots);
    });
    const syncVisibleRange = useEffectEvent((nextEngine) => {
        const nextVisibleRange = nextEngine.getVisibleRange();
        if (lastVisibleRangeRef.current !== null
            && nextVisibleRange !== null
            && lastVisibleRangeRef.current.from === nextVisibleRange.from
            && lastVisibleRangeRef.current.to === nextVisibleRange.to) {
            return;
        }
        lastVisibleRangeRef.current = nextVisibleRange;
        setVisibleRange(nextVisibleRange);
        onVisibleRangeChange?.(nextVisibleRange);
    });
    const syncOverlayState = useEffectEvent((nextEngine) => {
        const nextOverlayState = nextEngine.getOverlayState();
        const nextOverlayStateKey = serializeOverlayState(nextOverlayState);
        if (lastOverlayStateKeyRef.current === nextOverlayStateKey) {
            return;
        }
        lastOverlayStateKeyRef.current = nextOverlayStateKey;
        setOverlayState(nextOverlayState);
        onOverlayStateChange?.(nextOverlayState);
    });
    useEffect(() => {
        if (engine == null) {
            lastPaneSnapshotsKeyRef.current = null;
            lastVisibleRangeRef.current = null;
            lastOverlayStateKeyRef.current = null;
            setPaneSnapshots([]);
            setVisibleRange(null);
            setOverlayState(null);
            return undefined;
        }
        syncPaneSnapshots(engine);
        syncVisibleRange(engine);
        syncOverlayState(engine);
        const unsubscribePanes = engine.subscribe("panes", () => {
            syncPaneSnapshots(engine);
        });
        const unsubscribeVisibleRange = engine.subscribe("visibleRange", () => {
            syncVisibleRange(engine);
        });
        const unsubscribeOverlayState = engine.subscribe("overlayState", () => {
            syncOverlayState(engine);
        });
        return () => {
            unsubscribePanes();
            unsubscribeVisibleRange();
            unsubscribeOverlayState();
        };
    }, [engine]);
    return {
        paneSnapshots,
        visibleRange,
        overlayState,
    };
}
