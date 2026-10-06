# AUDIT PORTFOLIO — HIỆN TRẠNG VÀ HƯỚNG PHÁT TRIỂN

| | |
|---|---|
| **Ngày audit** | 2026-10-05 |
| **Cơ sở (sha)** | `d85e260d5` (`feat/portfolio-p0-20261005` branch off `dev`) |
| **Kế hoạch gốc** | `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` — 9 wave · 61 slice · 192–251 engineer-days |
| **Claim** | `docs/CLAIMS.md` — `opencode-portfolio-p0` |
| **Phạm vi** | App `user_workspace` (backend) + `PortfoliosPage`/`TransactionsPage`/adapter (web) + `portfolioApi` (mobile) |
| **Loại audit** | READ-ONLY, đọc mã nguồn + chạy test có kiểm soát |
| **Kết luận** | **24/61 slice xong · 10 có code chưa nối · 27 chưa làm · 6 P0 mới** |

> **Tiền đề cần sửa.** Portfolios **không nằm trong `vnsaas`** — app `user_workspace` đã bị cắt có chủ đích (`vnsaas/docs/saas_design_pack/D05_FUNCTIONAL_DECOMPOSITION_20261002.md:242`). Nó thuộc **`vninvest`** và là một trong 4 app phải port sang `vnsaas` khi mở rộng scope.

---

## 1. Bản đồ code thật

Mọi số dòng đo bằng `(Get-Content <file> -Encoding utf8).Count` tại `d85e260d5`.

### 1.1 Backend — `packages/core/backend/src/user_workspace/`

| File | LOC | Vai trò |
|---|---|---|
| `portfolio_analytics_views.py` | **3.346** | 19 view analytics/screener/AI-advisory |
| `models.py` | 1.549 | 18 model |
| `views_dnse.py` | 947 | Broker DNSE + order |
| `views.py` | 859 | Portfolio/Transaction/SubAccount/Watchlist CRUD |
| `tasks.py` | 440 | 5 Celery task |
| `screener_helpers.py` | 552 | |
| `permissions.py` | 342 | `WorkspacePermission` deny-by-default |
| `views_broker.py` | 258 | Broker config |
| `endpoint_safety.py` | 200 | Chống SSRF |
| `serializers.py` | 85 | 4 serializer |
| `urls.py` | 125 | 125 dòng route |
| `ledger/` (6 file) | 1.985 | `analytics.py` 546 · `services.py` 477 · `holdings.py` 364 · `validators.py` 227 · `valuation.py` 122 |
| `broker/` (7 file) | 1.160 | `adapters.py` 637 · `egress.py` 214 |
| `services/idempotency.py` | 242 | `Idempotency-Key` |

**Migration:** chuỗi đơn tuyến tính 23 file, head = **`0023_append_only_guards`**.
Đã kiểm chứng chạy thật trên Postgres 16 (`pf_p0_verify`), `0023` apply OK.

### 1.2 Frontend

| File | LOC | Còn dùng? |
|---|---|---|
| `packages/web/src/pages/PortfoliosPage.tsx` | **142** | ✅ `main.tsx:141` |
| `packages/web/src/adapters/core/workspace.js` | 703 | ✅ 60+ hàm API |
| `packages/web/src/context/PortfolioContext.js` | 722 | ✅ tenant SSOT |
| `packages/web/src/components/dashboard/PortfolioHeatmap.js` | 627 | ✅ `DashboardPage.tsx:365` |
| `packages/web/src/components/DNSEConnectionPanel.js` | 540 | ✅ nhúng `PortfoliosPage.tsx:104` |
| `packages/web/src/pages/workspace/ShellPortfoliosPage.tsx` | 175 | ❌ **dead code** |
| `packages/mobile/src/services/portfolioApi.ts` | 116 | ❌ luôn trả rỗng (P0-4) |

### 1.3 Test

33 file · ≈8.400 LOC. Migration rehearsal `test_migration_0008_rehearsal.py` 499 LOC.

---

## 2. Trạng thái 61 slice — đối chiếu mã nguồn

Đếm bằng cách đọc code và grep call site, **không** tin `CLAIMS.md` (claim sai lệch ở mục 5).

