# PA-2 — Analytics tenant scope + ledger semantics — GATE EVIDENCE

- **Agent:** `pf2-analyticsledger`
- **Branch:** `feat/pf2-analyticsledger`
- **Worktree:** `C:\Mujoco Projects\pf2-analyticsledger`
- **DB:** `ag_pf2_analyticsledger` (`postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf2_analyticsledger`)
- **Ngày:** 2026-09-26
- **Đóng 2 finding:** `P0-ISO-01` (analytics portfolio không tenant scope) · `P0-DATA-03` (holdings algorithm không phải sổ cái) · `P1-DATA-03` (thiếu cache/provenance — làm 1 phần)
- **Tài liệu đối chiếu:** `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md:231` (P0-ISO-01), `:280` (P0-DATA-03), `:391` (P1-DATA-03), `:1024-1038` (§H3 meta shape) · `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md:107` (D-06)

> ⚠ **Tài liệu bắt buộc đọc thứ 3 KHÔNG TỒN TẠI.**
> `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` (yêu cầu đọc §2, §4 `U-4`, §10, §11) **không có** trong worktree này, cũng không có trong main tree `C:\Mujoco Projects\vninvest`, cũng không nằm trong lịch sử git. Đã kiểm bằng `Test-Path` (cả 2 worktree) và `Get-ChildItem -Recurse -Filter "*VERIFICATION*"` trong `docs/`. Nội dung audit dưới đây lấy từ `AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` — **không** suy diễn nội dung của file không tồn tại. `§2 / §4 U-4 / §10 / §11` của file đó: **CHƯA ĐỌC — không tồn tại**.

---

## 1. File đã đổi

| File | Loại | Nội dung |
|---|---|---|
| `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` | sửa | +50 / −43 dòng, **chỉ trong khối analytics** (`:1-278`) |
| `packages/core/backend/src/user_workspace/ledger/__init__.py` | mới | export public của package |
| `packages/core/backend/src/user_workspace/ledger/holdings.py` | mới | thuật toán sổ cái thuần (không DB/DRF) |
| `packages/core/backend/src/user_workspace/ledger/services.py` | mới | đọc DB + cache + `meta` provenance |
| `packages/core/backend/src/user_workspace/test_analytics_tenant_matrix.py` | mới | 9 test — ma trận tenant (AC1–AC4) |
| `packages/core/backend/src/user_workspace/test_ledger_holdings.py` | mới | 21 test — golden fixture + semantics + cache + HTTP |
| `packages/core/backend/src/user_workspace/test_golden/holdings.json` | mới | 10 golden case |
| `docs/evidence/portfolio-commercial/pa-2-gates.md` | mới | file này |

**Không tạo migration.** `makemigrations --check --dry-run` exit 0.

**Không đụng** code AI Advisory / Screener trong file 2765 dòng. Diff xác minh bằng
`git diff -- <file>`: chỉ `_get_user_portfolio`, `_compute_holdings`, và 5 call site
trong `PortfolioHoldingsView` / `PortfolioSummaryView` / `PortfolioEquityCurveView` /
`PortfolioAllocationView` / `PortfolioTechnicalsView`.

---

## 2. TEST ĐỎ TRƯỚC FIX — cross-tenant 200 là thật

Lệnh (chạy trên `HEAD` chưa có fix, test file đã có):

```powershell
cd C:\Mujoco Projects\pf2-analyticsledger\packages\core\backend
$env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf2_analyticsledger"
$env:DJANGO_DEBUG = "1"
python manage.py test user_workspace.test_analytics_tenant_matrix -v 2
```

Output (bỏ màu ANSI, `Found 8 test(s)`):

