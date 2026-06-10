const SHARED_ENVELOPE_MAX_ABS_INDEX = 1_000_000;
const SHARED_ENVELOPE_MIN_SPAN = 1e-6;
function clampSharedEnvelopeIndex(value) {
    return Math.max(-SHARED_ENVELOPE_MAX_ABS_INDEX, Math.min(SHARED_ENVELOPE_MAX_ABS_INDEX, value));
}
function resolveVisibleBounds(visibleRange) {
    const rawFrom = Number.isFinite(visibleRange.from) ? clampSharedEnvelopeIndex(visibleRange.from) : 0;
    const rawTo = Number.isFinite(visibleRange.to) ? clampSharedEnvelopeIndex(visibleRange.to) : rawFrom;
    return {
        from: Math.min(rawFrom, rawTo),
        to: Math.max(rawFrom, rawTo),
    };
}
function resolveScaleDomain(snapshot, scaleSlotId) {
    const scaleSlotState = snapshot.scaleSlotStates[scaleSlotId];
    if (!scaleSlotState?.domain) {
        return null;
    }
    const [minValue, maxValue] = scaleSlotState.domain;
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return null;
    }
    return { minValue, maxValue };
}
export function createPaneProjector(snapshot, visibleRange, scaleSlotId) {
    const { left, top, width, height } = snapshot.plotBounds;
    const { from, to } = resolveVisibleBounds(visibleRange);
    const rawSpan = Math.max(0, to - from);
    const span = rawSpan < SHARED_ENVELOPE_MIN_SPAN ? 0 : rawSpan;
    const indexToPixelX = (index) => {
        if (!Number.isFinite(index) || width <= 0) {
            return null;
        }
        if (span === 0) {
            return left + width / 2;
        }
        const ratio = (index - from) / span;
        return left + ratio * width;
    };
    const pixelXToIndex = (pixelX) => {
        if (!Number.isFinite(pixelX) || width <= 0) {
            return null;
        }
        if (span === 0) {
            return from;
        }
        const ratio = (pixelX - left) / width;
        return from + ratio * span;
    };
    const valueToPixelY = (value) => {
        const domain = resolveScaleDomain(snapshot, scaleSlotId);
        if (!domain || !Number.isFinite(value) || height <= 0) {
            return null;
        }
        if (domain.maxValue === domain.minValue) {
            return top + height / 2;
        }
        const ratio = (domain.maxValue - value) / (domain.maxValue - domain.minValue);
        return top + ratio * height;
    };
    const pixelYToValue = (pixelY) => {
        const domain = resolveScaleDomain(snapshot, scaleSlotId);
        if (!domain || !Number.isFinite(pixelY) || height <= 0) {
            return null;
        }
        const ratio = (pixelY - top) / height;
        return domain.maxValue - ratio * (domain.maxValue - domain.minValue);
    };
    return {
        indexToPixelX,
        pixelXToIndex,
        valueToPixelY,
        pixelYToValue,
    };
}
