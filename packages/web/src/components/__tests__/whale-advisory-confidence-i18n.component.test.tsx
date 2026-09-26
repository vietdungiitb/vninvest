import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { normalizeAdvisoryItem } from "../../hooks/useWhaleAdvisoryData.js";
import { WhaleAdvisoryBentoHeader } from "../advisory/WhaleAdvisoryBentoHeader.js";
import { LangProvider } from "@/context/LangContext.js";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/context/PortfolioContext.js", () => ({
  usePortfolio: () => ({ isAuthenticated: false, userConfig: { language: "en" } }),
}));

describe("normalizeAdvisoryItem confidence (S11)", () => {
  it("keeps null when missing", () => {
    expect(normalizeAdvisoryItem({ symbol: "FPT" })?.confidence).toBeNull();
  });

  it("converts 0.82 (0-1 scale) to 82", () => {
    expect(normalizeAdvisoryItem({ symbol: "FPT", confidence: 0.82 })?.confidence).toBe(82);
  });

  it("keeps 82 (0-100 scale) as-is", () => {
    expect(normalizeAdvisoryItem({ symbol: "FPT", confidence: 82 })?.confidence).toBe(82);
  });
});

describe("aiAdvisory i18n batch-1 EN (S11)", () => {
  it("header renders EN labels", () => {
    try { localStorage.setItem("lang", "en"); } catch { /* ignore */ }
    render(
      createElement(
        LangProvider,
        null,
        createElement(MemoryRouter, null, createElement(WhaleAdvisoryBentoHeader, { userPlan: "Pro", statsLoading: false, onRefresh: () => {} })),
      ),
    );
    expect(screen.getByText("AI COMMAND CENTER")).toBeTruthy();
    expect(screen.getByText("DATA CENTER")).toBeTruthy();
    expect(screen.getByText("GLOBAL NETWORK ACTIVE")).toBeTruthy();
  });
});
