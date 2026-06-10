import { useCallback, useMemo, useState } from "react";
import type { DrawingObject, DrawingToolType } from "./types";

const STORAGE_KEY = "rsc-drawing-list-collapsed-groups";

export interface DrawingListPanelLabels {
	title: string;
	empty: string;
	visible: string;
	hidden: string;
	locked: string;
	unlocked: string;
	selected: string;
	delete: string;
	/** Optional search input placeholder; renders a search box when provided. */
	search?: string;
}

export interface DrawingListPanelProps {
	drawings: DrawingObject[];
	selectedId: string | null;
	labels: DrawingListPanelLabels;
	embedded?: boolean;
	position?: { x: number; y: number };
	onSelect: (id: string) => void;
	onToggleVisible: (id: string) => void;
	onToggleLocked: (id: string) => void;
	onDelete: (id: string) => void;
	/** GAP-10: Optional callback to reorder drawings (enables drag-and-drop). */
	onReorderDrawings?: (reorderedDrawings: DrawingObject[]) => void;
}

const TOOL_LABELS: Record<DrawingToolType, string> = {
	trendLine: "Đường xu hướng",
	ray: "Tia",
	extendedLine: "Đường kéo dài",
	hLine: "Đường ngang",
	vLine: "Đường dọc",
	channel: "Kênh giá",
	parallelChannel: "Kênh song song",
	arrow: "Mũi tên",
	text: "Văn bản",
	fibonacci: "Fibonacci",
	fibExtension: "Fib mở rộng",
	fibArc: "Cung Fibonacci",
	fibTimeZone: "Vùng thời gian Fib",
	gannFan: "Gann Fan",
	elliottImpulse: "Elliott Impulse",
	elliottCorrection: "Elliott Correction",
	elliottTriangle: "Elliott Triangle",
	elliottDoubleCombo: "Elliott Double Combo",
	elliottTripleCombo: "Elliott Triple Combo",
	xabcdPattern: "XABCD Pattern",
	cypherPattern: "Cypher Pattern",
	headAndShoulders: "Head & Shoulders",
	trianglePattern: "Triangle Pattern",
	threeDrivesPattern: "Three Drives Pattern",
	// DT-13: Extended Fibonacci
	fibChannel: "Fib Channel",
	fibSpeedResistanceFan: "Fib Speed Resistance Fan",
	trendBasedFibTime: "Trend-Based Fib Time",
	fibCircles: "Fib Circles",
	fibSpiral: "Fib Spiral",
	fibSpeedResistanceArcs: "Fib Speed Resistance Arcs",
	fibWedge: "Fib Wedge",
	pitchfan: "Pitchfan",
	// DT-14: Gann Advanced
	gannBox: "Gann Box",
	gannSquareFixed: "Gann Square Fixed",
	gannSquare: "Gann Square",
	// DT-15: Cycle Tools
	cyclicLines: "Cyclic Lines",
	timeCycles: "Time Cycles",
	sineLine: "Sine Line",
	rectangle: "Hình chữ nhật",
	polyline: "Đa tuyến",
	dateAndPriceRange: "Vùng giá-ngày",
	longPosition: "Vị thế mua",
	shortPosition: "Vị thế bán",
	pitchfork: "Pitchfork",
	abcdPattern: "Mẫu ABCD",
	regressionChannel: "Kênh hồi quy",
};

export function generateDrawingLabel(drawing: DrawingObject): string {
	if (drawing.label?.trim()) {
		return drawing.label.trim();
	}
	return TOOL_LABELS[drawing.type] ?? drawing.type;
}

/** GAP-10: Filter drawings by case-insensitive match on tool label or custom label. */
export function filterDrawings(drawings: DrawingObject[], query: string): DrawingObject[] {
	const q = query.trim().toLowerCase();
	if (!q) return drawings;
	return drawings.filter((d) => {
		const toolLabel = (TOOL_LABELS[d.type] ?? d.type).toLowerCase();
		const rawType = d.type.toLowerCase();
		const customLabel = (d.label ?? "").toLowerCase();
		return toolLabel.includes(q) || rawType.includes(q) || customLabel.includes(q);
	});
}

/** GAP-10: Immutably reorder drawings by moving fromId to the position of toId. */
export function reorderDrawings(drawings: DrawingObject[], fromId: string, toId: string): DrawingObject[] {
	const fromIdx = drawings.findIndex((d) => d.id === fromId);
	const toIdx = drawings.findIndex((d) => d.id === toId);
	if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return drawings;
	const result = [...drawings];
	const [item] = result.splice(fromIdx, 1);
	result.splice(toIdx, 0, item);
	return result;
}

function formatTimestamp(timestamp: number) {
	try {
		return new Intl.DateTimeFormat(undefined, {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(timestamp));
	} catch {
		return new Date(timestamp).toISOString();
	}
}

function loadCollapsedGroups(): Set<string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return new Set();
		}
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			return new Set(parsed.filter((v): v is string => typeof v === "string"));
		}
	} catch {
		// ignore
	}
	return new Set();
}

function saveCollapsedGroups(groups: Set<string>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
	} catch {
		// ignore
	}
}

