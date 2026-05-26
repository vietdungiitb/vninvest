
// common components
export { default as ChartCanvas } from "./lib/ChartCanvas";
export { default as Chart } from "./lib/Chart";
export { default as GenericChartComponent } from "./lib/GenericChartComponent";
export { default as GenericComponent } from "./lib/GenericComponent";
export { default as BackgroundText } from "./lib/BackgroundText";
export { default as ZoomButtons } from "./lib/ZoomButtons";

export { ChartTerminal, ChartPane, PaneSplitter, usePaneManager, BarReplayController } from "./lib/core";
export { ChartSplitter, usePaneSizes, useChartTheme, useIndicatorSets, DynamicChart, PaneHeader, PaneLabel, PaneTooltip, SeriesPicker, IndicatorLegend, useDynamicPanes, DEFAULT_PANES, PANE_LAYOUT_STORAGE_KEY, PANE_MAX_VISIBLE, INDICATOR_SETS_STORAGE_KEY, clearSeriesStyleOverride, clearSeriesStyleOverrides, getSeriesStyleOverride, listSeriesStyleOverrides, overrideSeriesStyle, subscribeSeriesStyle, subscribeSeriesStyleChanges } from "./lib/core";
export { OverlayCanvas } from "./lib/core";

export { WhaleBubbleOverlay } from "./lib/indicators/overlays/WhaleBubbleOverlay";
export type { WhaleEvent, WhaleBubbleOverlayProps } from "./lib/indicators/overlays/WhaleBubbleOverlay";

export type { ChartSplitterProps } from "./lib/core";
export type { UsePaneSizesOptions, UsePaneSizesResult } from "./lib/core";
export type { UseChartThemeResult, ChartTheme } from "./lib/core";
export type { ChartHandle, VisibleRange } from "./lib/core";
export type { IndicatorSet, IndicatorSetsStorage, IndicatorSetStorageLike } from "./lib/core";
export type { PaneDescriptor, SeriesConfig, SeriesTypeId, TooltipMode, YAxisSide, SeriesStyleOverride } from "./lib/core";
export type { BarReplayState, ReplayBarLike, ReplaySpeed } from "./lib/core";
export { getIndicator, registerIndicator } from "./lib/indicators";
export { BaseAdapter, DjangoVnstockAdapter, MockAdapter, createRestAdapter, createMockBars } from "./lib/adapters";
export {
	createDraftFromTool,
	createDrawingHistory,
	createTool as createDrawingTool,
	createDrawingInteractionState,
	createLocalStorageAdapter,
	DrawingImportError,
	deleteSelectedInteractionState,
	deserializeDrawingHistory,
	deserializeDrawingObject,
	deserializeDrawings,
	drawingInteractionReducer,
	drawingReducer,
	chartPointToPixel,
	measurementPointToPixel,
	historyReducer,
	isDrawingToolName,
	listDrawingTools,
	listDrawingPlugins,
	resolveMeasurementPoint,
	pixelToChartPoint,
	registerDrawingTool,
	registerDrawingPlugin,
	getDrawingPlugin,
	renderDrawingToSvg,
	summarizeMeasurement,
	serializeDrawingHistory,
	serializeDrawingObject,
	serializeDrawings,
	useDrawingStorage,
	useDrawingInteraction,
	MAGNET_TOLERANCE,
	DrawingLayer,
		DrawingContextMenu,
	DrawingInspector,
	DrawingListPanel,
		DRAWING_SHORTCUTS,
		resolveDrawingShortcut,
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
	clearDrawingStyleOverride,
	clearDrawingStyleOverrides,
	getDrawingStyleOverride,
	listDrawingStyleOverrides,
	overrideDrawingStyle,
	resolveDrawingStyle,
	subscribeDrawingStyle,
	subscribeDrawingStyleChanges,
} from "./lib/drawing";

export type {
	ChartScales,
	DrawingInteractionAction,
	DrawingInteractionState,
	DrawingPluginDefinition,
	DrawingShortcutAction,
	DrawingShortcutCommand,
	DrawingShortcutDefinition,
	DrawingShortcutTool,
	DrawingContextMenuItem,
	DrawingContextMenuProps,
	MagnetSensitivity,
	MeasurementPoint,
	MeasurementSelection,
	MeasurementSummary,
	PlotDatum,
	UseDrawingInteractionReturn,
} from "./lib/drawing";

export type {
	AnyRecord,
	BarData,
	CandleData,
	CandleWick,
	ChartAccessor,
	ChartDatum,
	CanvasContexts,
	MoreProps,
	OHLCV,
	OHLCVBar,
	IndicatorConfig,
	IndicatorDefinition,
	PaneConfig,
	StockDataAdapter,
	Unsubscribe,
	YAxisConfig,
} from "./lib/types/index";

export type { DrawingStyleOverride } from "./lib/drawing";
export {
	buildRenderScalesFromBridge,
	chartPointToPixelWithBridge,
	measurementPointToPixelWithBridge,
	resolveChartPointWithBridge,
	resolveMeasurementPointWithBridge,
} from "./lib/drawing/coordinateBridge";
export type {
	DrawingCoordinateBridge,
	DrawingCoordinateInput,
	DrawingCoordinatePixelInput,
	DrawingCoordinateScaleContext,
	MeasurementCoordinateBridge,
	MeasurementCoordinateInput,
	MeasurementCoordinatePixelInput,
} from "./lib/drawing/coordinateBridge";

export { MeasurementOverlay, VNStockChart, WidgetErrorBoundary, WidgetEmptyState, WidgetI18nContext, WidgetI18nProvider, useWidgetI18n } from "./widget";
export { widgetMessagesEn, widgetMessagesVi } from "./widget";
export type {
	VNStockChartProps,
	WidgetCoordinateBridge,
	WidgetPaneRuntimeSnapshot,
	WidgetPaneSplitterRenderContext,
	WidgetPaneToolbarActions,
	WidgetPaneToolbarRenderContext,
	WidgetRuntimeCapabilities,
	WidgetLocale,
	WidgetMessages,
	WidgetI18nContextValue,
	WidgetI18nProviderProps,
} from "./widget";

export const version = "1.0.0";
