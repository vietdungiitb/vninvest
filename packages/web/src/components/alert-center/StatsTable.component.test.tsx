import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatsTable } from "./StatsTable.js";

function row(over: any = {}) {
  return {
    symbol: "VCI",
    count: 5,
    buyCount: 3,
    sellCount: 1,
    neutralCount: 1,
    totalValue: 1000,
    freq: "high",
    severities: {},
    latestTime: new Date("2026-09-18T10:30:00Z").getTime(),
    ...over,
  };
}

describe("StatsTable (S4)", () => {
  afterEach(() => cleanup());

  it("map freq enum + hien neutral + latestTime", () => {
    const { container } = render(
      <StatsTable rows={[row()]} formatAlertValue={(v) => String(v)} />
    );
    expect(screen.getByText("alertCenter.freqHigh")).toBeTruthy();
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("alertCenter.labelOther");
    expect(container.textContent).not.toContain("—");
  });

  it("freq low + latestTime 0 → '—'", () => {
    const { container } = render(
      <StatsTable rows={[row({ freq: "low", latestTime: 0 })]} formatAlertValue={(v) => String(v)} />
    );
    expect(screen.getByText("alertCenter.freqLow")).toBeTruthy();
    expect(container.textContent).toContain("—");
  });

  it("rows rong → statsEmpty", () => {
    render(<StatsTable rows={[]} formatAlertValue={(v) => String(v)} />);
    expect(screen.getByText("alertCenter.statsEmpty")).toBeTruthy();
  });
});
