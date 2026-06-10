import { createDraftFromTool, createTool, getDrawingPlugin, isDrawingToolName, listDrawingPlugins, listDrawingTools, registerDrawingPlugin, registerDrawingTool } from "./registry";
import type { DrawingAction, DrawingState } from "./stateMachine";
import { drawingReducer } from "./stateMachine";
import type { DrawingHistory } from "./history";
import { createDrawingHistory, historyReducer } from "./history";
import type { ChartScales, PlotDatum } from "./coordinateUtils";
import { chartPointToPixel, pixelToChartPoint } from "./coordinateUtils";
import {
	buildRenderScalesFromBridge,
	chartPointToPixelWithBridge,
	measurementPointToPixelWithBridge,
	resolveChartPointWithBridge,
	resolveMeasurementPointWithBridge,
} from "./coordinateBridge";
import { measurementPointToPixel, resolveMeasurementPoint, summarizeMeasurement } from "./measuring";
import { createLocalStorageAdapter, DrawingImportError } from "./DrawingStorage";
import {
	deserializeDrawingHistory,
	deserializeDrawingObject,
	deserializeDrawings,
	serializeDrawingHistory,
	serializeDrawingObject,
	serializeDrawings,
	exportDrawingsJSON,
	importDrawingsJSON,
} from "./serialization";
import TrendLine from "./builtin/trendLine";
import HLine from "./builtin/hLine";
import VLine from "./builtin/vLine";
import Fibonacci from "./builtin/fibonacci";
import Channel from "./builtin/channel";
import Text from "./builtin/text";
import Rectangle from "./builtin/rectangle";
import Arrow from "./builtin/arrow";
import Ray from "./builtin/ray";
import ExtendedLine from "./builtin/extendedLine";
import Polyline from "./builtin/polyline";
import DateAndPriceRange from "./builtin/dateAndPriceRange";
import LongPosition from "./builtin/longPosition";
import ShortPosition from "./builtin/shortPosition";
import FibExtension from "./builtin/fibExtension";
import ParallelChannel from "./builtin/parallelChannel";
import Pitchfork from "./builtin/pitchfork";
import AbcdPattern from "./builtin/abcdPattern";
import FibArc from "./builtin/fibArc";
import FibTimeZone from "./builtin/fibTimeZone";
import RegressionChannel from "./builtin/regressionChannel";
import GannFan from "./builtin/gannFan";
import { ElliottImpulse, ElliottCorrection, ElliottTriangle, ElliottDoubleCombo, ElliottTripleCombo } from "./builtin/elliottWaves";
import { XabcdPattern, CypherPattern, HeadAndShoulders, TrianglePattern, ThreeDrivesPattern } from "./builtin/harmonicPatterns";
import { FibChannel, FibSpeedResistanceFan, TrendBasedFibTime, FibCircles, FibSpiral, FibSpeedResistanceArcs, FibWedge, Pitchfan } from "./builtin/fibExtended";
import { GannBox, GannSquare, GannSquareFixed } from "./builtin/gannAdvanced";
import { CyclicLines, TimeCycles, SineLine } from "./builtin/cycles";
import DrawingInspector from "./DrawingInspector";
import DrawingListPanel from "./DrawingListPanel";
import DrawingDock from "./DrawingDock";
import DrawingSemanticPointLegend from "./DrawingSemanticPointLegend";
export { generateDrawingLabel, filterDrawings, reorderDrawings } from "./DrawingListPanel";
export type { DrawingListPanelLabels, DrawingListPanelProps } from "./DrawingListPanel";
import type { DrawingInteractionAction, DrawingInteractionState, UseDrawingInteractionReturn } from "./useDrawingInteraction";
import { createDrawingInteractionState, deleteSelectedInteractionState, drawingInteractionReducer, useDrawingInteraction } from "./useDrawingInteraction";
export { DRAWING_UI_TOKENS, createDrawingUiStyleVars } from "./uiTokens";
import { FloatingSelectionToolbar } from "./FloatingSelectionToolbar";
import { renderDrawingToSvg } from "./renderSvg";
import DrawingLayer from "./DrawingLayer";
export { DRAWING_SHORTCUTS, resolveDrawingShortcut } from "./shortcutMap";
export type { DrawingShortcutAction, DrawingShortcutCommand, DrawingShortcutDefinition, DrawingShortcutTool } from "./shortcutMap";
export {
	createDrawingSelectionToolbarModel,
	resolveDrawingSelectionToolbarPosition,
} from "./workspace/selectionToolbar";
export type {
	DrawingSelectionToolbarAction,
	DrawingSelectionToolbarActionId,
	DrawingSelectionToolbarLabels,
	DrawingSelectionToolbarModel,
	DrawingSelectionToolbarPosition,
} from "./workspace/selectionToolbar";

