import { describe, it, expect } from "vitest";
import { formatAlertMetric } from "../../../utils/alertCenterFormat.ts";
import { formatVNDCompact, formatFullVND } from "../../../utils/formatMarket.js";

const compact = (v: unknown) => formatVNDCompact(v);
const full = (v: unknown) => formatFullVND(v);

describe("P0-3 — alert.value đơn vị theo alert_family", () => {
  it("price_shock: metadata.price_change_pct âm → −26.88%, KHÔNG ₫/VND", () => {
    const { text, full: tooltip } = formatAlertMetric(
      {
        alert_family: "price_shock",
        value: 26.88,
        direction: "sell",
        metadata: { price_change_pct: -26.88 },
      },
      { compact, full },
    );
    expect(text).toBe("−26.88%");
    expect(tooltip).toBe("−26.88%");
    expect(text).not.toMatch(/₫|VND/);
  });

  it("price_shock: direction buy + số dương → +14.00%", () => {
    const { text } = formatAlertMetric(
      { alert_family: "price_shock", value: 14, direction: "buy", metadata: null },
      { compact, full },
    );
    expect(text).toBe("+14.00%");
  });

  it("whale: vẫn format VND compact, KHÔNG chèn thêm VND sau ₫", () => {
    const { text, full: tooltip } = formatAlertMetric(
      { alert_family: "whale", value: 1_500_000_000, direction: "buy", metadata: null },
      { compact, full },
    );
    expect(text).toBe(compact(1_500_000_000));
    expect(text).toContain("₫");
    expect(text).not.toContain("VND");
    expect(tooltip).toBe(full(1_500_000_000));
  });
});
