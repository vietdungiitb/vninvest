import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  ADVISORY_EXPORT_COLUMNS,
  buildAdvisoryCsv,
  downloadAdvisoryCsv,
  buildAdvisoryShareLink,
  copyAdvisoryShareLink,
  toAdvisoryCsvRow,
} from "../advisory/advisoryExport.js";
import { AdvisoryCompareTable } from "../advisory/AdvisoryCompareTable.js";

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn() }));
vi.mock("@/components/ShellToast.js", () => ({
  useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/components/ConfirmModal.js", () => ({ useConfirm: () => async () => true }));

const hookState: Record<string, unknown> = {
  items: [],
  loading: false,
  error: null,
  symbolStats: [],
  statsLoading: false,
  refreshInfoMap: {},
  pendingRefreshSymbols: {},
  pendingDeleteSymbols: {},
  rowMessages: {},
  fetchData: vi.fn(),
  loadRefreshInfo: vi.fn(),
  handleRefreshAdvisory: vi.fn(),
  handleDeleteAdvisory: vi.fn(),
};

vi.mock("@/hooks/useWhaleAdvisoryData.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/hooks/useWhaleAdvisoryData.js")>();
  return { ...mod, useWhaleAdvisoryData: vi.fn(() => hookState) };
});

import { usePortfolio } from "@/context/PortfolioContext.js";

describe("advisoryExport util (S13 G2)", () => {
  it("header covers contract columns + escapes + caps rows", () => {
    const { header, body, count } = buildAdvisoryCsv([
      { created_at: "2026-09-25", symbol: "FPT", side: "BUY", confidence: 82, ai_summary: 'Tăng, "mạnh"\nxuống' },
    ]);
    expect(header).toBe(ADVISORY_EXPORT_COLUMNS.join(","));
    expect(body).toContain('"Tăng, ""mạnh""\nxuống"');
    expect(count).toBe(1);
    expect(toAdvisoryCsvRow({ symbol: "FPT" }).outcome_t1).toBe("");
  });

  it("download writes UTF-8 BOM blob", () => {
    const seen: { content: unknown; type: string; filename: string }[] = [];
    (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:mock");
    (globalThis.URL as any).revokeObjectURL = vi.fn(() => {});
    const clicks: string[] = [];
    HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    }) as unknown as () => void;
    const RealBlob = globalThis.Blob;
    let captured = "";
    (globalThis as any).Blob = function (parts: unknown[], opts: { type: string }) {
      captured = String((parts as string[])[0]);
      seen.push({ content: parts[0], type: opts.type });
      return { parts, type: opts.type };
    } as unknown as typeof Blob;

    try {
      const n = downloadAdvisoryCsv([{ symbol: "FPT" }], "advisory-FPT.csv");
      expect(n).toBe(1);
      expect(captured.charCodeAt(0)).toBe(0xfeff);
      expect(captured).toContain("created_at,symbol,side,confidence,summary,outcome_t1,outcome_t3,outcome_t5");
      expect(clicks).toEqual(["advisory-FPT.csv"]);
      expect(seen[0].type).toContain("text/csv");
    } finally {
      (globalThis as any).Blob = RealBlob;
    }
  });
});

describe("advisory share-link (S13 G2)", () => {
  it("builds /ai-advisory?symbol=X and copies absolute URL", async () => {
    expect(buildAdvisoryShareLink("fpt")).toBe("/ai-advisory?symbol=FPT");
    const writeText = vi.fn(async () => {});
    Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText }, configurable: true });
    const url = await copyAdvisoryShareLink("fpt");
    expect(url.endsWith("/ai-advisory?symbol=FPT")).toBe(true);
    expect(writeText).toHaveBeenCalledWith(url);
  });
});

describe("AdvisoryCompareTable (S13 G3)", () => {
  it("renders 5 columns from symbolStats + items", () => {
    render(
      createElement(AdvisoryCompareTable, {
        symbols: ["FPT", "SSI"],
        symbolStats: [{ symbol: "FPT", whaleIntensity: 80 }, { symbol: "SSI", whaleIntensity: 10 }],
        items: [
          { symbol: "FPT", side: "BUY", confidence: 82, created_at: "2026-09-25T10:00:00+07:00" },
          { symbol: "SSI", side: "SELL", confidence: null, created_at: "2026-09-25T09:00:00+07:00" },
        ],
        onRemove: vi.fn(),
      }),
    );
    expect(screen.getByText("Mã")).toBeTruthy();
    expect(screen.getByText("Hướng")).toBeTruthy();
    expect(screen.getByText("Tin cậy")).toBeTruthy();
    expect(screen.getByText("Cường độ")).toBeTruthy();
    expect(screen.getByText("Cập nhật")).toBeTruthy();
    expect(screen.getByText("BUY")).toBeTruthy();
    expect(screen.getByText("82%")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
  });

  it("caps selection at 5 symbols", () => {
    const { container } = render(
      createElement(AdvisoryCompareTable, {
        symbols: ["A", "B", "C", "D", "E", "F"],
        symbolStats: [],
        items: [],
        onRemove: vi.fn(),
      }),
    );
    expect(container.querySelectorAll("tbody tr").length).toBe(5);
  });
});

describe("share-link opens correct symbol (S13 AC-2)", () => {
  beforeEach(() => {
    Object.assign(hookState, {
      items: [],
      loading: false,
      error: null,
      symbolStats: [{ symbol: "FPT" }, { symbol: "SSI" }],
      refreshInfoMap: {},
    });
  });

  it("paste /ai-advisory?symbol=SSI opens SSI", async () => {
    (usePortfolio as any).mockReturnValue({ userPlan: "Pro", activePortfolioId: "p1" });
    const { WhaleAdvisoryPage } = await import("../../pages/signals/WhaleAdvisoryPage.tsx");
    const { container } = render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/ai-advisory?symbol=SSI"] },
        createElement(Routes, null, createElement(Route, { path: "ai-advisory", element: createElement(WhaleAdvisoryPage) })),
      ),
    );
    expect(container.querySelector("h2")?.textContent).toBe("SSI");
  }, 30000);
});
