# Handoff — Widget P3b feature enablement + VPS deploy (2026-11-10)

**Slice:** `feat/widget-p3b-enablement` (PR #324 MERGED). Ledger Entry 439.

## Đã làm
- VNStockChartPanel.js: injectVNInvestChartsCSS (thay dynamic CSS import), WidgetI18nProvider wrap, tier prop (free/pro/enterprise) + flags showPaperTrade/showSettings/showDrawingDock, render conditionally PaperTradePanel/SettingsModal/DrawingDock.
- tsc 0, build OK 20.98s, vitest 5/5, deploy-staging.sh --verify PASS (core-api healthy, workers 0 restart).

## Còn nợ
- P3.4: registerProExtension wiring + isProExtensionActive gate (pro tier).
- VPS chart render manual verify (cần auth).
- E2E.
- Tier source-of-truth backend chưa có → tier default 'free'.

## Next
Owner quyết định tier source-of-truth → implement P3.4, PR, deploy, verify.