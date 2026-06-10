export const DRAWING_UI_TOKENS = {
	railWidth: 40,
	railHandleWidth: 14,
	railHandleHeight: 36,
	railButtonSize: 30,
	railButtonGap: 2,
	railSectionGap: 6,
	flyoutPadding: 6,
	flyoutMargin: 8,
	flyoutButtonSize: 30,
	flyoutButtonSizeCompact: 44,
	mobileBreakpoint: 767,
	motionFastMs: 120,
	motionDefaultMs: 150,
} as const;

export function createDrawingUiStyleVars() {
	return {
		"--gc-toolbar-w": `${DRAWING_UI_TOKENS.railWidth}px`,
		"--gc-toolbar-handle-w": `${DRAWING_UI_TOKENS.railHandleWidth}px`,
		"--gc-toolbar-handle-h": `${DRAWING_UI_TOKENS.railHandleHeight}px`,
		"--gc-toolbar-button-size": `${DRAWING_UI_TOKENS.railButtonSize}px`,
		"--gc-toolbar-gap": `${DRAWING_UI_TOKENS.railButtonGap}px`,
		"--gc-toolbar-section-gap": `${DRAWING_UI_TOKENS.railSectionGap}px`,
		"--gc-toolbar-flyout-padding": `${DRAWING_UI_TOKENS.flyoutPadding}px`,
		"--gc-toolbar-flyout-margin": `${DRAWING_UI_TOKENS.flyoutMargin}px`,
		"--gc-toolbar-flyout-button-size": `${DRAWING_UI_TOKENS.flyoutButtonSize}px`,
		"--gc-toolbar-flyout-button-size-compact": `${DRAWING_UI_TOKENS.flyoutButtonSizeCompact}px`,
		"--gc-toolbar-motion-fast": `${DRAWING_UI_TOKENS.motionFastMs}ms`,
		"--gc-toolbar-motion-default": `${DRAWING_UI_TOKENS.motionDefaultMs}ms`,
	} as const;
}