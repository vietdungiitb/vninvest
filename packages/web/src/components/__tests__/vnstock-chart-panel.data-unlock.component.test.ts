/**
 * W0.9 / W1.4 / W2.1 — "mo khoa du lieu chart dang bi tat trong chinh repo".
 * Rev 2026-11-10 (widget 0.4.1): widget doi API — 2 prop cu chet + custom
 * 4-pane gay de legend (xem docs/PLAN_WIDGET_UI_FIX_20261110.md). Test giu
 * Y DO goc (du lieu mo, khong bat mu) nhung khop hop dong MOI:
 * DEFAULT_PANES + khong side tape panel + khong corporate events.
 *
 * D1 (Owner 2026-10-21): retail mua "charts" la nhu cau #1. Widget
 * `@vninvestcharts/widget@0.4.1` co san indicator + tape panel + workspace,
 * app phai truyen dung hop dong API moi (khong prop chet, khong pane tran).
 *
 * Test nay QUET NGUON (khong render widget) — cung pattern voi
 * `commercial-page.component.test.tsx` trong repo. Ly do: widget la npm package
 * ngoai repo, khong mock duoc trong vitest jsdom ma van assert duoc HOP DONG
 * prop ma app truyen cho widget.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PANEL_SRC = resolve(HERE, "..", "VNStockChartPanel.js");
const VI_I18N = resolve(HERE, "..", "..", "i18n", "vi.js");
const EN_I18N = resolve(HERE, "..", "..", "i18n", "en.js");

const src = readFileSync(PANEL_SRC, "utf8");
const vi = readFileSync(VI_I18N, "utf8");
const en = readFileSync(EN_I18N, "utf8");

describe("W0.9 — chart data unlock (demo-parity, widget 0.4.1)", () => {
  it("S1 — TAT showTapePanel side panel (demo-parity; Ban/Mua nam o footer)", () => {
    expect(src).toMatch(/showTapePanel:\s*false/);
    expect(src).not.toMatch(/showTapePanel:\s*true/);
  });

  it("S2 — KHONG truyen showWorkspaceToolbar (prop chet o widget 0.4.1 API)", () => {
    // Da xac minh: grep 0 hit trong VNInvestChartsProps.d.ts (306 dong).
    expect(src).not.toMatch(/showWorkspaceToolbar/);
    expect(src).not.toMatch(/showSymbolBadges/);
  });

  it("S3 — dung DEFAULT_PANES cua widget (khong custom pane de legend)", () => {
    // Custom 4 pane cu tong heightRatio 1.23 > 1 gay de legend (screenshot).
    expect(src).not.toMatch(/id: 'indicators'/);
    expect(src).not.toMatch(/panes:\s*customPanes/);
  });

  it("S4 — label i18n 'chartIndicators' co o CA vi.js va en.js", () => {
    expect(vi).toMatch(/chartIndicators:/);
    expect(en).toMatch(/chartIndicators:/);
  });

  it("S5 — KHONG bat showCorporateEvents khi BE chua co nguon du lieu (khong bat mu)", () => {
    expect(src).toMatch(/showCorporateEvents:\s*false/);
    // Comment ghi "corporate actions" (BE chua co nguon du lieu) — khop Y DO test:
    // "co comment giai thich", khong khop mot cum tieng Anh cu the.
    expect(src).toMatch(/corporate (events|actions)/i);
  });

  it("S6 — UI gon (2026-11-10): khong Dark Flow badge, an right-dock rail", () => {
    // Badge chi render khi strength la finite number (dist gate) — app khong
    // truyen prop thi badge mat han. Rail dock an khi showDock === false.
    expect(src).toMatch(/showDock:\s*false/);
    expect(src).not.toMatch(/darkFlowStrength:/);
    expect(src).not.toMatch(/darkFlowSignalType/);
  });

  it("S7 — an HAN 3 dong stacked `.Gc`, giu inline `.rsc-indicator-chip` nhu demo", () => {
    // DOM that: stacked VN labels+gear = `.Gc` (trong `.Cc` overlay);
    // inline ten ngan+gia tri = `.rsc-indicator-chip` (luon hien, demo-parity).
    // Chi an `.Gc`, KHONG hover-reveal (hover lam stacked hien lai).
    expect(src).toMatch(/VNStockChartPanel\.css/);
    const css = readFileSync(resolve(HERE, "..", "VNStockChartPanel.css"), "utf8");
    expect(css).toMatch(/\.rsc-engine-surface\s+\.Gc\s*\{[^}]*display:\s*none/);
    expect(css).not.toMatch(/:hover/);
    // Inline `.rsc-indicator-chip` (ten ngan + gia tri, demo-parity) KHONG bi an.
    expect(css).not.toMatch(/\.rsc-indicator-chip/);
  });

  it("S8 — tier gating tu Subscription.plan (P3.4, khong tenantPat/registerProExtension)", () => {
    // P34-license mo rong S8 cu: cho phep `licenseKey` (offline channel),
    // van cam tenantPat/client/registerProExtension/debugTier.
    expect(src).toMatch(/useTenantTier/);
    expect(src).toMatch(/licenseKey\s*:/);
    expect(src).not.toMatch(/tenantPat\s*:/);
    expect(src).not.toMatch(/registerProExtension/);
    expect(src).not.toMatch(/debugTier/);
  });

  it("S9 — licenseKey forward + secret-guard (khong blob that trong code)", () => {
    // Forward prop licenseKey (optional, default undefined) + observer
    // onLicenseDiagnostic; KHONG hardcode blob that (blob = `vni1.` + base64
    // dai; comment nhac dang format thi khong tinh).
    expect(src).toMatch(/licenseKey/);
    expect(src).toMatch(/onLicenseDiagnostic/);
    const panel = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panel).not.toMatch(/vni1\.[A-Za-z0-9_-]{20,}/);
    expect(src).not.toMatch(/vni1\.[A-Za-z0-9_-]{20,}/);
  });
});
