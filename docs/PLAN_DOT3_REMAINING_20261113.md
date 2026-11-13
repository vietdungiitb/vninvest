# PLAN — Dot3 remaining BE: S2.2 B-4 + S3.2 B-6 + license 0008 — rev 1

> **Ngày:** 2026-11-13 · **Trạng thái:** KẾ HOẠCH rev 1 — chờ audit B3
> **Claim:** `dot3-remaining-20261113` (`docs/CLAIMS.md`, appended, `in-progress`, commit `20dafa5ed`)
> **Branch:** `feat/dot3-remaining-20261113` → `dev` (PR) · **Base đo:** `origin/dev` @ `02a8891ce` (PR #375 dot2 đã merge)
> **Nguồn:** `docs/PLAN_REMAINING_WORK_20261113.md` §5 (Đợt 2-3) + `docs/PLAN_DOT2_BACKEND_20261113.md` §P4-defer + Entry 478 §Con lại
> **Lessons áp dụng:** [L-001, L-002, L-003, L-007, L-008, L-M02, L-M01, L-M02mig, L-M04, L-G01, L-V02]
> **Audit độc lập (B3, subagent read-only):** NEED_REVISION (0 B / 1 M / 3 m, `docs/evidence/dot3-remaining-20261113/audit.md`) → đã sửa ở rev 2 (xem §7).

---

## 0. Kết luận 1 trang

1. **P1 — S2.2 B-4 fundamentals typed:** `vnbroker_adapter.py:1226,1239,1252` hardcode `period='quarter'`, không `cash_flow`; schema `stock_mgmt_native_views.py:311-319` lõi `financials` là `object nullable`. Việc: 5 key cố định (`period,year,quarter,report_date,items`), `?period=quarter|year` (không hỗ trợ → 400 `UPPER_SNAKE`), `cash_flow=null+note`, số là number / thiếu là null, `@extend_schema` ra `$ref`. **V1 B-4 (m3):** signature `Finance.ratio/income_statement/balance_sheet` của package ngoài `vnbroker` KHÔNG có trong repo → `period=year` **CHƯA XÁC MINH**; AC giữ nhánh 400 fallback, probe runtime ở B6 mới chốt.
2. **P2 — S3.2 B-6 P0 bảo mật (chỉ 2 việc thật):** 0 scope check trong `market_serving/`, `market_data/`, `signal_intelligence/`, `advisory/` (đo: grep `require_pat_scopes` 0 hit cả 4 app); schema mount vô điều kiện `vninvest_core/urls.py:56-58`. Việc: enforce `market:read` / `signals:read` / `ai:invoke` via `require_pat_scopes_or_human_session` (`identity_access/permissions.py:39`), đóng schema khi `DEBUG=False`. Đã có sẵn (chỉ thêm test hồi quy, bằng chứng M1): `X-RateLimit-Limit/Remaining/Reset/Resource` (`identity_access/middleware.py:607-610`, `identity_access/throttles.py:140-142`); `Retry-After` là header bổ sung của envelope 429 (`identity_access/envelope.py:47`, DRF tự thêm cho `Throttled`); admin-ops 410 (`vninvest_core/urls.py:78-79` amidst `:39-44,79`); SSE ping 15s (`signal_intelligence/views.py:905-906`) + `keep-alive` (`:926`).
3. **P3 — License 0008:** model `LicenseKey` (`commercial/models.py:168-200`) có nhưng migration head vẫn `0007_alter_paymenttransaction_plan.py` → drift. Việc: `makemigrations commercial` sinh `0008_*` (KHÔNG tự đặt số), dependencies = `0007`, `makemigrations --check` exit 0 sau đó.
4. **Defer / CHƯA CHẠY (ghi trung thực, không phải blocker slice này):** S4.x (C2/C3/E2E/visual), timeframe chart unification (defer — cần widget sign-off), merge mù branch stale (chuyển thành verify-equivalence như P1 dot2), deploy staging D6, verify token 401, full suite VPS.

## 1. Baseline đo được (2026-11-13, branch slice @ `20dafa5ed`)

| # | Lệnh | Exit | Kết quả |
|---|---|---|---|
| B-1 | `check-multi-agent` | 0 | 0 lỗi, 0 trùng migration (165 warning noise cũ) |
| B-2 | `check-ledger-entry` | 0 | 91 header / 90 distinct / max 478, next 479 |
| B-3 | `check-lessons` | 0 | 14 file, 59/60 |
| B-4 | `normalize-eol` | 0 | 0 file đổi |
| B-5 | `git rev-list dev..branch` | — | 1 (chỉ claim commit) |

**CHƯA CHẠY ở lúc lập plan:** BE test VPS, FE suite VPS, `tsc`, `eslint`, `build`, `spectacular`, deploy staging, verify 401.

## 2. Scope (file được chạm)

| File | P |
|---|---|
| `packages/core/backend/src/market_data/vnbroker_adapter.py` (B-4 nguồn) | P1 |
| `packages/core/backend/src/market_data/stock_mgmt_native_views.py` (B-4 schema + endpoint) | P1 |
| `packages/core/backend/src/market_serving/native_views.py` + `market_data/views.py` + `signal_intelligence/views.py` + `advisory/views.py` (B-6 scope, chỉ thêm guard ở entry view) | P2 |
| `packages/core/backend/src/vninvest_core/urls.py` + `identity_access/middleware.py` (B-6 đóng schema, chỉ sửa exempt/guard) | P2 |
| `packages/core/backend/src/commercial/migrations/0008_*.py` (do `makemigrations` sinh) | P3 |
| `packages/core/backend/tests/test_dot3_remaining.py` (new: fail-before → pass-after) | P1/P2/P3 |
| `docs/PLAN_DOT3_REMAINING_20261113.md`, `docs/evidence/dot3-remaining-20261113/*`, `docs/handoffs/HANDOFF_2026-11-13_DOT3-REMAINING.md`, `docs/CLAIMS.md`, ledger Entry 479 | S-C |

**KHÔNG chạm:** deny-list §2 · `adapters/core/market.js` (D2-final đã Number-safe, không sửa) · untracked của session khác (`docs/PLAN_A4*`, `docs/PLAN_WIDGET*`, `docs/WIDGET_EMBEDDING*`, `docs/evidence/a4-roadmap/`, `facts32.json`, `21-fullbleed-test.png`) · timeframe chart (`stock_mgmt_native_views.py:902-920` giữ nguyên — defer).

## 3. AC (Given/When/Then)

- **AC-B4:** Given `GET /core/v1/stock-management/stocks/VNM/financials/?period=quarter`, When backend có dữ liệu, Then response có đúng 5 key (`period,year,quarter,report_date,items`), `typeof` mọi số là `number` (thiếu → `null`, không `""`), `cash_flow` là `null` + `note`; Given `?period=year` khi upstream không hỗ trợ (CHƯA XÁC MINH — xem §0.1), Then 400 với `code` UPPER_SNAKE (không fallback im lặng). OpenAPI có `$ref` schema, không `{}`.
- **AC-B6:** Given PAT `scopes=[]`, When gọi market data / signal / advisory, Then 403 `code=permission_denied`; Given `DEBUG=False`, When `GET /core/v1/schema/`, Then 404/403 (không 200 public); Given 429, Then có `Retry-After` + `X-RateLimit-*`; Given `/api/admin-ops/x`, Then 410 không cần auth. Human session được bỏ qua (dùng `require_pat_scopes_or_human_session` có sẵn).
- **AC-License:** Given head `commercial/0007`, When chạy `makemigrations commercial` trên cây đã ở HEAD `dev`, Then sinh đúng 1 file `0008_*LicenseKey*` với `dependencies=[0007]`, không `CreateModel` cho model đã có khác, `makemigrations --check` exit 0 sau đó, không duplicate leaf.
- **Điều kiện V1 (audit B3):** trước code B-6 grep `market:read|signals:read|ai:invoke` trong 4 app = 0 hit (xác nhận lỗ thật); B-4 đọc `finance.ratio/income_statement/balance_sheet` signature để chốt `period=year` có được hỗ trợ không.

## 4. TDD fail-before → pass-after

1. Viết `test_dot3_remaining.py` trước: B-4 assert typed keys + number types + `period=year` 400; B-6 assert PAT rỗng 403 + schema đóng; license assert migration tồn tại.
2. Chạy trên code chưa sửa (VPS DB tạm) → đỏ đúng lý do nghiệp vụ.
3. Code tối thiểu → xanh. Số test không giảm.

## 5. Rollback / Non-goals / Limit

- Rollback: revert theo PR (B-4/B-6/license mỗi nhóm 1 commit riêng trong branch để revert lẻ được).
- Non-goals: S4.x · timeframe unification · purge history · deploy staging · E2E/visual · sửa FE/widget.
- Limit: 3 vòng sửa/bước; P3 migration sau cùng (sau khi B-4/B-6 xong để leaf ổn định).

## 6. DoD checklist

- [ ] Claim in-progress trước dòng code đầu tiên (có: `20dafa5ed`)
- [ ] Fail-before đỏ → pass-after xanh (VPS hoặc CHƯA CHẠY trung thực)
- [ ] `makemigrations --check` không drift mới · `spectacular` 0 warning mới
- [ ] `check-multi-agent` 0 · `check-ledger-entry` 0 · `scan-secrets` 0 · `check-lessons` 0
- [ ] `git diff --numstat` khớp dự kiến (không EOL drift)
- [ ] Ledger 1 Entry (479) + claim done + handoff + PR merge-commit + cleanup
- [ ] Báo cáo ghi rõ **PASS / FAIL / CHƯA CHẠY** — không suy diễn

## 7. Đối chiếu objection audit B3 (đã sửa ở rev 2)

| # | Mức | Nội dung | Xử lý ở rev 2 |
|---|---|---|---|
| M1 | MAJOR | "Đã có sẵn" thiếu file:line (X-RateLimit/Retry-After/SSE) | §0.2 bổ sung: middleware `:607-610`, throttles `:140-142`, envelope `:47`, urls `:78-79`, views `:905-906,926` |
| m1 | MINOR | Đếm key sai (4 vs 5) | §0.1 + AC-B4 sửa thành 5 key |
| m2 | MINOR | Scope thừa `commercial/models.py` | Bảng §2 P3 chỉ có `migrations/0008_*`; models.py chỉ đọc ở §0.3, không sửa |
| m3 | MINOR | V1 nửa B-4 chưa có bằng chứng (`period=year`) | §0.1 + AC-B4 ghi rõ CHƯA XÁC MINH (package ngoài), giữ nhánh 400 fallback; probe runtime ở B6 |