```
======================================================================
FAIL: test_ac1_cross_tenant_holdings_returns_404 (user_workspace.test_analytics_tenant_matrix.AnalyticsTenantMatrixApiTestCase.test_ac1_cross_tenant_holdings_returns_404)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "...\test_analytics_tenant_matrix.py", line 200, in test_ac1_cross_tenant_holdings_returns_404
    self.assertEqual(
AssertionError: 200 != 404 : P0-ISO-01 chưa đóng: portfolio thuộc tenant A đọc được khi request chọn tenant B. status=200 body=b'[{"symbol":"VCB","quantity":120,"avg_cost":"50008.33","current_price":"52000.00","market_value":"6240000.00","unrealized_pnl":"239000.00","unrealized_pnl_pct":3.98,"stale":false}]'

======================================================================
FAIL: test_ac2_matrix_all_four_reachable_endpoints (...suffix='holdings/')
AssertionError: 200 != 404 : holdings/ trả 200 thay vì 404
======================================================================
FAIL: test_ac2_matrix_all_four_reachable_endpoints (...suffix='summary/')
AssertionError: 200 != 404 : summary/ trả 200 thay vì 404
======================================================================
FAIL: test_ac2_matrix_all_four_reachable_endpoints (...suffix='analytics/')
AssertionError: 200 != 404 : analytics/ trả 200 thay vì 404
======================================================================
FAIL: test_ac2_matrix_all_four_reachable_endpoints (...suffix='technicals/')
AssertionError: 200 != 404 : technicals/ trả 200 thay vì 404
======================================================================
FAIL: test_ac3_missing_tenant_context_fails_closed (...suffix='holdings/')
AssertionError: 200 != 404 : holdings/ trả 200 khi không có tenant context — phải fail-closed
   (tương tự cho summary/ analytics/ technicals/)
======================================================================
FAIL: test_tenantless_portfolio_returns_404_when_tenant_selected
AssertionError: 200 != 404
----------------------------------------------------------------------
Ran 8 tests in 23.579s

FAILED (failures=10)
```

**Đọc con số này:** `status=200` kèm **body holdings thật của tenant A** (`VCB`, 120 cp,
`avg_cost 50008.33`, `market_value 6240000`) trong khi request mang header chọn **tenant B**.
Không phải lỗi hình thức — dữ liệu tài chính của tenant khác đã ra ngoài.

**4 test đã xanh ngay cả trước fix** (chứng minh ma trận không vacuous):
`test_ac2_own_tenant_still_readable`, `test_ac2_other_tenant_own_portfolio_still_readable`,
`test_ac4_peer_portfolio_same_tenant_returns_404`, `test_anonymous_still_rejected`.

### 2.1 Case `tenantless` bị gỡ khỏi test — và vì sao

`test_tenantless_portfolio_returns_404_when_tenant_selected` **không giữ lại**, vì kịch bản
đó **không dựng được**, không phải vì test sai:

- `user_workspace/models.py:780-844` (`resolve_tenant_for_user_workspace_models`, receiver
  `pre_save`) đảm bảo `Portfolio.tenant` **không bao giờ NULL**: resolve từ profile →
  tenant sở hữu → membership → nếu tất cả fail thì **tạo tenant mới** (`models.py:836-841`,
  `tenant_code=f"auto-{username}"`).
- Cột `tenant_id` là `NOT NULL` — chứng minh bằng `bulk_create` bypass signal:
  `psycopg.errors.NotNullViolation: null value in column "tenant_id" of relation "user_workspace_portfolio"`.
- Thử `force_authenticate` + `force_login` đều ra `tenant_id` khác NULL.

⇒ Không có row tenantless trong hệ thống. Test này được thay bằng
`NoTenantContextMeansNoDataApiTestCase` (2 test) trong
`test_analytics_tenant_matrix.py`, có ghi lại lý do trong docstring.

---

## 3. AC — trạng thái

| # | AC | Test | Kết quả |
|---|---|---|---|
| 1 | Cross-tenant holdings ⇒ 404 | `test_ac1_cross_tenant_holdings_returns_404` | **PASS** (đỏ trước fix) |
| 2 | Ma trận 4 endpoint reachable | `test_ac2_matrix_all_four_reachable_endpoints` + 2 test đối chiếu | **PASS** (đỏ trước fix) |
| 3 | `request.tenant is None` ⇒ fail-closed | `test_ac3_missing_tenant_context_fails_closed`, `test_same_owner_without_tenant_context_is_404`, `test_session_login_without_header_resolves_owner_tenant` | **PASS** (đỏ trước fix) |
| 4 | Portfolio của user khác cùng tenant ⇒ 404 | `test_ac4_peer_portfolio_same_tenant_returns_404` | **PASS** (xanh cả trước fix) |
| 5 | BUY 100@10 fee 1 tax 0.5 ⇒ cost basis 1001.5; SELL 50 ⇒ realized = (giá−avg)×50 − fee − tax | `test_ac5_buy_fee_and_tax_both_capitalised`, `test_ac5_sell_realized_pnl_minus_fee_and_tax`, `test_ac5_cash_flow_matches_ledger` | **PASS** |
| 6 | DIVIDEND ⇒ tăng `cash`, không giảm `avg_cost`, không tăng `quantity` | `test_ac6_dividend_is_cash_flow_only` | **PASS** |
| 7 | Oversell phát hiện được, không clamp im lặng | `test_ac7_oversell_is_reported_not_clamped_silently`, `test_oversell_warning_is_structured` | **PASS** |
| 8 | `quantity` ≤ 0 không hỏng cost basis | `test_ac8_non_positive_quantity_does_not_corrupt_cost_basis` | **PASS** |
| 9 | Golden fixtures cho 7 kịch bản | `test_golden/holdings.json` (10 case) + `test_all_golden_cases` | **PASS** |
| 10 | `meta.as_of` + `meta.calculation_version` + `meta.source`; thiếu dữ liệu = `null` + lý do | `test_meta_has_as_of_source_and_calculation_version`, `test_missing_data_is_null_with_reason_not_zero`, `test_summary_carries_meta_and_ledger_fields`, `test_analytics_endpoint_inherits_summary_meta` | **PASS** (xem giới hạn §6) |

