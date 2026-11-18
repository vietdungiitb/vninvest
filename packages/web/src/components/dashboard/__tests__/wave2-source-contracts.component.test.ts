import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatHeatmapTooltip } from "../PortfolioHeatmap.js";

const src = (p: string) => readFileSync(resolve(process.cwd(), "src", p), "utf8");

describe("Wave 2 P1/P2 — hop dong nguon (fail-before)", () => {
  it("A1 P1-1: .seg wrap thay vi an pill bang scroll ngang", () => {
    const css = src("index.css");
    expect(css).toMatch(/\.seg\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(css).not.toMatch(/\.seg\s*\{[^}]*flex-wrap:\s*nowrap/s);
  });

  it("A2 P1-2: khong noi title + summary thanh 1 dong truncate", () => {
    const s = src("components/dashboard/UnifiedAlertCenter.js");
    expect(s).not.toContain("`${titleText} — ${summaryText}`");
    expect(s).toContain("line-clamp-2");
  });

  it("A3 P1-7: dung Link SPA va truyen du 4 prop read/mute", () => {
    const c = src("components/dashboard/UnifiedAlertCenter.js");
    expect(c).toContain("useInRouterContext");
    expect(c).toContain("to: \"/alert-center\"");
    const p = src("pages/DashboardPage.tsx");
    for (const prop of ["readAlertIds", "unreadCount", "markAlertAsRead", "muteSymbolFor30m"]) {
      expect(p).toContain(prop);
    }
  });

  it("B1 P1-3: header Heatmap co the wrap, subtitle khong truncate", () => {
    const s = src("components/dashboard/PortfolioHeatmap.js");
    expect(s).toMatch(/core-heatmap-header[^"']*flex-wrap/);
    expect(s).not.toMatch(/scopeLine[\s\S]{0,240}truncate/);
  });

  it("B2 P1-4: --dash-chrome duoc DINH NGHIA va dung, giu align stretch", () => {
    const css = src("index.css");
    expect(css).toMatch(/--dash-chrome:\s*\d+px/);
    expect(css).toMatch(/max-height:\s*min\(720px,\s*calc\(100dvh\s*-\s*var\(--dash-chrome\)\)/);
    expect(css).toMatch(/\.dashboard-triad-grid\s*\{[^}]*align-items:\s*stretch/s);
  });

  it("B3 P2-1/Q4: click tile mo popover, sunburst co nhanh isOther", () => {
    const s = src("components/dashboard/PortfolioHeatmap.js");
    expect(s).toMatch(/handleClick[\s\S]{0,600}setSelectedDetail/);
    expect(s).toContain('role: "dialog"');
    const html = formatHeatmapTooltip(
      { name: "Khác (40 mã)", value: 100, data: { isOther: true, otherCount: 40, otherSymbols: ["VNZ", "IDP"], changePct: -0.15 } },
      { isMarketCap: false, t: (k: string, o?: Record<string, unknown>) => `${k}:${o?.count}:${o?.symbols}` },
    );
    expect(html).toContain("40");
    expect(html).toContain("VNZ");
    expect(html).toContain("heatmap.otherTooltip");
  });

  it("C1 P1-5: Bell khong navigate tren trigger, khong hardcode thong bao", () => {
    const s = src("layouts/full/vertical/header/Header.tsx");
    expect(s).not.toContain("No new notifications");
    expect(s).toContain("useRealtimeContext");
    expect(s).not.toMatch(/className:\s*'relative'[\s\S]{0,200}onClick:\s*\(\)\s*=>\s*navigate\('\/alert-center'\)/);
  });

  it("C2 P1-6: SmartStatsHeader nam duoi Header", () => {
    expect(src("components/dashboard/SmartStatsHeader.js")).toContain("top-[4.5rem]");
  });

  it("C3 P2-5: breadcrumb/flag/search tren Header", () => {
    const s = src("layouts/full/vertical/header/Header.tsx");
    expect(s).toContain("DashboardBreadcrumbLabel");
    expect(s).not.toContain("🇻🇳");
    expect(s).not.toMatch(/max-w-md mx-8 hidden md:block/);
  });

  it("D1 P2-2: bo nut disabled va key i18n chet", () => {
    const s = src("features/dashboard/AIAdvisorAlertPanel.js");
    expect(s).not.toContain("disabled: true");
    expect(s).not.toContain("useState(propAlerts ?? [])");
    expect(src("i18n/locales/vi/aiAdvisor.js")).not.toContain("viewPrevSession");
    expect(src("i18n/locales/en/aiAdvisor.js")).not.toContain("viewPrevSession");
  });

  it("D2 P2-3: tab/badge i18n va truyen t xuong AI panel", () => {
    const s = src("components/dashboard/CoreDashboardPositionDeck.tsx");
    expect(s).not.toContain("label: 'Tổng quan'");
    expect(s).not.toContain("holdings: 'Holding'");
    expect(s).toMatch(/<AIAdvisorDeckPanel[\s\S]{0,600}t=\{t\}/);
  });

  it("E1 P2-4: watchlistGroups vao deck, khong nhill enum Anh", () => {
    const s = src("pages/DashboardPage.tsx");
    expect(s).toContain("watchlistGroups={watchlistGroups}");
    expect(s).not.toContain("({realtimeFeed.realtimeStatus})");
  });
});
