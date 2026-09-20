import { describe, it, expect } from "vitest";
import { createTranslator } from "../../i18n/index.js";

// SC-06: every soc.screener.* key used by SocScreenerPanel/RuleModal must
// resolve in both locales (no raw-key display).
const SOC_SCREENER_KEYS = [
  "soc.screener.loading",
  "soc.screener.add_rule",
  "soc.screener.edit_rule",
  "soc.screener.results_title",
  "soc.screener.alerts_title",
  "soc.screener.config_saved",
  "soc.screener.apply_failed",
  "soc.screener.scan_completed",
  "soc.screener.scan_failed",
  "soc.screener.rule_saved",
  "soc.screener.rule_save_failed",
  "soc.screener.delete_rule_title",
  "soc.screener.rule_deleted",
  "soc.screener.delete_failed",
  "soc.screener.rule_name_placeholder",
  "soc.screener.invalid_json",
  "soc.screener.threshold_json",
  "soc.screener.value_json",
  "soc.screener.enabled",
  "soc.screener.read_only",
  "soc.screener.config.preview",
  "soc.screener.rule_type_label",
  "soc.screener.rule_type.price_change_pct",
  "soc.screener.rule_type.volume_spike_ratio",
  "soc.screener.rule_type.cvd_threshold",
  "soc.screener.rule_type.whale_count",
  "soc.screener.rule_type.dark_pool_ratio",
  "soc.screener.rule_type.rsi_level",
  "soc.screener.rule_type.ma_cross",
  "soc.screener.rule_type.bollinger_band_break",
  "soc.screener.rule_type.custom",
];

describe("soc.screener i18n keys (SC-06)", () => {
  for (const locale of ["vi", "en"] as const) {
    it(`${locale}: all panel/modal keys resolve`, () => {
      const t = createTranslator(locale);
      for (const key of SOC_SCREENER_KEYS) {
        expect(t(key), key).not.toBe(key);
      }
    });

    it(`${locale}: scan_completed interpolates vars`, () => {
      const t = createTranslator(locale);
      const out = t("soc.screener.scan_completed", { matched: 3, scanned: 10, rules: 2 } as any);
      expect(out).toContain("3");
      expect(out).toContain("10");
      expect(out).not.toContain("{matched}");
    });
  }
});
