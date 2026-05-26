import { useEffect, useRef, useState } from "react";
import { overrideDrawingStyle, resolveDrawingStyle, saveDrawingTemplate, subscribeDrawingStyle } from "./drawingStyleRegistry";
import { listTemplates, saveTemplate, deleteTemplate, loadTemplate } from "./drawingTemplateStorage";
import { isLineFamilyType, lineTypeFlagsFor, LINE_FAMILY_TYPES } from "./stateMachine";
import type { LineFamilyType } from "./stateMachine";
import type { DrawingObject, DrawingStyle, FibLevelConfig, DrawingAlertCondition, DrawingToolType } from "./types";
import { getSegmentKeys, hasSubSegments } from "./segmentRegistry";
import type { PlotDatum } from "./coordinateUtils";

const FIB_TOOLS_WITH_LEVEL_CONFIGS = new Set<DrawingToolType>([
	"fibonacci",
	"fibExtension",
	"fibArc",
	"fibTimeZone",
	"fibChannel",
	"fibSpeedResistanceFan",
	"fibCircles",
	"trendBasedFibTime",
	"fibWedge",
]);

export interface DrawingInspectorTextEditorLabels {
	title: string;
	label: string;
	placeholder: string;
	edit: string;
	save: string;
	cancel: string;
	empty: string;
}

export interface DrawingInspectorTextEditorProps {
	active: boolean;
	value: string;
	labels: DrawingInspectorTextEditorLabels;
	onChange: (value: string) => void;
	onStartEdit: () => void;
	onCommit: () => void;
	onCancel: () => void;
}

export interface DrawingInspectorLabels {
	title: string;
	stroke: string;
	fill: string;
	strokeWidth: string;
	lineStyle: string;
	opacity: string;
	solid: string;
	dashed: string;
	dotted: string;
	lock: string;
	unlock: string;
	clone: string;
	hide: string;
	show: string;
	bringToFront: string;
	sendToBack: string;
	delete: string;
	close: string;
	lineTypeLabel?: string;
	lineTypeTrendLine?: string;
	lineTypeRay?: string;
	lineTypeExtendedLine?: string;
	saveStyle?: string;
	templatesTitle?: string;
	templatesSave?: string;
	templatesDelete?: string;
	templatesLoad?: string;
	templatesNamePlaceholder?: string;
	/** DT-7: Fibonacci level manager labels */
	fibLevelsTitle?: string;
	fibAddLevel?: string;
	fibRemoveLevel?: string;
	/** DT-16: Risk/Reward position labels */
	rrTitle?: string;
	rrEntry?: string;
	rrStop?: string;
	rrTarget?: string;
	/** DT-17: Segment style editor labels */
	segmentsTitle?: string;
	/** DT-10: Drawing alert labels */
	alertTitle?: string;
	alertEnabled?: string;
	alertDirection?: string;
	alertCooldown?: string;
	alertCrossAbove?: string;
	alertCrossBelow?: string;
	alertEither?: string;
	alertCooldownSeconds?: string;
	coordinatesTitle?: string;
	priceLabel?: string;
	timeLabel?: string;
}

export interface DrawingInspectorProps {
	drawing: DrawingObject | null;
	labels: DrawingInspectorLabels;
	textEditor?: DrawingInspectorTextEditorProps;
	embedded?: boolean;
	position?: { x: number; y: number };
	plotData?: any[];
	onUpdate: (patch: Partial<DrawingObject>) => void;
	onDelete: () => void;
	onClone: () => void;
	onToggleLock: () => void;
	onToggleVisible: () => void;
	onBringToFront: () => void;
	onSendToBack: () => void;
	onClose: () => void;
}

function isColorString(value: string | undefined) {
	return typeof value === "string" && value.startsWith("#") ? value : "#ffffff";
}

function dashPatternFromStyle(value: DrawingStyle["strokeDasharray"]): number[] {
	switch (value) {
		case "dashed":
			return [6, 4];
		case "dotted":
			return [2, 4];
		default:
			return [];
	}
}