**9/10 AC PASS.** AC-10 PASS **một phần** — xem §6.

---

## 4. Gate — kết quả thật

Tất cả chạy từ `C:\Mujoco Projects\pf2-analyticsledger\packages\core\backend` với
`CORE_DATABASE_URL=…/ag_pf2_analyticsledger` + `DJANGO_DEBUG=1`.

| # | Lệnh | Kết quả |
|---|---|---|
| G1 | `python manage.py check` | **PASS** — `System check identified no issues (0 silenced).` |
| G2 | `python manage.py makemigrations --check --dry-run` | **PASS** — `No changes detected`, exit 0 |
| G3 | `python manage.py test user_workspace.test_analytics_tenant_matrix user_workspace.test_ledger_holdings -v 2` | **PASS** — `Ran 30 tests` / `OK` |
| G4 | `python manage.py test user_workspace.test_portfolio_analytics_native_routes -v 1` | **1 pre-existing error** (xem §5) — `Ran 3 tests` / `FAILED (errors=1)`, **không đổi so với baseline** |
| G5 | `python manage.py test advisory -v 1` | **`Found 0 test(s)`** — xem §7, đã thay bằng lệnh thật |
| G5' | `python manage.py test tests.test_advisory_* (14 module) -v 1` | **PASS** — `Ran 151 tests` / `OK` |
| G6 | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — `0 lỗi, 0 trùng số migration`, exit 0 |
| G7 | `python manage.py test user_workspace -v 1` (extra) | `Ran 142 tests` / `FAILED (errors=4, skipped=2)` — **4 error trùng đúng baseline** (xem §5) |

**Không gate nào bị bỏ.** G5 là lệnh sai *cấu trúc test* (không phải lệnh không chạy được) —
đã chạy thay bằng 14 module thật của AI Advisory và xanh 151/151.

---

## 5. Regression — chứng minh 4 error là pre-existing, không phải do PA-2

Baseline lấy bằng `git stash push -u` (bỏ sạch phần ledger chưa commit) rồi chạy lại
`python manage.py test user_workspace -v 1` trên `HEAD = 2bd3cfa4`:

| | Số test | Lỗi | Danh sách lỗi |
|---|---|---|---|
| **HEAD (baseline)** | 121 | 4 | 3 × `ModuleNotFoundError: No module named 'vnbroker'` (`test_broker_retail.RetailReferenceTests.test_exchange_rate_ok` / `test_gold_ok_and_cached` / `test_upstream_error_mapped`) + 1 × `httpx.UnsupportedProtocol` (`test_portfolio_analytics_native_routes…match_legacy_contracts`) |
| **Sau PA-2** | 142 | 4 | **y hệt, cùng tên test** |

142 − 121 = **+21 test** (đúng bằng số test trong `test_ledger_holdings.py`).
Không có lỗi nào mới, không có lỗi nào biến mất.

- 3 lỗi `vnbroker`: package `C:\Mujoco Projects\vnbroker` không cài trong env
  (`.venv` của repo). **Không** `pip install` — ngoài quy tắc phiên.
- 1 lỗi `httpx.UnsupportedProtocol`: `vninvest_core/legacy_proxy.py:77` gọi HTTP
  tới URL không có scheme khi test gọi route legacy `/api/portfolio/...`.
  Đã ghi ở AGENTS.md Entry 80 là pre-existing.

### 5.1 Hệ quả hành vi CẦN BIẾT (fail-closed có cái giá)

`force_authenticate` của DRF chỉ thao tác trên `Request` dựng **trong view**, nên
`TenantResolutionMiddleware` ở tầng Django không thấy user ⇒ **không gán `request.tenant`**.

