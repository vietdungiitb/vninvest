# PLAN — Fix `/stocks/:symbol` chậm (theo PEER_REVIEW_20261121 AGREE)

- **Ngày**: 2026-11-21 · **Branch**: `docs/allsymbols-close-claims` · **Agent**: `stock-slow-load`
- **Nguồn**: `docs/AUDIT_STOCK_DETAIL_SLOW_LOAD_20261121.md` (Entry 581) + `docs/evidence/stock-slow-load/PEER_REVIEW_20261121.md` (Entry 582, verdict AGREE).
- **Lessons áp dụng**: [L-001, L-002, L-G01, L-G02, L-B01, L-T01, L-T02, L-V01, L-V02, L-V04, L-S02]

## Mục tiêu (Given/When/Then)

1. **R2 — staging `CORE_DB_CONN_MAX_AGE=0→60`**: Given env staging đang `0` (đã xác nhận bằng `printenv`); When đổi thành `60` + restart `vninvest-core-api`; Then percentile `duration_ms` 2h giảm (mục tiêu `auth/me` p50 < 2s), đo bằng cùng probe `probe_r1r2.py`.
2. **F-07 — trailing slash `getSessionFactsCvd`**: Given FE gọi `/session-facts/VIC/cvd?window=1h` ăn 301 mất 8,7s; When thêm `/` cuối trong `market.js:293`; Then không còn request 301 trong Playwright capture, BE route vẫn match (Django `APPEND_SLASH` route gốc đã có slash).
3. **F-04 — phân tích trùng request**: Given peer review phát hiện params khác nhau (model `1h` vs chart `30m`/`session`); When đọc code + so response shape; Then kết luận giữ nguyên (by design) hoặc unify — KHÔNG đổi behavior khi chưa có quyết định Owner.
4. **F-02/F-01**: cần Owner (memory/pool cho worker; compliance cho audit-limit) → ghi câu hỏi, KHÔNG code trong slice này.

## SCOPE (file được chạm)

- `packages/web/src/adapters/core/market.js` (1 dòng: thêm `/`)
- Test bao phủ `getSessionFactsCvd` nếu có (fail-before → pass-after)
- `docs/CLAIMS.md` (1 dòng claim), `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 583), `docs/evidence/stock-slow-load/FIX_GATES_20261121.md`
- Staging (KHÔNG commit repo): `/opt/vninvest/compose.staging.env` (`CORE_DB_CONN_MAX_AGE`), restart api

## Non-goals / LIMIT

- Không sửa `PortfolioContext` bootstrap (F-03, P1 — slice sau).
- Không giới hạn audit-write (F-01), không tăng worker (F-02), không chạm deny-list (`package.json`, `docker-compose*.yml`, `.env*` trong repo).
- Tối đa 3 vòng sửa/test; quá thì ghi `blocker`.

## Gates

- `node packages/web/scripts/check-multi-agent.mjs` (trước sửa + sau rebase)
- `npx tsc --noEmit` (packages/web) sau sửa
- vitest file bao phủ `session-facts` (fail-before trên code cũ → pass-after)
- Đo lại: curl 4 endpoint + percentile probe sau restart staging
- `node docs/audit-uiux/scripts/check-ledger-entry.mjs` sau prepend Entry

## Rollback

- F-07: revert 1 dòng. R2: đặt lại env `0` + restart (ghi rõ giá trị cũ trong evidence).
