const LAYER_PANE_SNAPSHOTS = 1;
const LAYER_RUNTIME_CAPABILITIES = 2;
function defaultScheduleFrame(flush) {
    if (typeof requestAnimationFrame === "function") {
        return requestAnimationFrame(flush);
    }
    return setTimeout(flush, 16);
}
function defaultCancelFrame(id) {
    if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(id);
        return;
    }
    clearTimeout(id);
}
export function createRuntimeInvalidationBatcher(callbacks, options = {}) {
    const scheduleFrame = options.scheduleFrame ?? defaultScheduleFrame;
    const cancelFrame = options.cancelFrame ?? defaultCancelFrame;
    let dirtyMask = 0;
    let frameHandle = null;
    let disposed = false;
    let latestPaneSnapshots = [];
    let latestRuntimeCapabilities = null;
    const flush = () => {
        frameHandle = null;
        if (disposed || dirtyMask === 0) {
            return;
        }
        const mask = dirtyMask;
        dirtyMask = 0;
        if (mask & LAYER_PANE_SNAPSHOTS) {
            callbacks.onPaneSnapshots(latestPaneSnapshots);
        }
        if (mask & LAYER_RUNTIME_CAPABILITIES) {
            callbacks.onRuntimeCapabilities(latestRuntimeCapabilities);
        }
    };
    const ensureFrame = () => {
        if (frameHandle !== null || disposed) {
            return;
        }
        frameHandle = scheduleFrame(flush);
    };
    return {
        queuePaneSnapshots(snapshots) {
            if (disposed) {
                return;
            }
            latestPaneSnapshots = snapshots;
            dirtyMask = (dirtyMask | LAYER_PANE_SNAPSHOTS);
            ensureFrame();
        },
        queueRuntimeCapabilities(capabilities) {
            if (disposed) {
                return;
            }
            latestRuntimeCapabilities = capabilities;
            dirtyMask = (dirtyMask | LAYER_RUNTIME_CAPABILITIES);
            ensureFrame();
        },
        dispose() {
            disposed = true;
            dirtyMask = 0;
            if (frameHandle !== null) {
                cancelFrame(frameHandle);
                frameHandle = null;
            }
        },
    };
}
