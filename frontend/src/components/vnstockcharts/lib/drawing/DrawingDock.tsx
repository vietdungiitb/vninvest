import { type ReactNode, useEffect, useRef, useState } from "react";

import type { DrawingDockTab } from "./workspace/useDrawingWorkspaceController";

export interface DrawingDockLabels {
	title: string;
	close: string;
	properties: string;
	objects: string;
	templates: string;
	emptyProperties: string;
	emptyObjects: string;
	emptyTemplates: string;
}

export interface DrawingDockProps {
	isOpen: boolean;
	activeTab: DrawingDockTab;
	labels: DrawingDockLabels;
	position?: { x: number; y: number };
	onClose: () => void;
	onTabChange: (tab: DrawingDockTab) => void;
	headerActions?: ReactNode;
	propertiesContent?: ReactNode;
	objectsContent?: ReactNode;
	templatesContent?: ReactNode;
}

export default function DrawingDock({
	isOpen,
	activeTab,
	labels,
	position,
	onClose,
	onTabChange,
	headerActions,
	propertiesContent,
	objectsContent,
	templatesContent,
}: DrawingDockProps) {
	const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const dragStartRef = useRef<{ mouseX: number; mouseY: number; baseX: number; baseY: number } | null>(null);

	useEffect(() => {
		if (!isDragging) return;
		const handleMouseMove = (e: MouseEvent) => {
			if (!dragStartRef.current) return;
			setDragDelta({
				x: dragStartRef.current.baseX + (e.clientX - dragStartRef.current.mouseX),
				y: dragStartRef.current.baseY + (e.clientY - dragStartRef.current.mouseY),
			});
		};
		const handleMouseUp = () => setIsDragging(false);
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging]);

	if (!isOpen) {
		return null;
	}

	const left = (position?.x ?? 16) + dragDelta.x;
	const top = (position?.y ?? 16) + dragDelta.y;

	const handleHeaderMouseDown = (e: React.MouseEvent) => {
		// Ignore clicks on buttons inside the header
		if ((e.target as HTMLElement).closest("button")) return;
		e.preventDefault();
		dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, baseX: dragDelta.x, baseY: dragDelta.y };
		setIsDragging(true);
	};
	const resolvedContent = activeTab === "properties"
		? (propertiesContent ?? <div className="rsc-drawing-dock__empty">{labels.emptyProperties}</div>)
		: activeTab === "objects"
			? (objectsContent ?? <div className="rsc-drawing-dock__empty">{labels.emptyObjects}</div>)
			: (templatesContent ?? <div className="rsc-drawing-dock__empty">{labels.emptyTemplates}</div>);

	return (
		<section className="rsc-drawing-dock" style={{ left, top }} aria-label={labels.title}>
			<header
				className="rsc-drawing-dock__header"
				style={{ cursor: isDragging ? "grabbing" : "grab" }}
				onMouseDown={handleHeaderMouseDown}
			>
				<div className="rsc-drawing-dock__title-block">
					<strong>{labels.title}</strong>
					<span>{activeTab === "properties" ? labels.properties : activeTab === "objects" ? labels.objects : labels.templates}</span>
				</div>
				<div className="rsc-drawing-dock__header-actions">
					{headerActions}
					<button type="button" className="rsc-drawing-dock__icon" onClick={onClose} aria-label={labels.close}>
						x
					</button>
				</div>
			</header>
			<nav className="rsc-drawing-dock__tabs" aria-label={labels.title}>
				{([
					["properties", labels.properties],
					["objects", labels.objects],
					["templates", labels.templates],
				] as const).map(([tab, label]) => (
					<button
						key={tab}
						type="button"
						className={`rsc-drawing-dock__tab${activeTab === tab ? " rsc-drawing-dock__tab--active" : ""}`}
						aria-pressed={activeTab === tab}
						onClick={() => onTabChange(tab)}
					>
						{label}
					</button>
				))}
			</nav>
			<div className="rsc-drawing-dock__body">
				{resolvedContent}
			</div>
		</section>
	);
}