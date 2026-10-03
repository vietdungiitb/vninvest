import { describe, it, expect } from "vitest";
import { createTranslator } from "../../../i18n/index.js";

// UE-01 / UE-02 / UE-03: screener i18n keys must resolve in both locales
// (no raw-key display, no reliance on Vietnamese-only defaultValue).
describe("screener i18n keys", () => {
  for (const locale of ["vi", "en"] as const) {
    const t = createTranslator(locale);

    it(`${locale}: logic options resolve (UE-01)`, () => {
      expect(t("screener.logic.AND")).not.toBe("screener.logic.AND");
      expect(t("screener.logic.OR")).not.toBe("screener.logic.OR");
      expect(t("screener.logic.NOT")).not.toBe("screener.logic.NOT");
    });

    it(`${locale}: fieldPicker resolves (UE-01)`, () => {
      expect(t("screener.fieldPicker")).not.toBe("screener.fieldPicker");
    });

    it(`${locale}: ai.standAside resolves (UE-02)`, () => {
      expect(t("screener.ai.standAside")).not.toBe("screener.ai.standAside");
    });

    it(`${locale}: deleteRuleTitle resolves (UE-03)`, () => {
      expect(t("screener.deleteRuleTitle")).not.toBe("screener.deleteRuleTitle");
    });

    it(`${locale}: job/schedule/rowActions keys resolve (UE-04/UE-05/UE-06)`, () => {
      const keys = [
        "screener.jobQueued",
        "screener.jobRunning",
        "screener.jobCancelNote",
        "screener.errors.runTimeout",
        "screener.schedule.title",
        "screener.schedule.create",
        "screener.schedule.empty",
        "screener.schedule.errorRequired",
        "screener.schedule.weekdaysRequired",
        "screener.schedule.createFailed",
        "screener.schedule.runNow",
        "screener.schedule.enable",
        "screener.schedule.disable",
        "screener.schedule.deleteTitle",
        "screener.schedule.namePlaceholder",
        "screener.schedule.ruleOption",
        "screener.schedule.rulesLabel",
        "screener.schedule.nextRun",
        "screener.schedule.channelsLabel",
        "screener.schedule.channelInApp",
        "screener.schedule.channelEmail",
        "screener.schedule.weekdaysLabel",
        "screener.rowActions.title",
        "screener.rowActions.addToWatchlist",
        "screener.rowActions.createAlert",
        "screener.rowActions.createAlertSubmit",
        "screener.rowActions.alertAbove",
        "screener.rowActions.alertBelow",
        "screener.rowActions.pricePlaceholder",
        "screener.rowActions.noWatchlist",
      ];
      for (const key of keys) {
        expect(t(key), key).not.toBe(key);
      }
      // Interpolated keys keep their {var} placeholders.
      expect(t("screener.rowActions.addedToWatchlist", { symbol: "VCI" })).toContain("VCI");
      expect(t("screener.rowActions.alertCreated", { symbol: "VCI" })).toContain("VCI");
    });
  }
});