| Wave | Slice | Xong | Có code **chưa nối** | Chưa làm | Bằng chứng quyết định |
|---|---|---|---|---|---|
| −1 Security | 3 | 2 | 1 | 0 | `SecretStore` có ở `vninvest_core/utils/encryption.py`; `git ls-files \| findstr .env` chỉ còn 6 file `*.example` |
| 0 Safety | 7 | 5 | 0 | **2** | SAFE-04 hở (mục 3.1); SAFE-07 chỉ 1/6 gate trong `.github/workflows/secret-scan.yml` |
| 1 Tenant | 6 | 5 | 0 | **1** | TEN-03 hở: `views_broker.py:111,153,164,178,202` không truyền `tenant=` |
| 2 Ledger+Analytics | 12 | 7 | **5** | 0 | `ledger/analytics.py` + `validators.py` không có caller ngoài test (mục 3.4) |
| 3 API+FE | 10 | 2 | 1 | **7** | 4 view không route (mục 3.3) |
| 4 Broker | 6 | 3 | **3** | 0 | `views_dnse.py` không có `.delay()` ⇒ sync chạy đồng bộ |
| 5 Paper | 5 | 0 | 0 | **5** | grep `VirtualBrokerEngine\|TradingDockPanel\|paperTrading\|pnlDisplayMode` trong `packages/web/src` = **0 hit** |
| 6 Live | 5 | 0 | 0 | **5** | Blocker ngoài code: license `vnbroker` (mục 6) |
| 7 Hardening | 7 | 0 | 0 | **7** | Không có `docs/evidence/` cho wave này |
| **Tổng** | **61** | **24** | **10** | **27** | |

### 2.1 Wave 5/6/7 = 17 slice chưa bắt đầu

`packages/web/package.json` vẫn khai `"vninvestcharts-widget": "^1.2.5"`. Kế hoạch `PAP-05` yêu cầu nâng `1.4.0`. Không có symbol paper trading nào trong `packages/web/src`.

---

## 3. Sáu P0 mới — không có trong bất kỳ audit nào trước

### P0-1 — Endpoint ghi tài chính không kiểm capability ⇒ `viewer` ghi/xoá được dữ liệu

| Phía | Bằng chứng |
|---|---|
| Capability đã định nghĩa | `permissions.py:41` → `portfolio_write` maps `'sa:write'` |
| Role `viewer` **không** có `sa:write` | `identity_access/utils/resolve_tenant.py` → `SYSTEM_ROLE_PERMISSIONS` |
| Write method tài chính **không** khai báo | **10 write method / 6 class** trong `views.py`: `PortfolioListCreateView.post` L113 · `PortfolioDetailView.{patch,delete}` L147 · `TransactionListCreateView.post` L253 · `TransactionDetailView.{patch,delete}` L289 · `SubAccountListCreateAPIView.post` L559 · `SubAccountDetailAPIView.{patch,delete}` L603 · `SubAccountTransactionsAPIView.post` L685 — tất cả chỉ `[permissions.IsAuthenticated, TenantScopePermission]` |
| `TenantScopePermission` không kiểm role | `permissions.py:207-271` — chỉ kiểm authenticated + tenant resolvable |
| Gate **không** bắt được | `tests/test_capability_matrix.py:279-284` chỉ xét `ast.FunctionDef` có decorator `@api_view`. `views.py` dùng **class-based view** ⇒ thêm file vào tuple ở `:276` cho ra **0 hàm khớp**, test xanh trong khi 10 endpoint vẫn hở |

**Tác động:** thành viên role `viewer` tạo / sửa / xoá `Portfolio` và `Transaction` trong tenant đó. Đây là lớp leo thang đặc quyền mà `permissions.py:34-40` mô tả đã sửa cho broker — nhưng endpoint nhạy cảm nhất thì chưa.

### P0-2 — Ghi `Transaction` không cập nhật `LedgerEntry`/`CashFlow` ⇒ NAV sai âm thầm

| Bước | Bằng chứng |
|---|---|
| API chỉ ghi bảng `Transaction` | `views.py:285` `serializer.save(portfolio=portfolio, tenant=portfolio.tenant)` |
| Không có signal nối | `signals.py:28-132` — không receiver `Transaction → LedgerEntry` |
| Không có writer nào | grep `LedgerEntry.objects.create` / `CashFlow.objects.create` ngoài test: chỉ `migrations/0022_backfill_transaction_to_ledger.py:156,161` (`0022:250-251` là `operations=[RunPython(...)]`, không phải chỗ backfill) |
| Hệ quả | `ledger/services.py:348-352` `cash_flow_total` đọc từ `CashFlow` ⇒ đứng yên trong khi `Transaction` tăng |
| Guard không bắt | `ledger/services.py:374` `not has_flow_rows` **không** kích hoạt vì `0022` đã tạo dòng rồi |
| Báo động giả | `ledger/services.py:399-417` `cash_cross_check` bật `reconciliation_required` cho **mọi** danh mục có giao dịch mới |

**Tác động:** sai số tài chính, không phải lỗi cosmetic.

### P0-3 — `opening_balance` không có đường ghi ⇒ `nav` là `null` vĩnh viễn

