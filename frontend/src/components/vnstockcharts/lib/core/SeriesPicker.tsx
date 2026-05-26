import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { getSeries, listRegistered } from "./registry/SeriesRegistry";
import type { PaneDescriptor, SeriesConfig, SeriesTypeId } from "./types/pane-descriptor";

export interface SeriesPickerProps {
	pane: PaneDescriptor;
	onAddSeries: (series: SeriesConfig) => void;
	onRemoveSeries: (type: SeriesTypeId) => void;
	anchorRef: RefObject<HTMLButtonElement | null>;
	onClose?: () => void;
}

interface PositionState {
	top: number;
	left: number;
}

function buildDefaultSeries(type: SeriesTypeId): SeriesConfig {
	const entry = getSeries(type);
	return {
		type,
		params: { ...entry.defaultParams },
		yAxis: entry.defaultYAxis,
	};
}

export function SeriesPicker({ pane, onAddSeries, onRemoveSeries, anchorRef, onClose }: SeriesPickerProps) {
	const [position, setPosition] = useState<PositionState>({ top: 0, left: 0 });
	const pickerRef = useRef<HTMLDivElement | null>(null);

	const seriesTypes = useMemo(() => listRegistered(), []);

	useEffect(() => {
		const updatePosition = () => {
			const anchor = anchorRef.current;
			if (!anchor) {
				return;
			}
			const container = anchor.closest(".rsc-pane-wrap") as HTMLElement | null;
			const anchorRect = anchor.getBoundingClientRect();
			const containerRect = container?.getBoundingClientRect();
			setPosition({
				top: containerRect ? anchorRect.bottom - containerRect.top + 6 : anchorRect.bottom + 6,
				left: containerRect ? anchorRect.left - containerRect.left : anchorRect.left,
			});
		};

		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose?.();
			}
		};
		const handleMouseDown = (event: MouseEvent) => {
			const target = event.target as Node;
			const anchor = anchorRef.current;
			const picker = pickerRef.current;
			const clickInsidePicker = Boolean(picker?.contains(target));
			const clickInsideAnchor = Boolean(anchor?.contains(target));
			if (!clickInsidePicker && !clickInsideAnchor) {
				onClose?.();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleMouseDown);
		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleMouseDown);
		};
	}, [anchorRef, onClose]);

	return (
		<div ref={pickerRef} className="rsc-series-picker" style={{ top: position.top, left: position.left }} role="dialog" aria-label="Series picker">
			<ul className="rsc-series-picker__list">
				{seriesTypes.map((type) => {
					const active = pane.series.some((series) => series.type === type);
					return (
						<li key={type}>
							<button
								type="button"
								className={`rsc-series-picker__item${active ? " rsc-series-picker__item--active" : ""}`}
								onClick={() => {
									if (active) {
										onRemoveSeries(type);
									} else {
										onAddSeries(buildDefaultSeries(type));
									}
								}}
								aria-pressed={active}
							>
								<span>{type}</span>
								<span className="rsc-series-picker__check">{active ? "✓" : ""}</span>
							</button>
						</li>
					);
				})}
			</ul>
			<div className="rsc-series-picker__footer">Nhấn Esc để đóng. Chạm lại vào một mục để xóa series.</div>
		</div>
	);
}
