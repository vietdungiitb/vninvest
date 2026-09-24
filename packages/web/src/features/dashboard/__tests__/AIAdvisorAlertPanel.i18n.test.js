import { describe, expect, test } from "@jest/globals";
import { createAiAdvisorTranslator } from "../AIAdvisorAlertPanel.js";

describe("AIAdvisorAlertPanel i18n", () => {
  test("resolves Vietnamese labels by default", () => {
    const { language, t } = createAiAdvisorTranslator();
    expect(language).toBe("vi");
    expect(t("aiAdvisor.panel.title")).toBe("Tín hiệu AI");
    expect(t("aiAdvisor.metric.rsi")).toBe("RSI Hiện Tại:");
  });

  test("resolves English labels when locale is en", () => {
    const { language, t } = createAiAdvisorTranslator("en");
    expect(language).toBe("en");
    expect(t("aiAdvisor.panel.title")).toBe("AI signals");
    expect(t("aiAdvisor.panel.refresh")).toBe("Refresh");
    expect(t("aiAdvisor.trend.buy")).toBe("BUY");
  });

  test("falls back to key when label does not exist", () => {
    const { t } = createAiAdvisorTranslator("en");
    expect(t("aiAdvisor.missing.key")).toBe("aiAdvisor.missing.key");
  });
});
