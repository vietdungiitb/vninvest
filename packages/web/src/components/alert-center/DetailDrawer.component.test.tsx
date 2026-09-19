import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DetailDrawer } from "./DetailDrawer.js";

describe("DetailDrawer (E1)", () => {
  afterEach(() => cleanup());

  it("render context that + recent_events, khong field ao", () => {
    const { container } = render(
      <DetailDrawer
        activeAlertId="x"
        activeDetail={{ title: "T", summary: "S" }}
        activeContext={{
          symbol: "VCI",
          total: 2,
          unseen: 1,
          in_delivery_scope: true,
          recent_events: [
            { alert_id: "1", symbol: "VCI", severity: "high", triggered_at: new Date().toISOString() },
          ],
        }}
        appliedSymbol="VCI"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("alertCenter.detailInScope")).toBeTruthy();
    const li = container.querySelector("li");
    expect(li?.textContent).toContain("VCI");
    expect(li?.textContent).toContain("high");
    expect(screen.queryByText("alertCenter.detailAvgSeverity")).toBeNull();
    expect(screen.queryByText("alertCenter.detailThreshold")).toBeNull();
    expect(screen.getByText("alertCenter.detailRecentEvents")).toBeTruthy();
  });

  it("hien Outside scope khi in_delivery_scope false", () => {
    render(
      <DetailDrawer
        activeAlertId="y"
        activeDetail={{ title: "T" }}
        activeContext={{ symbol: "HPG", total: 0, unseen: 0, in_delivery_scope: false, recent_events: [] }}
        appliedSymbol="HPG"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("alertCenter.detailNotInScope")).toBeTruthy();
  });
});
