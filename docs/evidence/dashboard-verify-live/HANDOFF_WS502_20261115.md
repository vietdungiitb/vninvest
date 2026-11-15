# HANDOFF — WS 502 dashboard (phiên 2026-11-14/15)

> Phiên sau đọc file này + Entry 508–518 là đủ, không cần rà lại log.

## Đã xong (merged vào dev)
| PR | Nội dung | Entry |
|---|---|---|
| #405 | Registry 40 entries + gate parser + Phase2 async + banner + retry | 508 |
| #407 | BE bulk dispatch threadpool riêng | 509 |
| #408 | Closeout (claim done) | — |
| #409 | Deploy + verify live (bulk 10/10 200, Playwright 9/9) | 510 |
| #410 | Diagnosis WS 502 (daphne đơn process đói event loop) | 511 |
| #411 | Bulk cache 60s + WS auth off shared thread (TDD, test VPS 3/3) | 512 |
| #412 | FE dedupe concurrent bulk (test 56/56) | 513 |
| #413 | Dual daphne (:8100 HTTP + :8101 WS) + CPU staging 0.5→2.0 + TTL 300s | 514 |
| #414 | Bulk chunk concurrency 2 (test 57/57) | 514 |
| #415 | Closeout (user xác nhận reload hết lỗi) | 515 |
| #416 | FE debounce bulk 30s (WatchlistContext + useCoreDashboardData) | 516 |
| #417 | FE WS handshake dùng ticket single-use (thay raw PAT) | 517 |
| #418 | Closeout (bundle mới live, chờ user reload) | 518 |

## Trạng thái staging (VPS 14.225.255.47, /opt/vninvest, dev @ #418+)
- Deploy + `--verify` 11/11 PASS. 2 daphne chạy (8100/8101). CPU limit 2.0, MEM 512m
  (backup env: `compose.staging.env.bak-20261114`).
- Bundle FE mới: `hooks-BCiCY1L_.js` chứa `auth/ws-ticket` (trước là `hooks-C8HQ8SFM.js`).
- Baseline cuối: P502=515, P101=483 (2026-11-15T01:41:07Z).

## Việc dở — phiên sau làm tiếp
1. **User hard-reload dashboard** → kiểm tra log chỉ còn `?ticket=` (không `?token=`),
   đếm bulk POST + 502 mới → ghi Entry 519.
2. **Revoke/rotate PAT `vni_internal_BqJaKW_...`** (lộ trong chat + access log) — Owner làm.
3. AI panel timeout 10s (đường advisory/LLM) — ticket riêng, ngoài scope WS 502.
4. Lần load lạnh đầu sau >5 phút idle vẫn có thể lọt 1-2 cái 502 (thundering herd,
   cache TTL 300s) — chấp nhận được, không phải bug mới.

## Claim
- Tất cả claim `ws-502-*` + `dashboard-*` liên quan đã `done`. Không còn branch/worktree
  sót của phiên này (làm trên main tree + worktree tạm VPS đã xóa).
