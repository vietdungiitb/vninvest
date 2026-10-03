import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { RecommendationCardExplainability } from "../advisory/RecommendationCardExplainability.js";
import { normalizeAdvisoryItem } from "../../hooks/useWhaleAdvisoryData.js";

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn() }));

describe("S15 explainability attribution", () => {
  it("renders attribution and provenance only from real fields", () => {
    render(createElement(RecommendationCardExplainability, {
      advisory: {
        symbol: "FPT",
        ai_summary: "Tín hiệu tăng",
        ai_provider: "openai",
        ai_model: "gpt-4o-mini",
        generated_at: "2026-09-25T10:00:00Z",
        feature_attribution: { whale: 0.6, dark_flow: 0.25, technical: 0.15 },
        input_snapshot: { symbol: "FPT", session_date: "2026-09-25" },
      },
      realtimeStatus: "live",
    }));
    fireEvent.click(screen.getByRole("button", { name: /Tại sao/ }));
    expect(screen.getByText("Whale")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText("Dark flow")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.getByText("openai / gpt-4o-mini")).toBeTruthy();
    expect(screen.getByText(/2026-09-25/)).toBeTruthy();
  });

  it("hides attribution when fields are absent", () => {
    render(createElement(RecommendationCardExplainability, {
      advisory: { symbol: "FPT", ai_summary: "Không có dữ liệu", ai_provider: "openai" },
      realtimeStatus: "live",
    }));
    fireEvent.click(screen.getByRole("button", { name: /Tại sao/ }));
    expect(screen.queryByText("Whale")).toBeNull();
    expect(screen.queryByText("Input snapshot")).toBeNull();
  });

  it("normalizer preserves structured attribution without inventing values", () => {
    const item = normalizeAdvisoryItem({
      symbol: "FPT",
      structured_output: {
        feature_attribution: { whale: 60, dark_flow: 25, technical: 15 },
        input_snapshot: { symbol: "FPT" },
      },
    });
    expect(item.feature_attribution.whale).toBe(60);
    expect(item.input_snapshot.symbol).toBe("FPT");
    expect(normalizeAdvisoryItem({ symbol: "SSI" }).feature_attribution).toEqual({});
  });
});