Hệ quả: `test_portfolio_analytics_native_routes.py:29` (dùng `force_authenticate`) trước PA-2
nhận **200**, sau PA-2 nhận **404**. Test đó **đã đỏ sẵn** vì `httpx.UnsupportedProtocol` nổi
trước khi assertion chạy, nên **kết quả quan sát được không đổi** (vẫn `errors=1`) — nhưng
nếu `legacy_proxy` được sửa thì test đó sẽ đỏ vì lý do mới.

Đo trực tiếp bằng probe (đã xoá sau khi đọc):

```
CORE_TENANT 'RAISED-NONE'
CORE_PROFILE_RAISED RelatedObjectDoesNotExist User has no core_profile.
PORTFOLIO_TENANT_ID 1 PK 1
STATUS 404 b'{"detail":"Portfolio not found.","code":"not_found",...}'
```

**Cần coordinator:** cập nhật fixture của `test_portfolio_analytics_native_routes.py`
từ `force_authenticate` sang `force_login` + header `X-Tenant-ID`. File này **ngoài phạm vi
PA-2** nên không tự sửa.

---

## 6. AC-10 chỉ PASS MỘT PHẦN — nói thẳng

Audit §H3 yêu cầu mọi response mang `{data, meta{tenant_id, portfolio_id, as_of, source,
stale, calculation_version}}`. PA-2 thêm `meta` vào **`/summary/`** (và `/analytics/`,
vì nó lồng `summary`).

**Không** thêm `meta` vào `/holdings/` và `/technicals/` vì chúng trả **list thuần**
(`Response([...])`). Bọc list vào `{data, meta}` là breaking change với
`packages/web/src/adapters/core/workspace.js:150-184` (FE đọc thẳng mảng) — mà
`packages/web/**` nằm trong deny list của PA-2. Đây là **khoản nợ còn lại**, không phải
xong.

Ngoài ra `nav` **không** tính được và trả `null` + `nav_reason` (không trả 0 giả):
`model Portfolio` không có trường số dư mở đầu, cần thêm cột ⇒ cần migration ⇒
`*/migrations/*` do `tenantreg-c` claim. `cash` vì vậy được gắn
`cash_complete: false` + `cash_note` nói rõ nó **không phải số dư tài khoản**.

---

## 7. P1-DATA-03 — làm được gì, chưa làm gì

**Đã làm:**
- Cache theo `tenant + portfolio + (transaction_count, max updated_at, max pk)`, TTL 60 s.
- `meta` provenance đầy đủ + `calculation_version = 'holdings-wa-v1'`.
- `stale` + `stale_reason` (mốc 7 ngày, `STALE_AFTER_DAYS`).
- `invalidate_ledger_cache(portfolio_id)` bump counter theo portfolio.

**Cố ý lệch khỏi đề xuất của audit:** audit/P1-DATA-03 gợi ý cache theo
`tenant+portfolio+as_of`. **`as_of` một mình không đủ** — sửa một giao dịch **cũ** không đổi
`as_of` (ngày giao dịch mới nhất) nhưng vẫn đổi kết quả ⇒ cache sẽ trả số sai.
Có test khoá đúng điều này: `test_editing_old_transaction_invalidates_cache`.

**CHƯA làm (có lý do, không giấu):**
- **Không có async snapshot / materialized view.** Cần job + bảng ⇒ migration ⇒ ngoài phạm vi.
- **Không có pagination.** Module ghi "small portfolios only"; thêm phân trang sẽ đổi shape
  list mà FE đang đọc (xem §6).
- **Chưa có `SymbolSnapshot` fallback honest** trong `holdings`/`technicals`:
  `portfolio_analytics_views.py:105,125,196` vẫn dùng `avg_cost` làm giá thay khi không có
  snapshot ⇒ giá hiển thị là **giá giả**. Sửa cần đổi shape response (`current_price: null`
  + lý do) ⇒ cùng lý do FE như §6. **Ghi nợ, không tự mở rộng phạm vi.**
- **`PortfolioEquityCurveView` vẫn dùng `avg_cost` làm giá fallback** (`:180`) — cùng lý do.

---

## 8. Blast radius thật của P0-ISO-01

| View | `urls.py` | Reachable? |
|---|---|---|
| `PortfolioHoldingsView` | `urls.py:54` | **CÓ** |
| `PortfolioSummaryView` | `urls.py:55` | **CÓ** |
| `PortfolioAnalyticsView` | `urls.py:56` | **CÓ** |
| `PortfolioTechnicalsView` | `urls.py:57` | **CÓ** |
| `PortfolioChartView` | chỉ import `urls.py:9` | **KHÔNG — code chết** |
| `PortfolioEquityCurveView` | chỉ import `urls.py:10` | **KHÔNG — code chết** |
| `PortfolioAllocationView` | chỉ import `urls.py:11` | **KHÔNG — code chết** |
| `PortfolioSyncView` | chỉ import `urls.py:12` | **KHÔNG — code chết** |