| Bước | Bằng chứng |
|---|---|
| Field có sẵn | `models.py:52-56` `opening_balance`; migration `0021_portfolio_opening_balance_and_more.py:35` |
| Serializer không nhận | `serializers.py:44` `fields = ['id','name','description','is_default','created_at']` |
| PATCH partial cũng vô dụng | `views.py:183-185` `partial=True` nhưng serializer không có field |
| Kết quả | `ledger/valuation.py:94-106` ⇒ `nav=None`, `nav_reason='no_opening_balance'` |

### P0-4 — Mobile portfolio luôn rỗng (không unwrap envelope)

| Phía | Bằng chứng |
|---|---|
| BE bọc envelope | `user_workspace/envelope.py:87-101` `paginated_envelope` ⇒ body `{data:{count,results}, meta}` |
| Mobile đọc | `packages/mobile/src/services/portfolioApi.ts:5-6,78` `response.data?.results ?? []` |
| Transport không unwrap | `packages/mobile/src/services/http.ts:34-36` trả nguyên `response` |
| Hệ quả | `.results` = `undefined` ⇒ `getPortfolios()` **luôn `[]`** |

Ngoài ra `portfolioApi.ts:86-93` `getSummary` trả `total_unrealized_pl: 0` hardcode trong khi BE có `realized_pnl` / `dividend_income` / `nav` thật (`portfolio_analytics_views.py:283-305`).

### P0-5 — `TransactionsPage` POST luôn trả 400

| Phía | Bằng chứng |
|---|---|
| FE gửi | `TransactionsPage.tsx:75-76` khai `side: "buy"`, `trade_date`; `:90-93` spread `...form` vào `createTransaction` |
| BE serializer | `serializers.py:31-34` `fields = [... 'transaction_type', ... 'date', ...]` |
| BE model | `models.py:112-117` `transaction_type` (choices `BUY/SELL/DIVIDEND`), `date` — **không có** `side`, **không có** `trade_date` |
| Adapter JSDoc đúng | `adapters/core/workspace.js:158` ghi `transaction_type`, `date` ⇒ **page** sai, không phải adapter |

**Tác động:** không tạo được giao dịch nào từ UI ⇒ nguồn dữ liệu `holdings`/`NAV`/`P&L` rỗng.

### P0-6 — Gate FE↔BE chỉ kiểm PATH, không kiểm FIELD

`packages/web/src/adapters/core/__tests__/route-contract.test.js:105-119` `toResolvablePath()` chỉ so khớp regex route. Đường đúng ⇒ test xanh.

Đây là **hệ thống miễn nhiễm** cho P0-4 và P0-5: cả hai đều là sai tên field trên đường đúng. Đóng P0-6 là điều kiện để 5 lỗi còn lại không tái phát.

---

## 4. Điểm đã làm tốt — xác minh bằng mã nguồn

| Hạng mục | Bằng chứng |
|---|---|
| Tenant isolation fail-closed | `portfolio_analytics_views.py:87-109` — lọc `pk+user+tenant`; `tenant is None` ⇒ **404** (không fallback về lọc user) |
| Test ma trận cross-tenant | `test_analytics_tenant_matrix.py:137-311` — 9 case gồm anonymous, peer-portfolio cùng tenant, thiếu tenant context |
| Ledger semantics đúng D-06 | `ledger/holdings.py:266-278` DIVIDEND là cash flow, **không** giảm cost basis · `:252-256` realized P&L trừ cả `fee` lẫn `tax` · `:235-245` oversell trả `excess_quantity` + warning, **không** clamp im lặng |
| NAV fail-closed | `ledger/services.py:321-336` `no_market_prices` / `partial_market_prices`; `:399-417` `cash_cross_check` |
| Append-only 3 tầng | `models.py:964-1008` Python · `:1011-1037` `TenantScopedByParentMixin` · `migrations/0023_append_only_guards.py:41-115` **trigger Postgres** |
| Cache tenant-scoped | `ledger/services.py:186-193` raise `ValueError` khi thiếu tenant thay vì dùng chung namespace |
| Volume/quantity đã sửa | `views_dnse.py:68-69` alias · `:90-135` phát hiện `order_volume_conflict` |
| FE tenant SSOT đúng | `PortfolioContext.js:82,99,123,159,318,323,663` dùng `tenantIdStorage`; `transport.js:394-397` đọc cùng nguồn |

---

## 5. Tài liệu lệch thực tế

