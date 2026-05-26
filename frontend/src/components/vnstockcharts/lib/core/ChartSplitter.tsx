/**
 * ChartSplitter
 * Library-level draggable pane-splitter for use with usePaneSizes.
 *
 * Renders as an absolutely-positioned overlay on top of a ChartCanvas container.
 * During drag: only moves visually via CSS translateY (no React state churn).
 * On release:  commits total delta to the parent via onCommitDelta (triggers
 *              ChartCanvas remount via key when heights change).
 *
 * Styled by chart-splitter.css (.rsc-splitter). Extra classes can be merged
 * via the `className` prop for custom styling.
 *
 * @example
 * import { ChartSplitter, usePaneSizes } from "react-stockcharts";
 * import "react-stockcharts/styles/chart-splitter.css";
 *
 * const { heights, applyDelta, reset, available } = usePaneSizes(chartHeight, { ... });
 *
 * // Between pane[0] and pane[1]:
 * <ChartSplitter
 *   splitterIndex={0}
 *   available={available}
 *   onCommitDelta={applyDelta}
 *   onDoubleClick={reset}
 *   style={{ top: marginTop + heights[0] }}
 * />
 */

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

export interface ChartSplitterProps {
	/** Index of this splitter: 0 = between pane[0] and pane[1], 1 = between pane[1] and pane[2], … */
	splitterIndex: number;

	/** Total usable height passed back to onCommitDelta. Use the `available` value from usePaneSizes. */
	available: number;

	/** Called with the full drag delta (px) when the pointer is released. */
	onCommitDelta: (splitterIndex: number, deltaY: number, available: number) => void;

	/** Optional handler for double-click (e.g. reset to default ratios). */
	onDoubleClick?: () => void;

	/**
	 * Additional CSS class names merged after the default `rsc-splitter` class.
	 * Use to apply custom styling or override defaults.
	 */
	className?: string;

	/** Inline styles merged with the translate preview during drag. */
	style?: CSSProperties;

	/** Tooltip/title shown on hover. */
	title?: string;
}

export function ChartSplitter({
	splitterIndex,
	available,
	onCommitDelta,
	onDoubleClick,
	className,
	style,
	title,
}: ChartSplitterProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [visualOffset, setVisualOffset] = useState(0);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const dragRef = useRef<{ pointerId: number; startY: number } | null>(null);

	// Keep refs in sync with the latest props so callbacks are always current.
	const commitRef = useRef(onCommitDelta);
	const availableRef = useRef(available);
	useEffect(() => { commitRef.current = onCommitDelta; }, [onCommitDelta]);
	useEffect(() => { availableRef.current = available; }, [available]);

	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		rootRef.current?.setPointerCapture(event.pointerId);
		dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
		setIsDragging(true);
		setVisualOffset(0);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		// Preview position via CSS only — avoids triggering ChartCanvas redraws on every pixel.
		setVisualOffset(event.clientY - drag.startY);
	};

	const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const node = rootRef.current;
		if (node?.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
		const totalDelta = event.clientY - drag.startY;
		dragRef.current = null;
		setIsDragging(false);
		setVisualOffset(0);
		// Single commit on release → parent updates heights → ChartCanvas remounts with new key.
		if (totalDelta !== 0) {
			commitRef.current(splitterIndex, totalDelta, availableRef.current);
		}
	};

	const cls = [
		"rsc-splitter",
		isDragging ? "rsc-splitter--dragging" : "",
		className ?? "",
	].filter(Boolean).join(" ");

	return (
		<div
			ref={rootRef}
			className={cls}
			style={{
				...style,
				transform: visualOffset !== 0 ? `translateY(${visualOffset}px)` : undefined,
			}}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={stopDragging}
			onPointerCancel={stopDragging}
			onDoubleClick={onDoubleClick}
			title={title ?? "Drag to resize pane • Double-click to reset"}
		>
			<div className="rsc-splitter__handle" />
		</div>
	);
}
