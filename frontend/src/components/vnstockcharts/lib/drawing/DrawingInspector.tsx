import { useEffect, useRef, useState } from "react";
import { overrideDrawingStyle, resolveDrawingStyle, saveDrawingTemplate, subscribeDrawingStyle } from "./drawingStyleRegistry";
import { isLineFamilyType, lineTypeFlagsFor, LINE_FAMILY_TYPES } from "./stateMachine";
import type { LineFamilyType } from "./stateMachine";
import type { DrawingObject, DrawingStyle, FibLevelConfig, DrawingAlertCondition } from "./types";

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
	/** DT-7: Fibonacci level manager labels */
	fibLevelsTitle?: string;
	fibAddLevel?: string;
	fibRemoveLevel?: string;
	/** DT-10: Drawing alert labels */
	alertTitle?: string;
	alertEnabled?: string;
	alertDirection?: string;
	alertCooldown?: string;
	alertCrossAbove?: string;
	alertCrossBelow?: string;
	alertEither?: string;
	alertCooldownSeconds?: string;
}

export interface DrawingInspectorProps {
	drawing: DrawingObject | null;
	labels: DrawingInspectorLabels;
	textEditor?: DrawingInspectorTextEditorProps;
	position?: { x: number; y: number };
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
	position,
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
	const [newLevelRatio, setNewLevelRatio] = useState("");
	const newLevelInputRef = useRef<HTMLInputElement>(null);
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
			className="rsc-drawing-inspector"
			style={{ left, top }}
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

			{/* DT-7: Fibonacci Level Manager */}
			{(drawing.type === "fibonacci" || drawing.type === "fibExtension") && drawing.fibLevelConfigs && drawing.fibLevelConfigs.length > 0 && (
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

			<div className="rsc-drawing-inspector__actions">
				<button type="button" onClick={onToggleLock} className="rsc-drawing-inspector__button">					{locked ? labels.unlock : labels.lock}
				</button>				<button type="button" onClick={onClone} className="rsc-drawing-inspector__button">
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
						onClick={() => saveDrawingTemplate(drawing.type, style)}
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
		</div>
	);
}
