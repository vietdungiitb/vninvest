# PLAN REMAINING GATES 20261108 — Đóng mọi mục CHƯA CHẠY sau PR#300

> Ngày: 2026-11-08 · Branch: `feat/remaining-gates-20261108` · Worktree: `remaining-gates-20261108` (base `origin/dev @ 322fbc185` PR#300 merged)
> Phạm vi: 11 mục CHƯA CHẠY còn lại sau PR#300 (FE vitest/build/lint, VPS verify, dump manifest, W0-2/W0-4/W0-5/W0-7/W0-9, W1-1 verify-only, W2-1 i18n)
> Lessons áp dụng: [L-001, L-002, L-003, L-V01, L-V02]
> Nguyên tắc: test/build chạy trên VPS staging (cấm local Docker theo runbook §12); gate nào không chạy được ghi CHƯA CHẠY + lý do, không fake PASS (L-G02)

## B1 baseline (đo thật tại HEAD worktree)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| `check-multi-agent` | `node packages/web/scripts/check-multi-agent.mjs` | exit 0 PASS (0 lỗi; 157 cảnh báo không chặn) |
| `check-lessons` | `node scripts/check-lessons.mjs` | exit 0 (14 file \| 57/60, sạch) |
| `tsc` | `npx tsc --noEmit` (packages/web) | exit 0 |
| `normalize-eol` | `node scripts/normalize-eol.mjs docs` | exit 0 OK |
| FE vitest full | `npx vitest run` (packages/web) | **CHƯA CHẠY tại plan** — sẽ chạy ở B6 theo test:components config |
| FE build | `npm run build` (packages/web) | **CHƯA CHẠY tại plan** |
| FE lint | `npm run lint` (packages/web) | **CHƯA CHẠY tại plan** |
| VPS verify | `bash scripts/deploy-staging.sh --verify` (VPS) | **CHƯA CHẠY tại plan** — VPS repo có PR#300, container image cũ (9 ngày), cần rebuild + verify |
| Dump manifest | `packages/core/backend/scripts/dump-core-route-manifest.py` (VPS) | **CHƯA CHẠY tại plan** — manifest thủ công 631→521 đã khớp VPS trong session trước, cần regen lại sau PR để xác nhận |
| MCP route-contract | `npm run test -- route-contract` (packages/web) | 4/4 PASS (đã chạy ở session trước, local) |
| BE regression (số liệu VPS session trước, CHƯA XÁC MINH tại HEAD này) | docker exec trên VPS (env DB test) | env 25, signal_norm 40, saml 10, pricing 1, beat 4 — **CHƯA XÁC MINH tại HEAD `322fbc185`**, sẽ regression-verify lại ở B6 (không dùng làm baseline B6) |

## SCOPE (file chạm)

Trong worktree:
- `docs/PLAN_REMAINING_GATES_20261108.md` (plan này)
- `packages/web/src/components/workstation/StockOrderBookWidget.estimated.component.test.tsx` (W0-2, mới; badge thật `packages/web/src/components/workstation/StockOrderBookWidget.jsx:153-161`, chain verify-only `packages/web/src/components/workstation/hooks/useOrderBook.js:19-80` → `packages/web/src/pages/StockDetailPage.tsx:225,309` → `packages/core/backend/src/market_serving/native_views.py:515-527` không sửa)
- `packages/web/src/components/workstation/StockOrderBookWidget.jsx` (W0-2 — chỉ thêm `role="note"` nếu B3/B8 yêu cầu)
- `packages/web/src/i18n/en.js` (W2-1-i18n phần nhãn — hit `en.js:3779` `AI Intelligence Recommendation`, `en.js:5185` `Recommendation history`, thường `en.js:3777,3784,5187`; **không đóng** `packages/core/backend/src/advisory/orchestrator.py:722-726` LLM contract `signal: BUY|SELL|HOLD` — còn nợ ticket riêng)
- `packages/web/src/i18n/vi.js` (W2-1-i18n phần nhãn — hit `vi.js:5187` `invalidationWarning`, `vi.js:6944` `staleWarning` (trước ghi 6959 — đã đính chính theo verdict B3))
- `packages/web/src/adapters/core/__tests__/core-route-manifest.json` (chỉ khi regen VPS khác manifest hiện tại)
- `packages/core/backend/src/identity_access/tests/test_saml_signature_mode.py` (W0-4 regression-verify)
- `packages/core/backend/src/vninvest_core/tests/test_no_timezone_utc.py` (W0-5 regression-verify)
- `packages/core/backend/tests/test_ad_signing_secret.py` (W0-9 regression-verify)
- `packages/core/backend/tests/test_vnpay_ipn_security.py` (W0-9 regression-verify)
- `packages/core/backend/src/vninvest_core/tests/test_api_envelope_schema.py:612-621` (W0-7 refute — 5 entry ViewSet, không sửa code)
- `packages/web/src/app/routeCatalog.js:215-223` (`broker` `/broker`) + `:237-248` (`portfolios-manage-broker` redirect) (W1-1 verify-only; wiring `packages/web/src/pages/portfolio/manage/usePortfolioManage.ts:105`, `packages/web/src/pages/portfolio/PortfolioOverviewPage.tsx:59`, `packages/web/src/pages/watchlist/components/WatchlistContext.tsx:87` đã green từ W1-1 gốc — không sửa)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` (B9 ledger Entry)
- `docs/CLAIMS.md` (B5 claim + B9 done — append-only cuối bảng)
- `docs/evidence/remaining-gates/` (verdict audit B3/B8 + evidence VPS)

Ngoài worktree (chỉ đọc + lệnh VPS, không sửa file local):
- VPS `/opt/vninvest` (branch `dev`): `bash scripts/deploy-staging.sh --verify`, `dump-core-route-manifest.py`, BE regression tests

## LIMIT

- Tối đa 3 vòng sửa lặp trong một bước; quá → ghi `blocker`, dừng, không sửa bừa.
- W2-1 i18n: nếu `CLAIMS.md` ghi `vi.js`/`en.js` đang có claim `in-progress` của agent khác → **DỪNG**, không sửa, ghi `blocker`.

## Non-goals

- Không migration, không `npm install`/`pip install`, không đụng 10 file shared (§2).
- Không sửa runtime ngoài 2 file i18n + 1 file badge + test mới (ponytail: diff nhỏ nhất).
- **W2-1-i18n không đóng M6-01 LLM contract** (`orchestrator.py:722-726` `signal: BUY|SELL|HOLD` + `target_price` + ~35 key) — còn nợ trong ticket riêng theo D2; plan này chỉ đổi nhãn UI.
- Không xóa test/file còn dùng.

## Rollback

- `git reset --hard HEAD` xóa toàn bộ commit của branch (chưa push) — an toàn vì chưa có PR.
- VPS deploy verify là `--verify` (không recreate container nếu đã healthy); nếu deploy rebuild thì backup `compose.staging.env` trước.

## Tiêu chí nghiệm thu (Given/When/Then)

- Given cây PR#300 đã merge, when chạy `npx vitest run` + `npm run build` + `npm run lint` (packages/web), then báo cáo exit-code thật từng cổng (0 PASS hoặc ghi lỗi file:line).
- Given VPS `/opt/vninvest` ở `322fbc185`, when chạy `bash scripts/deploy-staging.sh --verify`, then báo health 2xx + container healthy, và `dump-core-route-manifest.py` cho `core=521` khớp manifest local (diff rỗng).
- Given W0-2 test mới + existing `StockOrderBookWidget.test.jsx`, when `npx vitest run StockOrderBook` (hoặc test:components), then badge `Dữ liệu ước tính` hiện khi `is_mock:true`, ẩn khi `false`.
- Given W0-4/W0-5/W0-9 BE tests trên VPS (`test_ad_signing_secret`, `test_saml_signature_mode`, `test_no_timezone_utc`, `test_vnpay_ipn_security`), then PASS không fake (hoặc ghi `CHƯA CHẠY + lý do` nếu VPS test DB không tái lập được).
- Given W0-7 `KNOWN_UNREADABLE` chỉ còn 5 entry ViewSet (không phải broker), when đọc `test_api_envelope_schema.py:612-621`, then đóng mục với ghi chú refute (không cần code).
- Given W1-1 routeCatalog broker (`/broker` + redirect), when đọc `routeCatalog.js:215-248`, then verify-only PASS.
- Given W2-1-i18n (phần nhãn), when grep case-insensitive (`recommendation`/`Recommend`) tại `en.js:3779,5185` + thường `en.js:3777,3784,5187` và `vi.js:5187,6944` sau sửa, then 0 chuỗi `Recommendation`/`Khuyến nghị` dạng khuyến nghị đầu tư (chỉ còn technical analysis), `npm run i18n:scan:strict` exit 0. **Phần LLM contract `orchestrator.py:722-726` còn nợ, không đóng ở plan này.**

## Lessons áp dụng: [L-001, L-002, L-003, L-V01, L-V02]

## Tiến độ

- [x] B1 đo lường (check-multi-agent PASS, tsc exit 0, worktree sạch)
- [x] B2 plan (file này) — **rev2 theo verdict B3 R1** (file:line đầy đủ SCOPE, W2-1-i18n ghi rõ nợ LLM contract, baseline BE hạ thành CHƯA XÁC MINH)
- [ ] B3 audit độc lập + B4 đồng thuận (vòng 1 NEED_REVISION → chờ audit vòng 2)
- [ ] B5 claim + cách ly
- [ ] B6 thực thi (vitest/build/lint, VPS verify/dump, W0-2 test, W0-4/W0-5/W0-9 verify, W0-7 refute, W1-1 verify, W2-1 i18n)
- [ ] B7 gates re-run
- [ ] B8 re-audit độc lập
- [ ] B9 claim done + ledger + PR
