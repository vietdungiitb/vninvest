import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FreshnessBadge } from "../feedback/FreshnessBadge.js";

describe("W2 FreshnessBadge", () => {
  it("3 trạng thái có data-state/testid riêng, không dùng chung class empty", () => {
    const { rerender } = render(<FreshnessBadge state="fresh" label="Live" />);
    expect(screen.getByTestId("freshness-fresh").getAttribute("data-state")).toBe("fresh");
    rerender(<FreshnessBadge state="delayed" label="Trễ" note="delay_15m" />);
    const delayed = screen.getByTestId("freshness-delayed");
    expect(delayed.getAttribute("data-state")).toBe("delayed");
    expect(delayed.getAttribute("data-note")).toBe("delay_15m");
    rerender(<FreshnessBadge state="stale" label="Cũ" note="feed_down" />);
    expect(screen.getByTestId("freshness-stale").getAttribute("data-state")).toBe("stale");
    rerender(<FreshnessBadge state="empty" label="Chưa nhận" note="backend_missing" />);
    expect(screen.getByTestId("freshness-empty").getAttribute("data-state")).toBe("empty");
  });

  it("StockOrderBookWidget dùng FreshnessBadge thay badge thô", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/components/workstation/StockOrderBookWidget.jsx", "utf8");
    expect(src).toMatch(/FreshnessBadge/);
  });
});
