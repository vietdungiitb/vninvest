/**
 * ChartPaneSplitter
 * A thin draggable bar placed between chart panes as an absolute overlay.
 * During drag: shows visual preview via CSS translateY.
 * On release: commits total delta to parent (triggers ChartCanvas remount).
 */

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

interface ChartPaneSplitterProps {
	splitterIndex: 0 | 1;
	available: number;
	applyDragDelta: (index: 0 | 1, deltaY: number, available: number) => void;
	onDoubleClick: () => void;
	style?: CSSProperties;
}

export default function ChartPaneSplitter({
	splitterIndex,
	available,
	applyDragDelta,
	onDoubleClick,
	style,
}: ChartPaneSplitterProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [visualOffset, setVisualOffset] = useState(0);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const dragRef = useRef<{ pointerId: number; startY: number } | null>(null);
	const applyDragDeltaRef = useRef(applyDragDelta);
	const availableRef = useRef(available);

	useEffect(() => {
		applyDragDeltaRef.current = applyDragDelta;
	}, [applyDragDelta]);

	useEffect(() => {
		availableRef.current = available;
	}, [available]);

	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		const node = rootRef.current;
		if (node) node.setPointerCapture(event.pointerId);
		dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
		setIsDragging(true);
		setVisualOffset(0);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		// Only update CSS visual — do NOT touch React state during drag to avoid
		// triggering ChartCanvas redraws on every pixel (causes heavy flicker).
		setVisualOffset(event.clientY - drag.startY);
	};

	const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const node = rootRef.current;
		if (node?.hasPointerCapture(event.pointerId)) {
			node.releasePointerCapture(event.pointerId);
		}
		const totalDelta = event.clientY - drag.startY;
		dragRef.current = null;
		setIsDragging(false);
		setVisualOffset(0);
		// Commit the full drag delta once on release → triggers clean ChartCanvas remount.
		if (totalDelta !== 0) {
			applyDragDeltaRef.current(splitterIndex, totalDelta, availableRef.current);
		}
	};

	return (
		<div
			ref={rootRef}
			className={`gc-pane-splitter${isDragging ? " gc-pane-splitter--dragging" : ""}`}
			style={{
				...style,
				transform: visualOffset !== 0 ? `translateY(${visualOffset}px)` : undefined,
			}}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={stopDragging}
			onPointerCancel={stopDragging}
			onDoubleClick={onDoubleClick}
			title="Kéo để thay đổi chiều cao pane • Double-click để reset"
		>
			<div className="gc-pane-splitter__handle" />
		</div>
	);
}