4 view chết **đã** qua `_get_user_portfolio` nên cũng được sửa scope, nhưng sửa chúng
**không** đóng được lỗ hổng. **Không xoá** — xoá là việc khác.

Cách sửa khác audit đề xuất: audit nói tạo dependency `resolve_active_tenant(request)`.
**Không làm** — `request.tenant` đã có sẵn do `TenantResolutionMiddleware`
(`identity_access/middleware.py:112`) gán. Tạo resolver thứ 5 sẽ phá việc hợp nhất của
`tenantreg-b`. Convention cũng đã là `getattr(request, 'tenant', None)` như
`user_workspace/views.py:99`.

---

## 9. Ngoài phạm vi — phát hiện nhưng KHÔNG tự sửa

| # | Phát hiện | Vì sao không sửa |
|---|---|---|
| O1 | `user_workspace/models.py:836-841` — khi không resolve được tenant, signal **tự tạo tenant mới** (`auto-{username}`) cho bất kỳ model nào thiếu tenant. Đây là cách *ngầm* gán tenant cho dữ liệu tài chính. | `models.py` ngoài phạm vi. Cùng họ P0-ISO-02. |
| O2 | `user_workspace/views.py:99-103,205-209,340-344` — cùng kiểu `if tenant: … else: <lọc user-only>` ⇒ **fail-open** khi không có tenant context. Đây chính là anti-pattern PA-2 vừa đóng ở analytics, còn nguyên ở portfolio/watchlist/subaccount/screener list. | `views.py` ngoài phạm vi. **Khuyến nghị ticket riêng.** |
| O3 | `test_portfolio_analytics_native_routes.py:29` dùng `force_authenticate` ⇒ fixture không còn mô tả request hợp lệ sau PA-2 (§5.1). | Ngoài phạm vi. Cần coordinator sửa. |
| O4 | `Portfolio.tenant`/`Transaction.tenant` khai `null=False` nhưng migration `0012` để cột nullable ở DB ⇒ model và schema lệch nhau. | `*/migrations/*` do `tenantreg-c` claim. |
| O5 | `PortfolioHoldingsView` / `PortfolioTechnicalsView` / `PortfolioEquityCurveView` / `PortfolioAllocationView` dùng `avg_cost` làm giá khi thiến `SymbolSnapshot` ⇒ giá giả. | Cần đổi shape response, FE ngoài phạm vi (§7). |
| O6 | `PortfolioSummaryView` trả `total_unrealized_pnl_pct = 0` khi `total_cost == 0` — số 0 giả, vi phạm AC-10. | Sửa sẽ đổi hành vi mà FE có thể dựa vào; cần ticket riêng cùng O5. |
| O7 | `p0-iso-01` còn ở `user_workspace/views.py` (portfolio detail / transactions / watchlist / subaccount) dùng `_get_portfolio_or_404(user, id, tenant)` với `if tenant: … else:` fallback. | `views.py` ngoài phạm vi. |

---

## 10. Rủi ro còn lại

1. **Fail-closed 404 khiến mọi call path không resolve được tenant mất dữ liệu**
   (hiện chỉ quan sát được ở test `force_authenticate`; ở production, path PAT mà
   `TenantResolutionMiddleware` không resolve được tenant sẽ bị từ chối). Đây là
   hành vi **đúng** theo AC-3 nhưng là hành vi **mới** — cần theo dõi sau deploy.
2. **`cash` không phải số dư tài khoản** và `nav` chưa có. Ai đọc `cash` mà không đọc
   `cash_note` sẽ hiểu sai.
3. **Oversell mới chỉ được *báo*, chưa chặn.** `reconciliation_required` là cờ; chưa có
   job/job ledger nào hề tới nó. Số liệu vẫn phải đối soát tay với broker.
4. **Chưa có corporate action** (split / bonus). D-07 nói R1 gồm split + bonus — **PA-2
   chưa làm**. Một split sẽ làm sai `avg_cost` và `quantity` cho tới khi có xử lý.
5. **Cache TTL 60 s ⇒ số liệu có thể trễ ≤ 60 s sau khi ghi transaction.** Đúng để hiển thị,
   **không** dùng được cho quyết định tài chính. `meta.from_cache` cho biết.
6. `test_portfolio_analytics_native_routes` **vẫn đỏ** (pre-existing). Không sửa vì ngoài
   phạm vi — nhưng đừng đọc "PASS" của gate G4 là regression xanh.