// DT-10: Drawing Alerts
export { evaluateDrawingAlerts, resolveReferencePriceForAlert, isCooldownElapsed, detectPriceCross } from "./evaluateDrawingAlerts";
export type { DrawingAlertEvent } from "./evaluateDrawingAlerts";
export { useDrawingAlertEvaluator } from "./useDrawingAlertEvaluator";
export type { UseDrawingAlertEvaluatorOptions } from "./useDrawingAlertEvaluator";
export type { DrawingAlertCondition, DrawingAlertDirection } from "./types";
export { renderDrawingAlertIcon } from "./renderCanvas";
export { AlertNotificationToast } from "./AlertNotificationToast";
export type { DrawingAlertToastItem, AlertNotificationToastProps } from "./AlertNotificationToast";
// DT-11: Elliott Wave
export { calculateElliottWaveGeometry, ELLIOTT_LABELS, ELLIOTT_POINT_COUNT } from "./builtin/elliottWaves";
export type { ElliottWaveGeometry, ElliottWaveToolType } from "./builtin/elliottWaves";
// DT-12: Harmonic Patterns
export { calculateHarmonicPatternGeometry, PATTERN_POINT_LABELS, PATTERN_POINT_COUNT, PATTERN_HAS_CLOSING_LINE } from "./builtin/harmonicPatterns";
export type { HarmonicPatternGeometry, HarmonicPatternType } from "./builtin/harmonicPatterns";
export type { HarmonicRatioConfig } from "./types";
// DT-13: Extended Fibonacci
export { calculateFibExtendedGeometry, FIB_EXTENDED_LEVELS, FIB_FAN_RATIOS, FIB_EXTENDED_TWO_POINT, FIB_EXTENDED_THREE_POINT } from "./builtin/fibExtended";
export type { FibExtendedGeometry, FibExtendedToolType } from "./builtin/fibExtended";
// DT-14: Gann Advanced
export { calculateGannAdvancedGeometry, GANN_FRACTIONS } from "./builtin/gannAdvanced";
export type { GannAdvancedGeometry, GannAdvancedToolType } from "./builtin/gannAdvanced";
// DT-15: Cycle Tools
export { calculateCycleGeometry } from "./builtin/cycles";
export type { CycleGeometry, CycleToolType } from "./builtin/cycles";
export { DrawingContextMenu } from "./contextMenu";
export type { DrawingContextMenuItem, DrawingContextMenuProps } from "./contextMenu";
export { clearDrawingStyleOverride, clearDrawingStyleOverrides, getDrawingStyleOverride, listDrawingStyleOverrides, overrideDrawingStyle, resolveDrawingStyle, subscribeDrawingStyle, subscribeDrawingStyleChanges, saveDrawingTemplate, loadDrawingTemplate, clearDrawingTemplate, applyDrawingTemplate, validateDrawingStyleTemplate } from "./drawingStyleRegistry";
export { listTemplates, saveTemplate, deleteTemplate, loadTemplate, exportAllTemplates, importAllTemplates } from "./drawingTemplateStorage";
export { isLineFamilyType, LINE_FAMILY_TYPES, lineTypeFlagsFor } from "./stateMachine";
export type { LineFamilyType } from "./stateMachine";
import { useDrawingStorage } from "./useDrawingStorage";
import { useDrawingWorkspaceController } from "./workspace/useDrawingWorkspaceController";

registerDrawingTool(TrendLine);
registerDrawingTool(HLine);
registerDrawingTool(VLine);
registerDrawingTool(Fibonacci);
registerDrawingTool(Channel);
registerDrawingTool(Text);
registerDrawingTool(Rectangle);
registerDrawingTool(Arrow);
registerDrawingTool(Ray);
registerDrawingTool(ExtendedLine);
registerDrawingTool(Polyline);
registerDrawingTool(DateAndPriceRange);
registerDrawingTool(LongPosition);
registerDrawingTool(ShortPosition);
registerDrawingTool(FibExtension);
registerDrawingTool(ParallelChannel);
registerDrawingTool(Pitchfork);
registerDrawingTool(AbcdPattern);
registerDrawingTool(FibArc);
registerDrawingTool(FibTimeZone);
registerDrawingTool(RegressionChannel);
registerDrawingTool(GannFan);
registerDrawingTool(ElliottImpulse);
registerDrawingTool(ElliottCorrection);
registerDrawingTool(ElliottTriangle);
registerDrawingTool(ElliottDoubleCombo);
registerDrawingTool(ElliottTripleCombo);
registerDrawingTool(XabcdPattern);
registerDrawingTool(CypherPattern);
registerDrawingTool(HeadAndShoulders);
registerDrawingTool(TrianglePattern);
registerDrawingTool(ThreeDrivesPattern);
registerDrawingTool(FibChannel);
registerDrawingTool(FibSpeedResistanceFan);
registerDrawingTool(TrendBasedFibTime);
registerDrawingTool(FibCircles);
registerDrawingTool(FibSpiral);
registerDrawingTool(FibSpeedResistanceArcs);
registerDrawingTool(FibWedge);
registerDrawingTool(Pitchfan);
registerDrawingTool(GannBox);
registerDrawingTool(GannSquare);
registerDrawingTool(GannSquareFixed);
registerDrawingTool(CyclicLines);
registerDrawingTool(TimeCycles);
registerDrawingTool(SineLine);

