interface BoundsLike {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface ScaleSlotStateLike {
	domain?: readonly [number, number];
}

interface VisibleRangeLike {
	from: number;
	to: number;
}

interface PaneRuntimeSnapshotLike {
	plotBounds: BoundsLike;
	scaleSlotStates?: Record<string, ScaleSlotStateLike | undefined>;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function resolvePlotSpan(snapshot: PaneRuntimeSnapshotLike) {
	const left = snapshot.plotBounds.left;
	const top = snapshot.plotBounds.top;
	const width = Math.max(snapshot.plotBounds.width, 1);
	const height = Math.max(snapshot.plotBounds.height, 1);
	return { left, top, width, height };
}

function resolveScaleDomain(snapshot: PaneRuntimeSnapshotLike, scaleSlotId: string) {
	const domain = snapshot.scaleSlotStates?.[scaleSlotId]?.domain;
	if (!Array.isArray(domain) || domain.length < 2) {
		return null;
	}

	const [min, max] = domain;
	if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
		return null;
	}

	return { min, max };
}

export function resolvePaneDataIndexAtPixel(
	snapshot: PaneRuntimeSnapshotLike,
	visibleRange: VisibleRangeLike,
	x: number,
	dataLength: number,
) {
	if (!Number.isFinite(x) || dataLength <= 0) {
		return null;
	}

	const maxIndex = dataLength - 1;
	const from = clamp(Math.round(visibleRange.from), 0, maxIndex);
	const to = clamp(Math.round(visibleRange.to), 0, maxIndex);
	const span = Math.max(to - from, 0);
	if (span === 0) {
		return from;
	}

	const { left, width } = resolvePlotSpan(snapshot);
	const ratio = clamp((x - left) / width, 0, 1);
	return clamp(Math.round(from + ratio * span), 0, maxIndex);
}

export function resolvePanePixelAtDataIndex(
	snapshot: PaneRuntimeSnapshotLike,
	visibleRange: VisibleRangeLike,
	dataIndex: number,
	dataLength: number,
) {
	if (!Number.isFinite(dataIndex) || dataLength <= 0) {
		return null;
	}

	const maxIndex = dataLength - 1;
	const from = clamp(Math.round(visibleRange.from), 0, maxIndex);
	const to = clamp(Math.round(visibleRange.to), 0, maxIndex);
	const span = Math.max(to - from, 0);
	const { left, width } = resolvePlotSpan(snapshot);

	if (span === 0) {
		return left;
	}

	const ratio = (clamp(dataIndex, from, to) - from) / span;
	return left + ratio * width;
}

export function resolvePaneValueAtPixel(
	snapshot: PaneRuntimeSnapshotLike,
	scaleSlotId: string,
	y: number,
) {
	if (!Number.isFinite(y)) {
		return null;
	}

	const domain = resolveScaleDomain(snapshot, scaleSlotId);
	if (!domain) {
		return null;
	}

	const { top, height } = resolvePlotSpan(snapshot);
	const ratio = clamp((y - top) / height, 0, 1);
	return domain.max - ratio * (domain.max - domain.min);
}

export function resolvePanePixelAtValue(
	snapshot: PaneRuntimeSnapshotLike,
	scaleSlotId: string,
	value: number,
) {
	if (!Number.isFinite(value)) {
		return null;
	}

	const domain = resolveScaleDomain(snapshot, scaleSlotId);
	if (!domain) {
		return null;
	}

	const { top, height } = resolvePlotSpan(snapshot);
	const ratio = (domain.max - value) / (domain.max - domain.min);
	return top + ratio * height;
}