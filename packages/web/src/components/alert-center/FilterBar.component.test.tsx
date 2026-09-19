import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FilterBar } from "./FilterBar.js";

function baseProps(over: any = {}) {
  return {
    lane: "main",
    onLaneChange: vi.fn(),
    timeframe: "session",
    onTimeframeChange: vi.fn(),
    symbolDraft: "",
    onSymbolDraftChange: vi.fn(),
    onSymbolApply: (e: any) => e.preventDefault(),
    sessionDate: "",
    onSessionDateChange: vi.fn(),
    severityFilter: [],
    onToggleSeverity: vi.fn(),
    familyFilter: [],
    onToggleFamily: vi.fn(),
    onClearFilters: vi.fn(),
    isRefreshing: false,
    onRefresh: vi.fn(),
    ...over,
  };
}

describe("FilterBar lane options (C4)", () => {
  afterEach(() => cleanup());

  it("lane ai → 2 options ai_suggest/ai_alert", () => {
    render(<FilterBar {...baseProps({ lane: "ai" })} />);
    expect(screen.getByText("alertCenter.famAiSuggest")).toBeTruthy();
    expect(screen.getByText("alertCenter.famAiAlert")).toBeTruthy();
    expect(screen.queryByText("alertCenter.famWhale")).toBeNull();
    expect(screen.queryByText("alertCenter.famStaleQuote")).toBeNull();
  });

  it("lane main → 6 options co stale_quote, khong ai", () => {
    render(<FilterBar {...baseProps({ lane: "main" })} />);
    for (const key of [
      "alertCenter.famWhale",
      "alertCenter.famDarkFlow",
      "alertCenter.famPriceShock",
      "alertCenter.famSignal",
      "alertCenter.famSystem",
      "alertCenter.famStaleQuote",
    ]) {
      expect(screen.getByText(key)).toBeTruthy();
    }
    expect(screen.queryByText("alertCenter.famAiAlert")).toBeNull();
    expect(screen.queryByText("alertCenter.famAiSuggest")).toBeNull();
  });

  it("D3 date input → onSessionDateChange", () => {
    const onSessionDateChange = vi.fn();
    render(<FilterBar {...baseProps({ onSessionDateChange })} />);
    const input = screen.getByLabelText("alertCenter.sessionDate") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-09-18" } });
    expect(onSessionDateChange).toHaveBeenCalledWith("2026-09-18");
  });
});