export {
	createDraftFromTool,
	createTool,
	createDrawingHistory,
	deserializeDrawingHistory,
	deserializeDrawingObject,
	deserializeDrawings,
	drawingReducer,
	historyReducer,
	isDrawingToolName,
	listDrawingTools,
	listDrawingPlugins,
	registerDrawingTool,
	registerDrawingPlugin,
	getDrawingPlugin,
	renderDrawingToSvg,
	serializeDrawingHistory,
	serializeDrawingObject,
	serializeDrawings,
	exportDrawingsJSON,
	importDrawingsJSON,
	chartPointToPixel,
	chartPointToPixelWithBridge,
	pixelToChartPoint,
	buildRenderScalesFromBridge,
	measurementPointToPixelWithBridge,
	measurementPointToPixel,
	resolveChartPointWithBridge,
	resolveMeasurementPointWithBridge,
	resolveMeasurementPoint,
	summarizeMeasurement,
	createDrawingInteractionState,
	deleteSelectedInteractionState,
	drawingInteractionReducer,
	useDrawingInteraction,
	createLocalStorageAdapter,
	DrawingImportError,
	useDrawingStorage,
	useDrawingWorkspaceController,
	DrawingLayer,
	DrawingInspector,
	DrawingListPanel,
	DrawingDock,
	DrawingSemanticPointLegend,
	FloatingSelectionToolbar,
};

export type {
	DrawingAction,
	DrawingState,
} from "./stateMachine";

export type { DrawingHistory } from "./history";

export type {
	DrawingObject,
	DrawingPluginDefinition,
	DrawingStyle,
	DrawingToolDefinition,
	DrawingToolType,
	FibLevelConfig,
	Point,
} from "./types";

export type { DrawingStyleOverride } from "./drawingStyleRegistry";

export type { MagnetSensitivity } from "./snap";
export { MAGNET_TOLERANCE, collectFibLevelSnapCandidates } from "./snap";

export { useLongPress } from "./useLongPress";
export type { UseLongPressOptions, LongPressHandlers } from "./useLongPress";

export { HIT_TOLERANCE } from "./hitTest";
export type { PointerDeviceType } from "./hitTest";

export type {
	DrawingInteractionAction,
	DrawingInteractionState,
	UseDrawingInteractionReturn,
} from "./useDrawingInteraction";
export type { UseDrawingStorageOptions, UseDrawingStorageReturn } from "./useDrawingStorage";
export type {
	DrawingDockTab,
	DrawingWorkspaceController,
	DrawingWorkspaceState,
	DrawingWorkspaceTool,
	UseDrawingWorkspaceControllerOptions,
} from "./workspace/useDrawingWorkspaceController";

export type {
	DrawingDockLabels,
	DrawingDockProps,
} from "./DrawingDock";

export type {
	ChartScales,
	PlotDatum,
} from "./coordinateUtils";

export type {
	MeasurementPoint,
	MeasurementSelection,
	MeasurementSummary,
} from "./measuring";

export type {
	DrawingCoordinateBridge,
	DrawingCoordinateInput,
	DrawingCoordinatePixelInput,
	DrawingCoordinateScaleContext,
	MeasurementCoordinateBridge,
	MeasurementCoordinateInput,
	MeasurementCoordinatePixelInput,
} from "./coordinateBridge";

export {
	TrendLine,
	HLine,
	VLine,
	Fibonacci,
	Channel,
	Text,
	Rectangle,
	Arrow,
	Ray,
	ExtendedLine,
	Polyline,
	DateAndPriceRange,
	LongPosition,
	ShortPosition,
	FibExtension,
	ParallelChannel,
	Pitchfork,
	AbcdPattern,
	FibArc,
	FibTimeZone,
	RegressionChannel,
	ElliottImpulse,
	ElliottCorrection,
	ElliottTriangle,
	ElliottDoubleCombo,
	ElliottTripleCombo,
	XabcdPattern,
	CypherPattern,
	HeadAndShoulders,
	TrianglePattern,
	ThreeDrivesPattern,
	FibChannel,
	FibSpeedResistanceFan,
	TrendBasedFibTime,
	FibCircles,
	FibSpiral,
	FibSpeedResistanceArcs,
	FibWedge,
	Pitchfan,
	GannBox,
	GannSquare,
	GannSquareFixed,
	CyclicLines,
	TimeCycles,
	SineLine,
};

// ── GAP-4: Multi-select batch operations ─────────────────────────────────────
export {
	applyBatchDelete,
	applyBatchLock,
	applyBatchVisible,
	applyBatchColor,
	resolveNextLockState,
	resolveNextVisibleState,
} from "./multiSelectBatch";

// ── GAP-11: Harmonic ratio validation ────────────────────────────────────────
export type { HarmonicRatioLabel } from "./harmonicRatioValidation";
export {
	classifyHarmonicDeviation,
	computeHarmonicRatioLabels,
	formatHarmonicRatioLabel,
} from "./harmonicRatioValidation";