function updateStyle(drawing: DrawingObject, patch: Partial<DrawingStyle>): Partial<DrawingObject> {
	return {
		style: {
			...drawing.style,
			...patch,
		},
	};
}

/** DT-10-T06: Alert configuration sub-panel shown inside DrawingInspector. */
function DrawingAlertPanel({
	drawing,
	labels,
	locked,
	onUpdate,
}: {
	drawing: DrawingObject;
	labels: DrawingInspectorLabels;
	locked: boolean;
	onUpdate: (patch: Partial<DrawingObject>) => void;
}) {
	const condition = drawing.alertCondition;
	const enabled = condition?.enabled ?? false;
	const direction = condition?.direction ?? "either";
	const cooldownSec = Math.round((condition?.cooldownMs ?? 60_000) / 1000);

	function setCondition(patch: Partial<DrawingAlertCondition>) {
		const next: DrawingAlertCondition = {
			enabled,
			direction,
			cooldownMs: cooldownSec * 1000,
			triggeredAt: condition?.triggeredAt,
			...condition,
			...patch,
		};
		onUpdate({ alertCondition: next });
	}

	function toggleEnabled() {
		setCondition({ enabled: !enabled });
	}

	return (
		<div className="rsc-drawing-inspector__field">
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<strong>{labels.alertTitle ?? "🔔 Cảnh báo"}</strong>
				<input
					type="checkbox"
					checked={enabled}
					disabled={locked}
					onChange={toggleEnabled}
					aria-label={labels.alertEnabled ?? "Bật cảnh báo"}
				/>
				<span style={{ fontSize: 12 }}>{labels.alertEnabled ?? "Bật"}</span>
			</div>
			{enabled && (
				<div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
					<label style={{ fontSize: 12 }}>
						{labels.alertDirection ?? "Hướng kích hoạt"}
						<select
							value={direction}
							disabled={locked}
							style={{ marginLeft: 8, fontSize: 12 }}
							onChange={(event) => setCondition({ direction: event.target.value as DrawingAlertCondition["direction"] })}
						>
							<option value="crossAbove">{labels.alertCrossAbove ?? "Cắt lên"}</option>
							<option value="crossBelow">{labels.alertCrossBelow ?? "Cắt xuống"}</option>
							<option value="either">{labels.alertEither ?? "Cả hai"}</option>
						</select>
					</label>
					<label style={{ fontSize: 12 }}>
						{labels.alertCooldown ?? "Cooldown (giây)"}
						<input
							type="number"
							min="5"
							max="3600"
							step="5"
							value={cooldownSec}
							disabled={locked}
							style={{ marginLeft: 8, width: 64, fontSize: 12, padding: "1px 4px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)" }}
							onChange={(event) => setCondition({ cooldownMs: Number(event.target.value) * 1000 })}
							aria-label={labels.alertCooldownSeconds ?? "giây"}
						/>
						{" "}{labels.alertCooldownSeconds ?? "giây"}
					</label>
				</div>
			)}
		</div>
	);
}