export default function DrawingListPanel({ drawings, selectedId, labels, embedded = false, position, onSelect, onToggleVisible, onToggleLocked, onDelete, onReorderDrawings }: DrawingListPanelProps) {
	const left = position?.x ?? 16;
	const top = position?.y ?? 120;

	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);
	const [searchQuery, setSearchQuery] = useState("");
	const [dragFromId, setDragFromId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);

	const toggleGroup = useCallback((groupType: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupType)) {
				next.delete(groupType);
			} else {
				next.add(groupType);
			}
			saveCollapsedGroups(next);
			return next;
		});
	}, []);

	const grouped = useMemo<Map<DrawingToolType, DrawingObject[]>>(() => {
		const map = new Map<DrawingToolType, DrawingObject[]>();
		for (const drawing of drawings) {
			const existing = map.get(drawing.type);
			if (existing) {
				existing.push(drawing);
			} else {
				map.set(drawing.type, [drawing]);
			}
		}
		return map;
	}, [drawings]);

	const isSearching = searchQuery.trim().length > 0;
	const filteredDrawings = useMemo(() => filterDrawings(drawings, searchQuery), [drawings, searchQuery]);
	const displayedCount = isSearching ? filteredDrawings.length : drawings.length;

	const renderDrawingItem = (drawing: DrawingObject) => {
		const isSelected = drawing.id === selectedId;
		const isHidden = drawing.visible === false;
		const isLocked = drawing.locked === true;
		const isDragOver = dragOverId === drawing.id && dragFromId !== drawing.id;
		return (
			<div
				key={drawing.id}
				className={`rsc-drawing-list-panel__item${isSelected ? " rsc-drawing-list-panel__item--selected" : ""}${isHidden ? " rsc-drawing-list-panel__item--hidden" : ""}${isDragOver ? " rsc-drawing-list-panel__item--drag-over" : ""}`}
				draggable={!!onReorderDrawings}
				onDragStart={onReorderDrawings ? (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drawing.id); setDragFromId(drawing.id); } : undefined}
				onDragOver={onReorderDrawings ? (e) => { e.preventDefault(); setDragOverId(drawing.id); } : undefined}
				onDrop={onReorderDrawings ? (e) => { e.preventDefault(); const fromId = e.dataTransfer.getData("text/plain"); if (fromId && fromId !== drawing.id) { onReorderDrawings(reorderDrawings(drawings, fromId, drawing.id)); } setDragFromId(null); setDragOverId(null); } : undefined}
				onDragEnd={onReorderDrawings ? () => { setDragFromId(null); setDragOverId(null); } : undefined}
			>
				<button type="button" className="rsc-drawing-list-panel__select" onClick={() => onSelect(drawing.id)}>
					<span className="rsc-drawing-list-panel__label">{generateDrawingLabel(drawing)}</span>
					<span className="rsc-drawing-list-panel__meta">{formatTimestamp(drawing.createdAt)}</span>
				</button>
				<div className="rsc-drawing-list-panel__actions">
					{isSelected && <span className="rsc-drawing-list-panel__badge rsc-drawing-list-panel__badge--selected">{labels.selected}</span>}
					<button
						type="button"
						className={`rsc-drawing-list-panel__icon${isHidden ? " rsc-drawing-list-panel__icon--active" : ""}`}
						title={isHidden ? labels.visible : labels.hidden}
						onClick={() => onToggleVisible(drawing.id)}
					>
						{isHidden ? "👁️" : "◉"}
					</button>
					<button
						type="button"
						className={`rsc-drawing-list-panel__icon${isLocked ? " rsc-drawing-list-panel__icon--active" : ""}`}
						title={isLocked ? labels.unlocked : labels.locked}
						onClick={() => onToggleLocked(drawing.id)}
					>
						{isLocked ? "🔒" : "🔓"}
					</button>
					<button
						type="button"
						className="rsc-drawing-list-panel__icon rsc-drawing-list-panel__icon--delete"
						title={labels.delete}
						onClick={() => onDelete(drawing.id)}
						disabled={isLocked}
					>
						×
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className={`rsc-drawing-list-panel${embedded ? " rsc-drawing-list-panel--embedded" : ""}`} style={embedded ? undefined : { left, top }}>
			<div className="rsc-drawing-list-panel__header">
				<strong>{labels.title}</strong>
				<span className="rsc-drawing-list-panel__count">{displayedCount}</span>
			</div>
			{labels.search !== undefined && (
				<div className="rsc-drawing-list-panel__search">
					<input
						type="search"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder={labels.search}
						className="rsc-drawing-list-panel__search-input"
					/>
				</div>
			)}
			{displayedCount === 0 ? (
				<div className="rsc-drawing-list-panel__empty">{labels.empty}</div>
			) : isSearching ? (
				<div className="rsc-drawing-list-panel__items">
					{filteredDrawings.map(renderDrawingItem)}
				</div>
			) : (
				<div className="rsc-drawing-list-panel__items">
					{[...grouped.entries()].map(([toolType, groupDrawings]) => {
						const isCollapsed = collapsedGroups.has(toolType);
						const groupLabel = TOOL_LABELS[toolType] ?? toolType;
						return (
							<div key={toolType} className="rsc-drawing-list-panel__group">
								<button
									type="button"
									className="rsc-drawing-list-panel__group-header"
									onClick={() => toggleGroup(toolType)}
									aria-expanded={!isCollapsed}
								>
									<span className="rsc-drawing-list-panel__group-caret">{isCollapsed ? "▶" : "▼"}</span>
									<span className="rsc-drawing-list-panel__group-name">{groupLabel}</span>
									<span className="rsc-drawing-list-panel__group-count">{groupDrawings.length}</span>
								</button>
								{!isCollapsed && groupDrawings.map(renderDrawingItem)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

