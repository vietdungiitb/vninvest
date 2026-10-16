/**
 * R1.6 — chart theo token + bảng số thay thế + format app.
 * Fail-before: AC1 (6 hex/rgba) / AC3 (không .srOnly) / AC5 (toLocaleString trần)
 * / AC6 ($0.010000 thay vì $0.0100) RED. AC2/AC4 ảnh/contrast CHƯA CHẠY.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AIUsageDashboard } from "../AIUsageDashboard";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import * as LangContext from "../../context/LangContext.js";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const DASH = resolve(process.cwd(), "src/components/AIUsageDashboard.tsx");
const CSS = resolve(process.cwd(), "src/components/aiSettings.module.css");

const i18nValue = {
  locale: "vi",
  localeTag: "vi-VN",
  t: (key: string) => key,
  formatNumber: (n: unknown) => String(n ?? ""),
  formatCurrency: (n: unknown, currency?: string, options?: Record<string, unknown>) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      ...(options ?? {}),
    }).format(Number(n)),
  formatPriceVND: (n: unknown) => n,
  formatQuotePrice: (p: unknown) => p,
  formatQuoteVolume: (v: unknown) => v,
  formatQuoteInteger: (v: unknown) => v,
  formatDate: (d: unknown) => d,
  formatTime: (t: unknown) => t,
  formatDateTime: (dt: unknown) => String(dt ?? ""),
};

beforeEach(() => {
  vi.spyOn(coreApiAdapter, "getAIUsageAggregate").mockResolvedValue({
    total_requests: 10,
    total_tokens_in: 100,
    total_tokens_out: 50,
    total_cost: "1.5",
    avg_latency: 200,
  });
  vi.spyOn(coreApiAdapter, "getAIUsageSummary").mockResolvedValue({
    results: [
      {
        date: "2024-01-01",
        action: "chat",
        total_requests: 1,
        total_tokens_in: 100,
        total_tokens_out: 50,
        total_cost: "0.01",
        avg_latency_ms: 200,
      },
    ],
  });
  vi.spyOn(coreApiAdapter, "getAIUsageRecords").mockResolvedValue({
    results: [
      {
        id: "1",
        created_at: "2024-01-01T00:00:00Z",
        action: "chat",
        provider: "openai",
        model: "gpt-4",
        tokens_in: 100,
        tokens_out: 50,
        cost: "0.01",
        latency_ms: 200,
        status: "success",
      },
    ],
    total: 1,
  });
  vi.spyOn(LangContext, "useI18n").mockReturnValue(i18nValue);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("R1.6: chart token + bảng số", () => {
  it("AC1: 0 hex/rgba ngoài chartToken fallback trong dashboard", () => {
    const src = readFileSync(DASH, "utf8");
    // cùng luật với gate check-ai-cc AC7: allowlist theo block FALLBACK + dòng chartToken(
    const fbStart = src.indexOf("CHART_TOKEN_FALLBACK");
    const fbEnd = fbStart >= 0 ? src.indexOf("};", fbStart) : -1;
    const bad = src.split("\n").filter((ln) => {
      if (!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(ln)) return false;
      if (ln.includes("chartToken(")) return false;
      if (fbStart >= 0 && fbEnd >= 0) {
        const at = src.indexOf(ln);
        if (at >= fbStart && at <= fbEnd) return false;
      }
      return true;
    });
    expect(bad, bad.slice(0, 4).join("\n")).toEqual([]);
  });

  it("AC3: chart aria-hidden + bảng số .srOnly có số liệu", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByTestId("usage-chart")).toBeTruthy();
    });
    const chart = screen.getByTestId("usage-chart");
    expect(chart.getAttribute("aria-hidden")).toBe("true");
    const table = document.querySelector(".srOnly, [class*='srOnly']");
    expect(table, "thiếu bảng số thay thế").toBeTruthy();
    expect(table?.textContent).toContain("100");
  });

  it("AC5: không .toLocaleString() trần trong dashboard", () => {
    const src = readFileSync(DASH, "utf8");
    const hits = src.split("\n").filter((ln) => /\.toLocaleString\(/.test(ln));
    expect(hits, hits.slice(0, 3).join("\n")).toEqual([]);
  });

  it("AC6: USD 1 chỗ tròn số 4dp ($0.0100, không $0.010000)", async () => {
    await act(async () => {
      render(createElement(MemoryRouter, null, createElement(AIUsageDashboard, {})));
    });
    await waitFor(() => {
      expect(screen.getByTestId("usage-chart")).toBeTruthy();
    });
    expect(document.body.textContent).toContain("0.0100");
    expect(document.body.textContent).not.toContain("0.010000");
  });

  it("AC4-contract: block css R1.6 chart chỉ dùng token", () => {
    const css = readFileSync(CSS, "utf8");
    const start = css.indexOf("/* R1.6 chart");
    expect(start, "thiếu block R1.6 chart").toBeGreaterThan(-1);
    const end = css.indexOf("/* /R1.6 */", start);
    const block = css.slice(start, end);
    expect(/#[0-9a-fA-F]{3,8}\b/.test(block)).toBe(false);
    expect(block.includes("var(--ai-")).toBe(true);
  });
});