export default function DrawingInspector({
	drawing,
	labels,
	textEditor,
	embedded = false,
	position,
	plotData = [],
	onUpdate,
	onDelete,
	onClone,
	onToggleLock,
	onToggleVisible,
	onBringToFront,
	onSendToBack,
	onClose,
}: DrawingInspectorProps) {
	const [, setStyleRevision] = useState(0);
	const [activeTab, setActiveTab] = useState<"style" | "coordinates" | "templates">("style");
	const [templatesList, setTemplatesList] = useState<string[]>([]);
	const [selectedTemplate, setSelectedTemplate] = useState<string>("");
	const [newTemplateName, setNewTemplateName] = useState<string>("");
	const [newLevelRatio, setNewLevelRatio] = useState("");
	const newLevelInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (drawing) {
			setTemplatesList(listTemplates(drawing.type));
			setSelectedTemplate("");
			setNewTemplateName("");
		}
	}, [drawing?.type]);

	const handleSaveTemplate = () => {
		if (!drawing) return;
		const name = newTemplateName.trim();
		if (!name) return;
		saveTemplate(drawing.type, name, resolveDrawingStyle(drawing));
		const updatedList = listTemplates(drawing.type);
		setTemplatesList(updatedList);
		setSelectedTemplate(name);
		setNewTemplateName("");
	};

	const handleDeleteTemplate = () => {
		if (!drawing || !selectedTemplate) return;
		deleteTemplate(drawing.type, selectedTemplate);
		const updatedList = listTemplates(drawing.type);
		setTemplatesList(updatedList);
		setSelectedTemplate("");
	};

	const handleLoadTemplate = () => {
		if (!drawing || !selectedTemplate) return;
		const tempStyle = loadTemplate(drawing.type, selectedTemplate);
		if (tempStyle) {
			onUpdate({ style: { ...drawing.style, ...tempStyle } });
		}
	};
	useEffect(() => {
		if (!drawing) {
			return undefined;
		}
		return subscribeDrawingStyle(drawing.id, () => {
			setStyleRevision((value) => value + 1);
		});
	}, [drawing]);

	if (!drawing) {
		return null;
	}

	function addNewFibLevel() {
		if (!drawing) return;
		const parsed = parseFloat(newLevelRatio);
		if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) return;
		const configs = drawing.fibLevelConfigs ?? [];
		if (configs.some((c) => Math.abs(c.ratio - parsed) < 0.0001)) return; // duplicate guard
		const updated: FibLevelConfig[] = [...configs, { ratio: parsed, visible: true }];
		onUpdate({ fibLevelConfigs: updated });
		setNewLevelRatio("");
		newLevelInputRef.current?.focus();
	}

	const effectiveDrawing = {
		...drawing,
		style: resolveDrawingStyle(drawing),
	};
	const style = effectiveDrawing.style;
	const locked = drawing.locked === true;
	const visible = drawing.visible !== false;
	const strokeDasharray = style.strokeDasharray ?? "solid";
	const left = position?.x ?? 16;
	const top = position?.y ?? 16;

	return (
		<div
			className={`rsc-drawing-inspector${embedded ? " rsc-drawing-inspector--embedded" : ""}`}
			style={embedded ? undefined : { left, top }}
			role="toolbar"
			aria-label={labels.title}
		>
			<div className="rsc-drawing-inspector__header">
				<div className="rsc-drawing-inspector__title">
					<strong>{labels.title}</strong>
					<span>{drawing.type}</span>
				</div>
				<button type="button" className="rsc-drawing-inspector__icon" onClick={onClose} aria-label={labels.close}>
					x
				</button>
			</div>

			<div className="rsc-drawing-inspector__tabs" style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "12px", background: "rgba(0,0,0,0.15)" }}>
				<button 
					type="button" 
					style={{
						flex: 1, 
						padding: "8px 12px", 
						fontSize: "11px", 
						fontWeight: "bold", 
						background: activeTab === "style" ? "rgba(255,255,255,0.05)" : "transparent",
						border: "none",
						borderBottom: activeTab === "style" ? "2px solid #0891b2" : "none",
						color: activeTab === "style" ? "#fff" : "#888",
						cursor: "pointer",
						outline: "none"
					}}
					onClick={() => setActiveTab("style")}
				>
					{labels.title}
				</button>
				<button 
					type="button" 
					style={{
						flex: 1, 
						padding: "8px 12px", 
						fontSize: "11px", 
						fontWeight: "bold", 
						background: activeTab === "coordinates" ? "rgba(255,255,255,0.05)" : "transparent",
						border: "none",
						borderBottom: activeTab === "coordinates" ? "2px solid #0891b2" : "none",
						color: activeTab === "coordinates" ? "#fff" : "#888",
						cursor: "pointer",
						outline: "none"
					}}
					onClick={() => setActiveTab("coordinates")}
				>
					{labels.coordinatesTitle ?? "Tọa độ"}
				</button>
				<button 
					type="button" 
					style={{
						flex: 1, 
						padding: "8px 12px", 
						fontSize: "11px", 
						fontWeight: "bold", 
						background: activeTab === "templates" ? "rgba(255,255,255,0.05)" : "transparent",
						border: "none",
						borderBottom: activeTab === "templates" ? "2px solid #0891b2" : "none",
						color: activeTab === "templates" ? "#fff" : "#888",
						cursor: "pointer",
						outline: "none"
					}}
					onClick={() => setActiveTab("templates")}
				>
					{labels.templatesTitle ?? "Mẫu"}
				</button>
			</div>

			{activeTab === "style" && (
				<>

			<div className="rsc-drawing-inspector__swatches">
				<label className="rsc-drawing-inspector__field">
					<span>{labels.stroke}</span>
					<input
						type="color"
						value={isColorString(style.stroke)}
						onChange={(event) => overrideDrawingStyle(drawing.id, { color: event.target.value })}
						aria-label={labels.stroke}
					/>
				</label>
				<label className="rsc-drawing-inspector__field">
					<span>{labels.fill}</span>
					<input
						type="color"
						value={isColorString(style.fill)}
						onChange={(event) => onUpdate(updateStyle(drawing, { fill: event.target.value }))}
						aria-label={labels.fill}
					/>
				</label>
			</div>

			<div className="rsc-drawing-inspector__field">
				<label>
					<span>{labels.strokeWidth}</span>
					<input
						type="range"
						min="1"
						max="5"
						step="1"
						value={style.strokeWidth}
						onChange={(event) => overrideDrawingStyle(drawing.id, { lineWidth: Number(event.target.value) })}
						aria-label={labels.strokeWidth}
					/>
				</label>
			</div>

			<div className="rsc-drawing-inspector__field">
				<label>
					<span>{labels.lineStyle}</span>
					<select
						value={strokeDasharray}
						onChange={(event) => overrideDrawingStyle(drawing.id, { dashPattern: dashPatternFromStyle(event.target.value as DrawingStyle["strokeDasharray"]) })}
						aria-label={labels.lineStyle}
					>
						<option value="solid">{labels.solid}</option>
						<option value="dashed">{labels.dashed}</option>
						<option value="dotted">{labels.dotted}</option>
					</select>
				</label>
			</div>

			<div className="rsc-drawing-inspector__field">
				<label>
					<span>{labels.opacity}</span>
					<input
						type="range"
						min="0.1"
						max="1"
						step="0.05"
						value={style.opacity ?? 1}
						onChange={(event) => overrideDrawingStyle(drawing.id, { opacity: Number(event.target.value) })}
						aria-label={labels.opacity}
					/>
				</label>
			</div>

			{isLineFamilyType(drawing.type) && labels.lineTypeLabel && (
				<div className="rsc-drawing-inspector__field">
					<span>{labels.lineTypeLabel}</span>
					<div className="rsc-drawing-inspector__radio-group" role="radiogroup" aria-label={labels.lineTypeLabel}>
						{(LINE_FAMILY_TYPES as readonly LineFamilyType[]).map((lt) => {
							const labelText =
								lt === "trendLine" ? (labels.lineTypeTrendLine ?? "Đoạn thẳng") :
								lt === "ray" ? (labels.lineTypeRay ?? "Tia") :
								(labels.lineTypeExtendedLine ?? "Đường thẳng");
							return (
								<label key={lt} className="rsc-drawing-inspector__radio-option">
									<input
										type="radio"
										name={`drawing-line-type-${drawing.id}`}
										value={lt}
										checked={drawing.type === lt}
										disabled={locked}
										onChange={() => onUpdate(lineTypeFlagsFor(lt))}
									/>
									{labelText}
								</label>
							);
						})}
					</div>
				</div>
			)}

			{/* GAP-15: Persistent measurement toggle for trendLine and channel */}
			{(drawing.type === "trendLine" || drawing.type === "channel") && (
				<label className="rsc-drawing-inspector__field" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={drawing.showMeasurement === true}
						disabled={locked}
						onChange={() => onUpdate({ showMeasurement: !drawing.showMeasurement })}
					/>
					<span>Hiện số đo thường trực</span>
				</label>
			)}

			{/* DT-7: Fibonacci Level Manager */}
			{FIB_TOOLS_WITH_LEVEL_CONFIGS.has(drawing.type) && drawing.fibLevelConfigs && drawing.fibLevelConfigs.length > 0 && (
				<div className="rsc-drawing-inspector__field">
					<strong>{labels.fibLevelsTitle ?? "Các mức Fibonacci"}</strong>
					<div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
						{drawing.fibLevelConfigs.map((cfg, idx) => {
							const configs = drawing.fibLevelConfigs!;
							return (
								<div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
									<input
										type="checkbox"
										checked={cfg.visible}
										disabled={locked}
										aria-label={`${(cfg.ratio * 100).toFixed(1)}%`}
										onChange={() => {
											const updated: FibLevelConfig[] = configs.map((c, i) =>
												i === idx ? { ...c, visible: !c.visible } : c,
											);
											onUpdate({ fibLevelConfigs: updated });
										}}
									/>
									<span style={{ minWidth: 48, fontSize: 11 }}>{(cfg.ratio * 100).toFixed(1)}%</span>
									<input
										type="color"
										value={cfg.color ?? drawing.style.stroke}
										disabled={locked}
										style={{ width: 24, height: 24, cursor: "pointer", border: "none", padding: 0, background: "none" }}
										aria-label={`color-${(cfg.ratio * 100).toFixed(1)}`}
										onChange={(event) => {
											const updated: FibLevelConfig[] = configs.map((c, i) =>
												i === idx ? { ...c, color: event.target.value } : c,
											);
											onUpdate({ fibLevelConfigs: updated });
										}}
									/>
									<button
										type="button"
										className="rsc-drawing-inspector__button rsc-drawing-inspector__button--danger"
										style={{ padding: "1px 6px", fontSize: 11 }}
										disabled={locked || configs.length <= 1}
										onClick={() => {
											const updated = configs.filter((_, i) => i !== idx);
											onUpdate({ fibLevelConfigs: updated });
										}}
									>
										{labels.fibRemoveLevel ?? "Xóa"}
									</button>
								</div>
							);
						})}
					</div>
					{!locked && (
						<div style={{ display: "flex", gap: 6, marginTop: 8 }}>
							<input
								ref={newLevelInputRef}
								type="number"
								min="0"
								max="10"
								step="0.001"
								value={newLevelRatio}
								placeholder="0.5"
								style={{ width: 72, padding: "2px 6px", fontSize: 11, borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)" }}
								onChange={(event) => setNewLevelRatio(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addNewFibLevel();
									}
								}}
								aria-label={labels.fibAddLevel ?? "Thêm mức"}
							/>
							<button
								type="button"
								className="rsc-drawing-inspector__button"
								style={{ fontSize: 11 }}
								onClick={addNewFibLevel}
							>
								{labels.fibAddLevel ?? "Thêm mức"}
							</button>
						</div>
					)}
				</div>
			)}

			{/* DT-16-T03: LongPosition / ShortPosition direct price input */}
			{(drawing.type === "longPosition" || drawing.type === "shortPosition") && (
				<div className="rsc-drawing-inspector__field">
					<strong style={{ fontSize: 12 }}>{labels.rrTitle ?? "Vào lệnh"}</strong>
					{(["entry", "stop", "target"] as const).map((field) => {
						const fieldLabel =
							field === "entry" ? (labels.rrEntry ?? "Entry") :
							field === "stop" ? (labels.rrStop ?? "Stop") :
							(labels.rrTarget ?? "Target");
						const currentValue = drawing.riskReward?.[field] ?? "";
						return (
							<label key={field} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 4 }}>
								<span style={{ width: 44, flexShrink: 0 }}>{fieldLabel}</span>
								<input
									type="number"
									step="any"
									min="0.001"
									value={currentValue}
									disabled={locked}
									style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(148,163,184,0.4)", background: "transparent", color: "inherit" }}
									onChange={(e) => {
										const val = parseFloat(e.target.value);
										if (!Number.isFinite(val) || val <= 0) return;
										const rr = { ...(drawing.riskReward ?? { entry: 0, stop: 0, target: 0 }) };
										rr[field] = val;
										onUpdate({ riskReward: rr });
									}}
								/>
							</label>
						);
					})}
					{(() => {
						const rr = drawing.riskReward;
						if (!rr || !rr.entry || !rr.stop || !rr.target) return null;
						const risk = Math.abs(rr.entry - rr.stop);
						const reward = Math.abs(rr.target - rr.entry);
						const ratio = risk > 0 ? (reward / risk).toFixed(1) : "n/a";
						return <span style={{ fontSize: 11, marginTop: 4, opacity: 0.7, display: "block" }}>R/R 1:{ratio}</span>;
					})()}
				</div>
			)}

			{/* DT-17-T04: Per-segment style editor */}
			{hasSubSegments(drawing.type) && (
				<div className="rsc-drawing-inspector__field">
					<strong style={{ fontSize: 12 }}>{labels.segmentsTitle ?? "Thành phần"}</strong>
					{getSegmentKeys(drawing.type).map((key) => {
						const segStyle = drawing.segmentStyles?.[key];
						const segVisible = drawing.segmentVisible?.[key] !== false;
						const currentColor = segStyle?.stroke ?? drawing.style.stroke;
						return (
							<label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 4 }}>
								<input
									type="checkbox"
									checked={segVisible}
									disabled={locked}
									onChange={(e) => {
										onUpdate({ segmentVisible: { ...(drawing.segmentVisible ?? {}), [key]: e.target.checked } });
									}}
								/>
								<span style={{ flex: 1 }}>{key}</span>
								<input
									type="color"
									value={currentColor}
									disabled={locked}
									style={{ width: 28, height: 24, padding: 1, border: "none", background: "none", cursor: locked ? "default" : "pointer" }}
									onChange={(e) => {
										onUpdate({ segmentStyles: { ...(drawing.segmentStyles ?? {}), [key]: { ...(drawing.segmentStyles?.[key] ?? {}), stroke: e.target.value } } });
									}}
								/>
							</label>
						);
					})}
				</div>
			)}

			<div className="rsc-drawing-inspector__actions">				<button type="button" onClick={onClone} className="rsc-drawing-inspector__button">
					{labels.clone}
				</button>
				<button type="button" onClick={onToggleVisible} className="rsc-drawing-inspector__button">
					{visible ? labels.hide : labels.show}
				</button>
				<button type="button" onClick={onBringToFront} className="rsc-drawing-inspector__button">
					{labels.bringToFront}
				</button>
				<button type="button" onClick={onSendToBack} className="rsc-drawing-inspector__button">
					{labels.sendToBack}
				</button>
				<button type="button" onClick={onDelete} className="rsc-drawing-inspector__button rsc-drawing-inspector__button--danger" disabled={locked}>
					{labels.delete}
				</button>
				{labels.saveStyle && (
					<button
						type="button"
						className="rsc-drawing-inspector__button"
						onClick={() => {
							saveDrawingTemplate(drawing.type, style);
							if (hasSubSegments(drawing.type) && drawing.segmentStyles) {
								try {
									localStorage.setItem(`rsc-drawing-template-segs-${drawing.type}`, JSON.stringify(drawing.segmentStyles));
								} catch { /* ignore */ }
							}
						}}
					>
						{labels.saveStyle}
					</button>
				)}
			</div>

				{/* DT-10-T06: Drawing Alert Panel */}
		<DrawingAlertPanel drawing={drawing} labels={labels} locked={locked} onUpdate={onUpdate} />

		{drawing.type === "text" && textEditor && (
				<div className="rsc-drawing-inspector__field">
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
						<strong>{textEditor.labels.title}</strong>
						{!textEditor.active && (
							<button type="button" className="rsc-drawing-inspector__button" onClick={textEditor.onStartEdit} disabled={locked}>
								{textEditor.labels.edit}
							</button>
						)}
					</div>
					<span>{textEditor.labels.label}</span>
					{textEditor.active ? (
						<>
							<textarea
								value={textEditor.value}
								placeholder={textEditor.labels.placeholder}
								onChange={(event) => textEditor.onChange(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Escape") {
										event.preventDefault();
										textEditor.onCancel();
										return;
									}
									if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
										event.preventDefault();
										textEditor.onCommit();
									}
								}}
								rows={4}
								style={{
									width: "100%",
									resize: "vertical",
									borderRadius: 10,
									border: "1px solid rgba(148, 163, 184, 0.36)",
									padding: "10px 12px",
									font: "inherit",
									background: "rgba(15, 23, 42, 0.04)",
									color: "inherit",
								}}
							/>
							<div className="rsc-drawing-inspector__actions">
								<button type="button" className="rsc-drawing-inspector__button" onClick={textEditor.onCommit}>
									{textEditor.labels.save}
								</button>
								<button type="button" className="rsc-drawing-inspector__button" onClick={textEditor.onCancel}>
									{textEditor.labels.cancel}
								</button>
							</div>
						</>
					) : (
						<div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, opacity: 0.92, marginTop: 6 }}>
							{drawing.text?.trim().length ? drawing.text : textEditor.labels.empty}
						</div>
					)}
				</div>
			)}
			</>
			)}

			{activeTab === "coordinates" && (
				<div className="rsc-drawing-inspector__coordinates" style={{ display: "flex", flexDirection: "column", padding: "0 12px 12px 12px", maxHeight: "320px", overflowY: "auto" }}>
					{drawing.points.map((point, index) => {
						const pointLabel = drawing.waveLabels?.[index] || `Điểm ${index + 1}`;
						const dateVal = new Date(point.x);
						const timeString = Number.isFinite(dateVal.getTime()) 
							? new Date(dateVal.getTime() - dateVal.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
							: "";
						
						return (
							<div key={index} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
								<span style={{ fontSize: "11px", fontWeight: "bold", color: "#0891b2", display: "block", marginBottom: 6 }}>{pointLabel}</span>
								<div style={{ display: "flex", gap: 8 }}>
									<label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, fontSize: "10px", color: "#a3a3a3" }}>
										{labels.priceLabel ?? "Giá"}
										<input
											type="number"
											step="any"
											value={point.y}
											disabled={locked}
											style={{
												width: "100%",
												padding: "4px 6px",
												fontSize: "11px",
												background: "rgba(0,0,0,0.3)",
												border: "1px solid rgba(255,255,255,0.08)",
												borderRadius: "4px",
												color: "#fff",
												outline: "none"
											}}
											onChange={(e) => {
												const val = parseFloat(e.target.value);
												if (!Number.isFinite(val)) return;
												const nextPoints = [...drawing.points];
												nextPoints[index] = { ...point, y: val };
												onUpdate({ points: nextPoints });
											}}
										/>
									</label>
									<label style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 4, fontSize: "10px", color: "#a3a3a3" }}>
										{labels.timeLabel ?? "Thời gian"}
										<input
											type="datetime-local"
											value={timeString}
											disabled={locked}
											style={{
												width: "100%",
												padding: "3px 4px",
												fontSize: "11px",
												background: "rgba(0,0,0,0.3)",
												border: "1px solid rgba(255,255,255,0.08)",
												borderRadius: "4px",
												color: "#fff",
												outline: "none"
											}}
											onChange={(e) => {
												const mappedX = validateAndMapXCoordinate(e.target.value, plotData);
												if (mappedX !== null) {
													const nextPoints = [...drawing.points];
													nextPoints[index] = { ...point, x: mappedX };
													onUpdate({ points: nextPoints });
												}
											}}
										/>
									</label>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{activeTab === "templates" && (
				<div className="rsc-drawing-inspector__templates-tab" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "0 12px 12px 12px" }}>
					<div className="rsc-drawing-inspector__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						<label htmlFor="inspector-template-select" style={{ fontSize: "11px", fontWeight: "bold", color: "#888" }}>
							{labels.templatesLoad ?? "Tải Mẫu"}
						</label>
						<div style={{ display: "flex", gap: "6px" }}>
							<select
								id="inspector-template-select"
								value={selectedTemplate}
								onChange={(e) => setSelectedTemplate(e.target.value)}
								style={{
									flex: 1,
									background: "rgba(30, 41, 59, 0.9)",
									border: "1px solid rgba(255, 255, 255, 0.1)",
									borderRadius: "4px",
									padding: "6px 8px",
									color: "#fff",
									fontSize: "12px",
								}}
							>
								<option value="">-- Chọn mẫu --</option>
								{templatesList.map((name) => (
									<option key={name} value={name}>
										{name}
									</option>
								))}
							</select>
							<button
								type="button"
								onClick={handleLoadTemplate}
								disabled={!selectedTemplate || locked}
								style={{
									background: selectedTemplate ? "#0891b2" : "rgba(255,255,255,0.05)",
									border: "none",
									borderRadius: "4px",
									padding: "6px 12px",
									color: selectedTemplate ? "#fff" : "#666",
									fontSize: "12px",
									cursor: selectedTemplate ? "pointer" : "default",
								}}
							>
								{labels.templatesLoad ?? "Tải"}
							</button>
							<button
								type="button"
								onClick={handleDeleteTemplate}
								disabled={!selectedTemplate || locked}
								style={{
									background: selectedTemplate ? "#ef5350" : "rgba(255,255,255,0.05)",
									border: "none",
									borderRadius: "4px",
									padding: "6px 12px",
									color: selectedTemplate ? "#fff" : "#666",
									fontSize: "12px",
									cursor: selectedTemplate ? "pointer" : "default",
								}}
							>
								{labels.templatesDelete ?? "Xóa"}
							</button>
						</div>
					</div>

					<div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />

					<div className="rsc-drawing-inspector__field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
						<label htmlFor="inspector-template-new-name" style={{ fontSize: "11px", fontWeight: "bold", color: "#888" }}>
							{labels.templatesSave ?? "Lưu dưới tên"}
						</label>
						<div style={{ display: "flex", gap: "6px" }}>
							<input
								id="inspector-template-new-name"
								type="text"
								placeholder={labels.templatesNamePlaceholder ?? "Tên mẫu mới..."}
								value={newTemplateName}
								disabled={locked}
								onChange={(e) => setNewTemplateName(e.target.value)}
								style={{
									flex: 1,
									background: "rgba(30, 41, 59, 0.9)",
									border: "1px solid rgba(255, 255, 255, 0.1)",
									borderRadius: "4px",
									padding: "6px 8px",
									color: "#fff",
									fontSize: "12px",
								}}
							/>
							<button
								type="button"
								onClick={handleSaveTemplate}
								disabled={!newTemplateName.trim() || locked}
								style={{
									background: newTemplateName.trim() ? "#0891b2" : "rgba(255,255,255,0.05)",
									border: "none",
									borderRadius: "4px",
									padding: "6px 12px",
									color: newTemplateName.trim() ? "#fff" : "#666",
									fontSize: "12px",
									cursor: newTemplateName.trim() ? "pointer" : "default",
								}}
							>
								{labels.templatesSave ?? "Lưu"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function validateAndMapXCoordinate(inputTimeString: string, plotData: any[]): number | null {
	if (!inputTimeString) return null;
	const T = new Date(inputTimeString).getTime();
	if (!Number.isFinite(T) || plotData.length === 0) return null;
	
	let nearestBar = plotData[0]!;
	let minDiff = Math.abs(new Date(plotData[0]!.date).getTime() - T);
	
	for (const bar of plotData) {
		const barTime = new Date(bar.date).getTime();
		const diff = Math.abs(barTime - T);
		if (diff < minDiff) {
			minDiff = diff;
			nearestBar = bar;
		}
	}
	return new Date(nearestBar.date).getTime();
}
