import { useCallback, useEffect, useMemo, useRef } from "react";
import { createRuntimeInvalidationBatcher } from "./runtimeInvalidationBatch.js";
export function useWidgetRuntimeInvalidationBatch(options) {
    const { runtimeLane, setWidgetPaneSnapshots, setWidgetRuntimeCapabilities } = options;
    const hasMountedRuntimeLaneRef = useRef(false);
    const batchingEnabled = useMemo(() => {
        if (typeof window === "undefined") {
            return true;
        }
        const params = new URLSearchParams(window.location.search);
        return params.get("disableRuntimeBatch") !== "1";
    }, []);
    const runtimeInvalidationBatcher = useMemo(() => createRuntimeInvalidationBatcher({
        onPaneSnapshots: setWidgetPaneSnapshots,
        onRuntimeCapabilities: setWidgetRuntimeCapabilities,
    }), [setWidgetPaneSnapshots, setWidgetRuntimeCapabilities]);
    useEffect(() => () => {
        runtimeInvalidationBatcher.dispose();
    }, [runtimeInvalidationBatcher]);
    useEffect(() => {
        if (!hasMountedRuntimeLaneRef.current) {
            hasMountedRuntimeLaneRef.current = true;
            return;
        }
        setWidgetRuntimeCapabilities(null);
        if (batchingEnabled) {
            runtimeInvalidationBatcher.queueRuntimeCapabilities(null);
        }
    }, [batchingEnabled, runtimeInvalidationBatcher, runtimeLane, setWidgetRuntimeCapabilities]);
    const handleWidgetPaneSnapshotsChange = useCallback((snapshots) => {
        if (!batchingEnabled) {
            setWidgetPaneSnapshots(snapshots);
            return;
        }
        runtimeInvalidationBatcher.queuePaneSnapshots(snapshots);
    }, [batchingEnabled, runtimeInvalidationBatcher, setWidgetPaneSnapshots]);
    const handleWidgetRuntimeCapabilitiesChange = useCallback((capabilities) => {
        if (!batchingEnabled) {
            setWidgetRuntimeCapabilities(capabilities);
            return;
        }
        runtimeInvalidationBatcher.queueRuntimeCapabilities(capabilities);
    }, [batchingEnabled, runtimeInvalidationBatcher, setWidgetRuntimeCapabilities]);
    return {
        handleWidgetPaneSnapshotsChange,
        handleWidgetRuntimeCapabilitiesChange,
    };
}
