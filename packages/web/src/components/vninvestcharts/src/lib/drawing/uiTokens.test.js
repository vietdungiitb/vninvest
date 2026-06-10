import { describe, expect, it } from "vitest";
import { DRAWING_UI_TOKENS, createDrawingUiStyleVars } from "./uiTokens";
describe("DRAWING_UI_TOKENS", () => {
    it("keeps mobile touch targets at or above 32px", () => {
        expect(DRAWING_UI_TOKENS.railButtonSize).toBeGreaterThanOrEqual(32);
        expect(DRAWING_UI_TOKENS.flyoutButtonSize).toBeGreaterThanOrEqual(32);
        expect(DRAWING_UI_TOKENS.flyoutButtonSizeCompact).toBeGreaterThanOrEqual(32);
        expect(DRAWING_UI_TOKENS.minTouchTarget).toBe(32);
    });
    it("keeps control spacing at or above 4px", () => {
        expect(DRAWING_UI_TOKENS.railButtonGap).toBeGreaterThanOrEqual(4);
        expect(DRAWING_UI_TOKENS.railSectionGap).toBeGreaterThanOrEqual(4);
        expect(DRAWING_UI_TOKENS.minControlSpacing).toBe(4);
    });
    it("exports style vars used by toolbar surfaces", () => {
        const vars = createDrawingUiStyleVars();
        expect(vars["--gc-toolbar-button-size"]).toBe("32px");
        expect(vars["--gc-toolbar-gap"]).toBe("4px");
        expect(vars["--gc-touch-target-min"]).toBe("32px");
        expect(vars["--gc-touch-spacing-min"]).toBe("4px");
    });
});
