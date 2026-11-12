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
  it("S1 — W-B tape panel mo theo tier (doi quyet dinh demo-parity TAT -> pro feature)", () => {
    // W-B (2026-11-12): tape side panel mo theo tier (showTapePanel: isPro)
    // thay vi hardcode false — data THAT tu BE IntradayTapeView, free giu tat.
    // Tien le: S6/S11 showDock false->isPro; S13 showAdvisoryPanel false->isPro.
    expect(src).toMatch(/showTapePanel:\s*isPro/);
    expect(src).not.toMatch(/showTapePanel:\s*false/);
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

  it("S6 — UI gon (2026-11-10, sua 2026-11-11): khong Dark Flow badge; dock mo theo tier", () => {
    // Badge chi render khi strength la finite number (dist gate) — app khong
    // truyen prop thi badge mat han. Dock: tu 2026-11-11 mo theo tier
    // (showDock: isPro) de pro thay DataWindow/Watchlist; free giu an.
    expect(src).toMatch(/showDock:\s*isPro/);
    expect(src).not.toMatch(/showDock:\s*false/);
    expect(src).not.toMatch(/darkFlowStrength:/);
    expect(src).not.toMatch(/darkFlowSignalType/);
  });

  it("S7 — KHONG hide bat cu legend nao bang class hash (dot 0.4.4 khong con .Gc)", () => {
    // Da xac minh: grep 0 `.Gc` trong dist 0.4.4 (class hash doi theo ban) —
    // hack cu vo hieu va nguy hiem (trung ten voi order-ticket hint).
    // Quy tac moi: CSS panel khong duoc co rule display:none nao (khong giau
    // legend/indicator), khong hover-reveal, khong dung class hash.
    expect(src).toMatch(/VNStockChartPanel\.css/);
    const css = readFileSync(resolve(HERE, "..", "VNStockChartPanel.css"), "utf8");
    expect(css).not.toMatch(/display:\s*none/);
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
  });
  it("S10 — trust anchor JWK + licenseKey tu env (staging Pro, khong blob trong code)", () => {
    // Panel phai goi ensureLicenseTrustAnchor() 1 lan (module trust anchor
    // nhung JWK public kid=primary, KHONG blob mat).
    const panelS10 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS10).toMatch(/ensureLicenseTrustAnchor/);
    // StockDetailPage truyen licenseKey tu VITE_* env (build-arg staging),
    // KHONG hardcode blob.
    const sdp = readFileSync(resolve(HERE, "..", "..", "pages", "StockDetailPage.tsx"), "utf8");
    expect(sdp).toMatch(/VITE_VNINVEST_LICENSE_KEY/);
    expect(sdp).toMatch(/licenseKey/);
    expect(sdp).not.toMatch(/vni1\.[A-Za-z0-9_-]{20,}/);
    // Module trust anchor ton tai, chua JWK kid=primary + goi addLicensePublicKey.
    const anchor = readFileSync(resolve(HERE, "..", "..", "lib", "licenseTrustAnchor.js"), "utf8");
    expect(anchor).toMatch(/addLicensePublicKey/);
    expect(anchor).toMatch(/primary/);
    expect(anchor).not.toMatch(/vni1\.[A-Za-z0-9_-]{20,}/);
  });
  it("S11 — dock theo tier + statusline luon thay duoc (pro phô dien day du)", () => {
    // showDock phai mo khi pro (isPro) thay vi hardcode false — right dock
    // (DataWindow/Watchlist) la noi HLOC hover + tinh nang pro hien ro nhat.
    const panelS11 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS11).toMatch(/showDock:\s*isPro/);
    expect(panelS11).not.toMatch(/showDock:\s*false/);
    // CSS hack .Gc (hash 0.4.1) khong con ton tai tren 0.4.4 (0 match) — phai xoa,
    // hien tai no vo tinh trung ten voi order-ticket hint.
    const css = readFileSync(resolve(HERE, "..", "VNStockChartPanel.css"), "utf8");
    expect(css).not.toMatch(/\.Gc\b/);
    // Statusline bi widget dat inline opacity:0 (backgroundOpacity default 0) —
    // app phai ep hien qua attribute on dinh data-rsc-chart-status-line.
    expect(css).toMatch(/data-rsc-chart-status-line/);
  });
  it("S12 — tier app uu tien license da verify (mo dock/panel pro theo khoa that)", () => {
    // Panel tu verify licenseKey bang engine-core (offline, sau trust anchor)
    // va dat verifiedTier; tier app = verifiedTier ?? tierProp ?? serverTier.
    // Khong dung tenantPat/client (van cam nhu S8).
    const panelS12 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS12).toMatch(/verifyLicenseKey/);
    expect(panelS12).toMatch(/verifiedTier/);
    expect(panelS12).toMatch(/setVerifiedTier/);
    expect(panelS12).toMatch(/setVerifiedTier\(null\)/);
    expect(panelS12).not.toMatch(/tenantPat\s*:/);
  });
  it("S13 — W-A advisory panel trong chart dock (pro-only, map V2 -> legacy result)", () => {
    // Widget 0.4.4 khong forward advisorySession xuong bottom panel nen app
    // map V2 -> AdvisoryResult truoc khi truyen prop (xem JOURNAL Entry W-A).
    const panelS13 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS13).toMatch(/mapAdvisorySessionToResult/);
    expect(panelS13).toMatch(/getStockAIAdvisorySession/);
    expect(panelS13).toMatch(/refreshStockAIAdvisorySession/);
    expect(panelS13).toMatch(/showAdvisoryPanel:\s*isPro/);
    expect(panelS13).toMatch(/advisoryResult/);
    expect(panelS13).toMatch(/isAdvisoryLoading/);
    expect(panelS13).toMatch(/onAdvisoryRefresh/);
    expect(panelS13).not.toMatch(/showAdvisoryPanel:\s*false/);
  });
  it("S14 — W-B tape panel wiring (pro-only, map BE trades -> TapeEntry)", () => {
    // Wire tapeEntries tu BE IntradayTapeView (qua getIntradayTape) + filter
    // ty VND + loading; show theo isPro (S1). Chi assert source-level, khong
    // assert hanh vi widget (slider/filter la viec cua widget).
    const panelS14 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS14).toMatch(/mapTapeTradesToEntries/);
    expect(panelS14).toMatch(/getIntradayTape/);
    expect(panelS14).toMatch(/tapeEntries/);
    expect(panelS14).toMatch(/isTapeLoading/);
    expect(panelS14).toMatch(/tapeFilterBillions/);
    expect(panelS14).toMatch(/onTapeFilterChange/);
  });
  it("S15 — W-C error boundary + empty state (graceful degradation)", () => {
    // Boc chart trong WidgetErrorBoundary (retry remount qua key) + dung
    // WidgetEmptyState cho 3 nhanh (dang import / loading / bars rong).
    // Chi assert source-level wiring, khong assert render widget.
    const panelS15 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS15).toMatch(/WidgetErrorBoundary/);
    expect(panelS15).toMatch(/WidgetEmptyState/);
    expect(panelS15).toMatch(/widgetModule\?\.WidgetErrorBoundary/);
    expect(panelS15).toMatch(/widgetModule\?\.WidgetEmptyState/);
    expect(panelS15).toMatch(/retryKey/);
    expect(panelS15).toMatch(/importKey/);
    expect(panelS15).toMatch(/onRetry/);
  });
  it("S16 — W-D measurement overlay enable (pro-only, 1 prop)", () => {
    // Overlay do khoang gia/thoi gian thuan client, khong can data/adapter.
    // Mo theo tier nhu dock/tape/advisory.
    const panelS16 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS16).toMatch(/measurementEnabled:\s*isPro/);
    expect(panelS16).not.toMatch(/measurementEnabled:\s*false/);
    expect(panelS16).not.toMatch(/measurementEnabled:\s*true/);
  });
  it("S17 — W-E CVD histogram + defaultTimezone (2 props, no-guess guard)", () => {
    // Chi wire prop co du bang chung (cvdMode union + WidgetTimezone enum).
    // whaleThreshold (unit chua ro) + zoomSpeed/maxVisibleBars/
    // historyMinResidentBars (perf knob chua do) KHONG truyen.
    const panelS17 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS17).toMatch(/cvdMode:\s*['"]histogram['"]/);
    expect(panelS17).toMatch(/defaultTimezone:\s*['"]Asia\/Ho_Chi_Minh['"]/);
    expect(panelS17).not.toMatch(/whaleThreshold\s*:/);
    expect(panelS17).not.toMatch(/zoomSpeed\s*:/);
    expect(panelS17).not.toMatch(/maxVisibleBars\s*:/);
    expect(panelS17).not.toMatch(/historyMinResidentBars\s*:/);
  });
  it("S18 — W-F upgrade URL + telemetry hook (upsell CTA + observability sink)", () => {
    // upgradeUrl tro ve route /upgrade (system, khong capability — dung
    // doi tuong free thay nudge). onTelemetry forward qua hook nha
    // (trackWidgetEvent, pattern emit san co). Chi assert source-level.
    const panelS18 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS18).toMatch(/upgradeUrl:\s*['"]\/upgrade['"]/);
    expect(panelS18).toMatch(/onTelemetry/);
    expect(panelS18).toMatch(/useTrustTelemetry/);
    expect(panelS18).toMatch(/trackWidgetEvent/);
    const hook = readFileSync(resolve(HERE, "..", "..", "hooks", "useTrustTelemetry.js"), "utf8");
    expect(hook).toMatch(/trackWidgetEvent/);
  });
  it("S19 — W-I: drawing dock phai do WIDGET render (showDrawingDock:isPro), KHONG mount DrawingDock standalone", () => {
    // B3 2026-11-12: widget chi render drawing dock khi host truyen
    // `showDrawingDock` (dts VNInvestChartsProps.d.ts:256; bundle: jg() tra
    // null khi `!showDrawingDock && !forceOpen`). Panel truoc day mount
    // <DrawingDock workspaceId=...> truc tiep — DrawingDockProps yeu cau
    // isOpen/activeTab/labels/onClose/onTabChange nen thieu isOpen => render
    // null => dock KHONG bao gio hien, pro user khong co drawing dock.
    const panelS19 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS19).toMatch(/showDrawingDock:\s*isPro/);
    expect(panelS19).not.toMatch(/widgetModule\?\.DrawingDock/);
    expect(panelS19).not.toMatch(/panels\.push\(e\(DrawingDock/);
  });
  it("S20 — W-I: KHONG truyen drawings/defaultDrawings (controlled-mode se TAT persistence)", () => {
    // Persistence mac dinh cua widget bat khi instance UNCONTROLLED
    // (engine-react: isControlled = drawings !== void 0; storage bat khi
    // `enabled && !isControlled`). Truyen `drawings` => tat luu drawing.
    // KHONG truyen `drawingStorageKey`/`drawingStorageAdapter`/`instanceId`:
    // doi prefix se ORPHAN drawings da luu duoi `rsc-drawings-v1-*` (can
    // migration + Owner chot scope user/tenant truoc).
    const panelS20 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS20).not.toMatch(/(^|[\s,{])drawings\s*:/m);
    expect(panelS20).not.toMatch(/defaultDrawings\s*:/);
    expect(panelS20).not.toMatch(/drawingStorageKey\s*:/);
    expect(panelS20).not.toMatch(/drawingStorageAdapter\s*:/);
    expect(panelS20).not.toMatch(/instanceId\s*:/);
    expect(panelS20).toMatch(/drawingUiEnabled:\s*true/);
  });
  it("S21 — W-K: quan sat overlay so sanh (onComparisonChange) + chip row goi removeCompareSymbol", () => {
    // Widget gui `onComparisonChange(overlays)` khi overlays doi (dts:291;
    // bundle: `oe.current?.(fe.overlays)`). Host can render chip de user thay
    // dang so sanh ma nao; nut xoa goi ref `removeCompareSymbol` (widget
    // expose qua useImperativeHandle -> Rp forward ref).
    const panelS21 = readFileSync(resolve(HERE, "..", "VNStockChartPanel.js"), "utf8");
    expect(panelS21).toMatch(/onComparisonChange/);
    expect(panelS21).toMatch(/mapComparisonOverlaysToSymbols/);
    expect(panelS21).toMatch(/removeCompareSymbol/);
    expect(panelS21).toMatch(/handleComparisonChange/);
    expect(panelS21).toMatch(/comparedSymbols\.length\s*>\s*0/);
  });
});
