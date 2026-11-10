# Handoff — Widget UI fix "kinh dị" → demo-parity (2026-11-10)

**Slice:** `feat/widget-ui-fix` (PR #326 MERGED). Ledger Entry 440.

## Root cause (3 cái, đã verify source)
1. Mất CSS: bỏ `index.css` import + `inject()` không arg (API yêu cầu `target`).
2. Custom 4 pane ratio tổng 1.23 > 1 + 13 series → legend đè nhau.
3. Dead props (`showWorkspaceToolbar`, `showSymbolBadges`) + `showTapePanel:true` đè Bán/Mua.

## Đã làm
- CSS import + `inject(document)`; bỏ `panes` → DEFAULT_PANES; xoá dead props; tape off; i18n provider đủ locale+messages. Giữ tier-gating P3b.
- Test rev hợp đồng mới 5/5. tsc 0, build 18s, check-multi-agent PASS.
- Deploy staging PASS; visual verify (admin/admin123): 5 canvas, screenshot đẹp như demo.
- B3 AGREE + B8 PASS 2 vòng (subagent độc lập).

## Còn nợ
- Pre-existing: 2× WS handshake fail, 1× 404 advisory endpoint, 2 lint errors (ShellMailConfigPage, VipLocalControlPage) — không do slice.
- P3.4 `registerProExtension` (cần backend tier source-of-truth). E2E full.

## Next
Owner quyết tier source-of-truth → P3.4. Không nợ UI nào khác.