| Tài liệu nói | Thực tế tại `d85e260d5` | Cách kiểm chứng |
|---|---|---|
| `AGENTS.md:71` "mọi lệnh DNSE từ UI trả 400 vì volume/quantity" | **Đã sửa** | `views_dnse.py:68-69,90-135` + test `dnse-order-contract.test.js:26` PASS (19/19) |
| `AGENTS.md:75` "còn nợ `ops_audit.action` `max_length=16`" | **Đã sửa** | `views_dnse.py:236-237` dùng `ActionChoices.CREATE`; `:783` `_finalize_audit_event(..., 'accepted')` ghi vào `metadata` |
| `OPEN_WORK_20260929.md` OW-01: secret còn trong git | **Đã xử lý** | `git ls-files` chỉ còn 6 file `*.example` |
| OW-02: `SecretStore` chưa có | **Đã có** | `vninvest_core/utils/encryption.py` — `SecretStore`, `SecretKeyMissingError`, `.reencrypt()`, `.current_version()` |
| OW-03: GitHub Actions đã tắt | **Đã bật 1 workflow** | `.github/workflows/secret-scan.yml:25,28,50,54` |
| Claim `portfolio-exec-plan` (L251) trỏ 2 slice doc | **2/3 file đã bị archive** | `docs/archive/docs-flat/portfolio_exec_slices/` |
| Evidence `pa-2/3/5-gates.md` | **Thiếu** | `docs/evidence/portfolio-commercial/` chỉ có `pa-1`, `pa-4` |

⇒ `check-multi-agent.mjs` báo **63 cảnh báo** "file không tồn tại". Phần lớn do archive/claim stale, **không** phải mất file.

---

## 6. Bốn claim `in-progress` đều stale

| Claim | Dòng | Ngày | Bằng chứng không tiến triển |
|---|---|---|---|
| `portfolio-exec-plan` | 251 | 2026-09-27 | Branch `docs/portfolio-exec-plan-20260927` không tồn tại; 3/7 file trong claim đã archive |
| `sec03-secret-scan` | 259 | 2026-09-28 | Tự ghi push `--no-verify`; PR #46 mở, chưa merge |
| `portfolio-w3-api` | 277 | 2026-09-29 | `docs/evidence/wave3-api/` **không tồn tại** |
| `owner-audit-fix` | 942 | — | Thiếu cột ngày; `portfolio_analytics_views.py` đã bị commit bởi `1e1b6e0c4` |

`git status` tại `d85e260d5` sạch (trừ `docs/_workflow/` untracked) ⇒ **không agent nào đang chạy**. Bốn claim này đang **chặn file** mà không ai giữ.

**Hệ quả với kế hoạch:** `portfolio_analytics_views.py`, `views_dnse.py`, `ledger/services.py`, `adapters/core/workspace.js` bị giữ ⇒ P0-2 phải sửa `signals.py` và thêm reader độc lập trong `ledger/`, **không** sửa `ledger/services.py`.

---

## 7. Mâu thuẫn cần Owner chốt

`AGENTS.md:73` — **P0-LEGAL-01**: license `vnbroker` chưa ký ⇒ R3 live trading không tồn tại.
`docs/CLAIMS.md:251` (claim `portfolio-exec-plan`) — Owner chốt 2026-09-27: `vnbroker` là **sở hữu của chủ repo** ⇒ đổi từ "license chưa ký = blocker" thành "**không còn blocker pháp lý**", R3 live trading được phép.

Hai nguồn nói ngược nhau. Wave 6 (LIV-01..05, 21–28 ed) **không thể mở** tới khi Owner chốt.

---

## 8. Baseline đo được trước khi lập kế hoạch

| Gate | Lệnh | Baseline `d85e260d5` |
|---|---|---|
| BE capability + ledger model | `pytest test_capability_matrix.py test_ledger_models_wave2.py` | **47 passed** |
| FE adapter contract | `jest src/adapters/core/__tests__/route-contract.test.js src/adapters/core/__tests__/dnse-order-contract.test.js` | **19 passed** |
| Multi-agent gate | `node packages/web/scripts/check-multi-agent.mjs` | **PASS**, 0 lỗi, 63 cảnh báo |
| Migration head | `manage.py migrate` | **OK** tới `0023_append_only_guards` |

Hạ tầng đo baseline: Postgres `127.0.0.1:5433` (`docker exec vninvest-dev-core-db`), Redis `127.0.0.1:6380` (không phải 6379 — `settings.py:446` mặc định 6379 nên test fail nếu không set). DB test riêng `pf_p0_verify`.

---

## 9. Baseline test chưa chạy — ghi rõ

| Hạng mục | Trạng thái |
|---|---|
| 33 file test `user_workspace` (≈8.400 LOC) | **CHƯA CHẠY** — chỉ chạy 47 test ở mục 8 |
| Toàn bộ test frontend (jest + vitest) | **CHƯA CHẠY** |
| Migration trên DB **có dữ liệu** | **CHƯA CHẠY** — `pf_p0_verify` là DB rỗng. `migrations/0019:30-33` đã cảnh báo state `0007` nổ `FieldError` tại `0008` |
| `pwsh -File scripts/agent-sync.ps1` | **CHƯA CHẠY** |
| `node scripts/pre-push-gate.mjs` | **CHƯA CHẠY** |

**Không có kết luận `PASS` nào trong tài liệu này dựa trên thứ chưa chạy.**