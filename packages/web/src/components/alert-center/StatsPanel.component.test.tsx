import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StatsPanel } from "./StatsPanel.js";

function baseProps(over: any = {}) {
  return {
    rows: [],
    totalSymbols: 0,
    searchTerm: "",
    onSearchChange: vi.fn(),
    formatAlertValue: (v: unknown) => String(v),
    page: 1,
    pageSize: 20,
    totalPages: 1,
    onPageChange: vi.fn(),
    sortKey: "count" as const,
    sortDir: "desc" as const,
    onSortChange: vi.fn(),
    ...over,
  };
}

function row(sym: string) {
  return {
    symbol: sym, count: 1, buyCount: 1, sellCount: 0, neutralCount: 0,
    totalValue: 100, freq: "low", severities: {}, latestTime: 0,
  };
}

describe("StatsPanel (Slice 1.1)", () => {
  afterEach(() => cleanup());

  it("header hien tong scope + thong tin trang", () => {
    render(<StatsPanel {...baseProps({ rows: [row("VCI")], totalSymbols: 24, totalPages: 2 })} />);
    expect(screen.getByText("alertCenter.statsTotal")).toBeTruthy();
    expect(screen.getByText("alertCenter.statsPageInfo")).toBeTruthy();
  });

  it("nut xoa search khi co searchTerm", () => {
    const onSearchChange = vi.fn();
    render(<StatsPanel {...baseProps({ searchTerm: "VC", onSearchChange })} />);
    fireEvent.click(screen.getByRole("button", { name: "alertCenter.clearFilter" }));
    expect(onSearchChange).toHaveBeenCalledWith("");
  });
});
