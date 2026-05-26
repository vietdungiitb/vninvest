import { useMemo } from "react";
import { resolveSemanticPointLabels } from "./renderCanvas";
import type { DrawingObject } from "./types";

export interface DrawingSemanticPointLegendLabels {
	title: string;
	empty: string;
	hint: string;
	clear: string;
}

export interface DrawingSemanticPointLegendProps {
	drawing: DrawingObject | null;
	labels: DrawingSemanticPointLegendLabels;
	activePointIndex: number | null;
	onPointFocusChange: (index: number | null) => void;
}

export default function DrawingSemanticPointLegend({ drawing, labels, activePointIndex, onPointFocusChange }: DrawingSemanticPointLegendProps) {
	const pointLabels = useMemo(() => {
		if (!drawing) {
			return [] as readonly string[];
		}
		return resolveSemanticPointLabels(drawing) ?? [];
	}, [drawing]);

	if (!drawing || pointLabels.length === 0) {
		return <div className="rsc-drawing-point-legend rsc-drawing-point-legend--empty">{labels.empty}</div>;
	}

	return (
		<section className="rsc-drawing-point-legend">
			<div className="rsc-drawing-point-legend__header">
				<strong>{labels.title}</strong>
				<button type="button" className="rsc-drawing-point-legend__clear" onClick={() => onPointFocusChange(null)}>
					{labels.clear}
				</button>
			</div>
			<div className="rsc-drawing-point-legend__hint">{labels.hint}</div>
			<div className="rsc-drawing-point-legend__items">
				{pointLabels.map((label, index) => {
					const isActive = activePointIndex === index;
					return (
						<button
							key={`${label}-${index}`}
							type="button"
							className={`rsc-drawing-point-legend__item${isActive ? " rsc-drawing-point-legend__item--active" : ""}`}
							onMouseEnter={() => onPointFocusChange(index)}
							onFocus={() => onPointFocusChange(index)}
							onMouseLeave={() => onPointFocusChange(null)}
							onBlur={() => onPointFocusChange(null)}
						>
							<span className="rsc-drawing-point-legend__index">{index + 1}</span>
							<span className="rsc-drawing-point-legend__label">{label}</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}
