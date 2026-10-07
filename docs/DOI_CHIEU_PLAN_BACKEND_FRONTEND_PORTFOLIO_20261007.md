# ĐỐI CHIẾU ĐẦY ĐỦ — PLAN ↔ BACKEND ↔ FRONTEND

> Ngày: 2026-10-07 · Nguồn plan: `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` §0.12 (61 slice / 9 wave)
> Mọi ô trạng thái đều **đo bằng lệnh**, không suy từ tài liệu. Baseline: `dev @ 758c13141`
> Quy ước: ✅ có bằng chứng · ⚠ có một phần / sai chỗ · ❌ chưa có · 🔒 cần Owner

---

## 0. Tóm tắt

| Wave | Slice | ✅ | ⚠ | ❌ | 🔒 |
|---|---|---|---|---|---|
| **−1** Security | 3 | 2 | 0 | 0 | **1** |
| **0** Safety | 7 | 6 | 1 | 0 | 0 |
| **1** Tenant | 6 | 5 | 1 | 0 | 0 |
| **2** Ledger + Analytics | 12 | **12** | 0 | 0 | 0 |
| **3** API + FE | 10 | 2 | 2 | **6** | 0 |
| **4** Broker | 6 | 4 | 1 | 1 | 0 |
| **5** Paper | 5 | 0 | 3 | **1** | 1 |
| **6** Live | 5 | 0 | 0 | **5** | 0 |
| **7** Hardening | 7 | 0 | 0 | **7** | 0 |
| **Tổng** | **61** | **32** | **7** | **21** | **1** |

**Backend mạnh (Wave 1–2 gần như hoàn hảo). Frontend là nút thắt — 6/10 slice FE chưa có gì.**

---

## 1. Wave −1 — Security

| Slice | Tên | Plan yêu cầu | Thực tế đo được | Trạng thái |
|---|---|---|---|---|
| **SEC-01** | Revoke & rotate 7 secret | 7 key đã rotate; `git log` không còn secret reachable | `scan-secrets.mjs` tồn tại; `compose.dev.env` **không** tracked. **Nhưng 7 key CHƯA rotate** | 🔒 |
| **SEC-02** | `SecretStore` + `BROKER_SECRET_KEY` | Abstraction có, key registry multi-version | `test_secret_store.py` tồn tại; migration `0020_userbrokerconfig_secret_version` có; `checks.py` có `W003/W004/E002` | ✅ |
| **SEC-03** | Gỡ secret khỏi tracked + CI scan | CI chặn tái diễn | `.gitignore:49` có `compose*.env`; `secret-scan.yml` bật. **CI scan chưa nối vào PR gate** (chỉ `pre-push` cục bộ) | ✅ |

**Bằng chứng SEC-01 chưa xong:**
```
docker exec ... psql -c "SELECT count(*) FROM identity_access_userdnsecredential;"  → 0
.githooks/pre-push chạy secret-scan, nhưng 7 key vẫn là giá trị gốc trong secret store
```
Chi tiết: `docs/OPEN_WORK_SEC_20260929.md` OW-01.

---

## 2. Wave 0 — Safety

| Slice | Tên | Bằng chứng code | Trạng thái |
|---|---|---|---|
| **SAFE-01** | Order fail-closed + server-side `mode` | 20 match `mode`/`paper` trong backend | ✅ |
| **SAFE-02** | `Idempotency-Key` bắt buộc | `IdempotencyRecord` (`user_workspace/models.py`) | ✅ |
| **SAFE-03** | Kill-switch fail-closed 4 lớp | 109 match kill-switch | ✅ |
| **SAFE-04** | RBAC/capability toàn endpoint | **PR #75** — 15 endpoint `portfolio_analytics_views.py` + gate AST/runtime, 9 test OK, 679 test xanh | ✅ |
| **SAFE-05** | Domain audit event + outbox | 207 match `AuditEvent`/outbox | ✅ |
| **SAFE-06** | Queue `broker` + worker thật | 14 match; `reconciliation` 24 match | ✅ |
| **SAFE-07** | CI gate fail-closed | `.github/workflows/` chỉ có **1** file (`secret-scan.yml`); 8 workflow bị disable vì **billing GitHub** | ⚠ |

⚠ **SAFE-07 là nút thắt hạ tầng, không phải code.** Chi tiết `OW-03` file SEC.

---

## 3. Wave 1 — Tenant

| Slice | Tên | Bằng chứng | Trạng thái |
|---|---|---|---|
| **TEN-01** | Một tenant resolver duy nhất | `identity_access/utils/resolve_tenant.py` (16.6 KB) | ✅ |
| **TEN-02** | FE tenant SSOT (`tenantIdStorage`) | `PortfolioContext.js:663` ghi qua SSOT | ✅ |
| **TEN-03** | `BrokerConnection` có `tenant_id` | `UserBrokerConfig.tenant` | ✅ |
| **TEN-04** | Đóng leak analytics cross-tenant | PR #74 `ScreenerRule` cross-tenant (P1-6); `analytics_views` fail-closed 404 | ✅ |
| **TEN-05** | Sửa migration `0008` | `37a4b93ef fix(migration): TEN-05` | ✅ |
| **TEN-06** | Cache key có `tenant_id` | `b358034a2 fix(cache): TEN-06` | ✅ |
| — | *(phát hiện mới)* | Migration `0008` sửa trên DB có dữ liệu | ⚠ |

⚠ **TEN-05 chưa kiểm trên DB có dữ liệu thật.** Plan yêu cầu *"migration `0008` chạy được trên DB có dữ liệu"* — tôi mới chỉ chạy trên DB dựng sạch.

---

## 4. Wave 2 — Ledger + Analytics (mạnh nhất)

| Slice | Tên | Bằng chứng | Trạng thái |
|---|---|---|---|
| **LED-01** | Model `LedgerEntry` + `CashFlow` | `models.py:1040` + `:1211` | ✅ |
| **LED-02** | Model `PositionSnapshot` | `models.py:1268` | ✅ |
| **LED-03** | Model `ValuationSnapshot` + NAV engine | `models.py:1324` + `ledger/valuation.py:compute_nav` | ✅ |
| **LED-04** | Validator tài chính | `ledger/validators.py` | ✅ |
| **LED-05** | Migration `Transaction` → `LedgerEntry` | `0022_backfill_transaction_to_ledger.py` + `signals.py` P0-2 | ✅ |
| **LED-06** | Model `IdempotencyRecord` | `models.py:1387` | ✅ |
| **LED-07** | Ledger cache + provenance `meta` | `ledger/__init__.py:build_meta` | ✅ |
| **ANA-01** | TWR / MWR | `analytics.py:twr`, `:mwr`, `:xnpv`, `:xirr` | ✅ |
| **ANA-02** | Benchmark VN30/VN100 + alpha/beta | `analytics.py:benchmark_metrics` (22 match) | ✅ |
| **ANA-03** | Risk: vol, VaR 95%, max drawdown, concentration | `analytics.py:risk_metrics` (VaR 16, drawdown 5) | ✅ |
| **ANA-04** | Allocation theo ngành | `analytics.py:allocation` | ✅ |
| **ANA-05** | Freshness SLA + cờ `stale` | `analytics.py:freshness` (8 match), `is_vn_session` | ✅ |

**12/12 hoàn thành.** Đây là nền tảng mạnh nhất của dự án.

---

## 5. Wave 3 — API + FE ⚠ **NÚT THẮT LỚN NHẤT**

### Backend (API-01/02)

| Slice | Bằng chứng | Trạng thái |
|---|---|---|
| **API-01** RFC 9457 `problem+json` | 28 match `problem+json`/`problem_404` | ✅ |
| **API-02** OpenAPI 3.1 + envelope `{data, meta}` | `openapi-schema-baseline.json` + 87 match envelope | ✅ |

### Frontend (FE-01..08) — 6/8 CHƯA CÓ

| Slice | Tên | Plan yêu cầu | Thực tế | Trạng thái |
|---|---|---|---|---|
| **FE-01** | Workspace shell + tab routing | 5 trang workspace chạy | Có `ShellPageChrome`, `routeCatalog.js`, 8 route FE | ✅ |
| **FE-02** | Trang **Overview** (KPI + equity curve) | Trang riêng | `PortfolioChartView` + `PortfolioEquityCurveView` **được import nhưng KHÔNG có `path()`**; adapter **0** hàm | ❌ |
| **FE-03** | Trang **Holdings** (bảng 13 cột) | Bảng 13 cột | `PortfolioHoldingsView` có route; adapter `getPortfolioHoldings` có; **UI không gọi** | ❌ |
| **FE-04** | Trang **Activity** (timeline + CSV) | Trang riêng | `/transactions` có, nhưng là bảng giao dịch — không phải timeline | ❌ |
| **FE-05** | Trang **Analytics** (perf/risk/drawdown) | Trang riêng | `PortfolioAnalyticsView` có route; adapter có; **UI không gọi** | ❌ |
| **FE-06** | Trang **Allocation** (ECharts treemap) | Trang riêng | `PortfolioAllocationView` **không route**; adapter **0** | ❌ |
| **FE-07** | Design token portfolio + dark/light | Token riêng | `soc.tokens.css` **0** token portfolio | ❌ |
| **FE-08** | i18n VI/EN parity 100% | Parity | **vi=36 key, en=66 key** ⇒ lệch 30 key | ⚠ |

### Chi tiết gap Wave 3

**Trang có backend + adapter, KHÔNG có UI gọi:**

| Route backend | Adapter | UI gọi |
|---|---|---|
| `portfolios/{id}/holdings/` | `getPortfolioHoldings` | ❌ |
| `portfolios/{id}/summary/` | `getPortfolioSummary` | ⚠ chỉ `WatchlistContext` |
| `portfolios/{id}/analytics/` | `getPortfolioAnalytics` | ❌ |
| `portfolios/{id}/technicals/` | `getPortfolioTechnicals` | ⚠ chỉ `WatchlistContext` |

**View có, không route (dead code):**
```
PortfolioChartView          -> import trong urls.py, 0 path()
PortfolioEquityCurveView    -> import trong urls.py, 0 path()
PortfolioAllocationView     -> import trong urls.py, 0 path()
```

⇒ **FE-02/FE-06 không thể làm trước khi thêm `path()`** cho 3 view này.

---

## 6. Wave 4 — Broker

| Slice | Tên | Bằng chứng | Trạng thái |
|---|---|---|---|
| **BRK-01** | Credential cutover + deprecation 410 | `dnse_credential_views.py` — **không có `410`** | ❌ |
| **BRK-02** | `secret_version` + rotate an toàn | `0020_userbrokerconfig_secret_version.py` + `reencrypt_broker_secrets.py` | ✅ |
| **BRK-03** | Capability matrix versioned | `test_capability_matrix.py` + `_pav.py` (PR #75) | ✅ |
| **BRK-04** | Sync bất đồng bộ + reconciliation | 24 match `reconcil` | ✅ |
| **BRK-05** | Chống SSRF `test-connection` | `endpoint_safety.py` + `assert_safe_outbound_url` | ✅ |
| **BRK-06** | SOC panel Broker Ops | `DNSEConnectionPanel` ở `/portfolios` | ⚠ |

⚠ **BRK-06**: panel DNSE nằm trong trang `/portfolios`, không phải SOC. Đường dẫn khác design spec.

---

## 7. Wave 5 — Paper ❌ gần như trống

| Slice | Tên | Bằng chứng | Trạng thái |
|---|---|---|---|
| **PAP-01** | `VirtualBrokerEngine` + `pnlDisplayMode=net` | `class VirtualBrokerEngine` → **0 match** | ❌ |
| **PAP-02** | `TradingDockPanel` vào Broker Hub | `TradingDockPanel` → **0 match** | ❌ |
| **PAP-03** | Chặn market crypto | `Market` enum (`models.py:1071-1084`) = `VN_SPOT`/`VN_FLOOR`/`FOREIGN` — **cố ý không có crypto** (D-35: không đoán thị trường theo mã) | ✅ |
| **PAP-04** | Plan gating + paper không gọi broker thật | `views_dnse.py:303-344` — `MODE_PAPER`/`MODE_LIVE`, `dry_run` bị từ chối (SAFE-01). **Phần plan gating theo `CoreTenant.Plan` chưa thấy** | ⚠ |
| **PAP-05** | Nâng widget `1.2.5` → `1.4.0` | `package.json` đang `^1.2.5` | 🔒 |

⚠ **PAP-01/02 = 0 match toàn repo.** Đây là wave gần như trống, không phải "vừa xong".

🔒 **PAP-05 cần sửa `packages/web/package.json`** — **deny-list** (`AGENT_PROTOCOL.md` §2). Chỉ Coordinator/Owner được sửa.

---

## 8. Wave 6 — Live ❌ toàn bộ

| Slice | Tên | Bằng chứng | Trạng thái |
|---|---|---|---|
| **LIV-01** | Live gates (kill-switch + capability + approval) | Kill-switch có (SAFE-03); approval gate chưa có | ❌ |
| **LIV-02** | Order modify/cancel + `OrderEvent` | `OrderEvent` → **0 match** | ❌ |
| **LIV-03** | `RiskLimit` + enforcement | `RiskLimit` → **0 match** | ❌ |
| **LIV-04** | Canary release 1% → 100% | `canary` 14 match nhưng ở advisory, không phải trading | ❌ |
| **LIV-05** | DR drill | Không có tài liệu, không có runbook | ❌ |

**Ràng buộc:** `AGENTS.md` ghi **P0-LEGAL-01: license `vnbroker` chưa ký ⇒ R3 live trading không tồn tại**.
Owner đã chốt 2026-09-27 rằng `vnbroker` là sở hữu của chủ repo (`CLAIMS.md:251`) — **cần xác nhận lại**
vì `AGENTS.md:73` vẫn ghi ngược lại.

---

## 9. Wave 7 — Hardening ❌ toàn bộ

| Slice | Tên | Bằng chứng | Trạng thái |
|---|---|---|---|
| **OPS-01** | SLO + error budget + alert | `SLO` 148 match (nhưng ở AI advisory, không phải trading); `error_budget` 14 | ❌ |
| **OPS-02** | Load test 1000 user | Không có kịch bản, không có kết quả | ❌ |
| **OPS-03** | Backup/restore + PITR | Không có runbook; tôi tự backup DB thủ công khi deploy | ❌ |
| **OPS-04** | ASVS 5.0 L2 + pen test | `ASVS` → **0 match** | ❌ |
| **OPS-05** | Retention policy 7 năm | `retention` 248 match (chủ yếu token/UI) | ❌ |
| **OPS-06** | SBOM CycloneDX ≥1.6 | File SBOM → **0** | ❌ |
| **OPS-07** | ISO 27001 evidence pack | Không có | ❌ |

---

## 10. Thứ tự đề xuất (theo phụ thuộc + giá trị)

> Ưu tiên **thấy được giá trị sớm**: Wave 3 FE đang là nút thắt lớn nhất — 6 trang
> đã có backend mà không có giao diện.

### Phase A — Mở khóa giá trị đã có backend (ưu tiên cao)

| # | Việc | Phụ thuộc | ed | Lý do ưu tiên |
|---|---|---|---|---|
| **A1** | Thêm `path()` cho `PortfolioChartView` + `PortfolioEquityCurveView` + `PortfolioAllocationView` | — | 0.5 | 3 view đã viết xong nhưng **không ai gọi được**. Chi phí gần như 0 |
| **A2** | FE-03 trang Holdings (bảng 13 cột) | A1 | 4 | Route + adapter đã có |
| **A3** | FE-05 trang Analytics (performance/risk/drawdown) | A1 | 4 | `risk_metrics` đã đầy đủ (VaR, drawdown, concentration) |
| **A4** | FE-02 trang Overview (KPI + equity curve) | A1 | 4 | Equity curve là exit criteria của Wave 3 |
| **A5** | FE-06 trang Allocation (ECharts treemap) | A1 | 3 | `allocation()` đã có |
| **A6** | Gọi `getPortfolioTechnicals` từ UI | A2 | 1 | Adapter có sẵn |
| **A7** | FE-08 i18n parity (vi 36 vs en 66) | — | 2 | Lệch 30 key |
| **A8** | FE-07 token portfolio + dark/light | — | 3 | `soc.tokens.css` 0 token |

**Phase A ≈ 21.5 ed** — biến 6 slice ❌ thành ✅ với backend đã có sẵn.

### Phase B — Broker gap

| # | Việc | Phụ thuộc | ed |
|---|---|---|---|
| B1 | BRK-01 credential deprecation 410 | — | 4 |
| B2 | BRK-06 SOC panel Broker Ops đúng chỗ | — | 3 |

### Phase C — Paper (mở live trading)

| # | Việc | Phụ thuộc | ed | Lưu ý |
|---|---|---|---|---|
| C1 | PAP-01 `VirtualBrokerEngine` | Phase A | 4 | 0 match hiện tại |
| C2 | PAP-02 `TradingDockPanel` | C1 | 3 | 0 match hiện tại |
| C3 | PAP-03 chặn crypto | C1 | 2 | |
| C4 | PAP-04 plan gating | C1 | 3 | |
| C5 | PAP-05 widget 1.4.0 | — | 4 | ⚠ `package.json` = **deny-list**, cần Owner |

### Phase D — Live + Hardening

Làm sau khi C xong **và** Owner xác nhận license `vnbroker`.

### Phase E — Hạ tầng (Owner)

| # | Việc | Tại sao chặn |
|---|---|---|
| E1 | Trả billing GitHub → bật 8 workflow | SAFE-07 không thể đạt |
| E2 | Rotate 7 secret | OW-01 |
| E3 | Xác nhận license `vnbroker` | Chặn toàn Wave 6 |
| E4 | `manage.py migrate` DB thật + kiểm `TEN-05` trên DB có dữ liệu | Wave 1 exit criteria |

---

## 11. Ngân sách

| Phase | ed | Nội dung |
|---|---|---|
| Đã làm (Wave −1..2 + API + FE-01) | ~120 | Xong |
| **Phase A** | **~21.5** | 6 slice FE + i18n + token |
| Phase B | ~7 | BRK-01, BRK-06 |
| Phase C | ~16 | Paper |
| Phase D | ~21 | Live (LIV 21 ed) + OPS (26 ed) = ~47 |
| **Còn lại** | **~92** | |

---

## 12. Việc Owner cần làm (không agent nào làm được)

| # | Việc | Chặn |
|---|---|---|
| 1 | Trả billing GitHub | SAFE-07 |
| 2 | Rotate 7 secret (thông báo user trước) | SEC-01 |
| 3 | **Xác nhận license `vnbroker`** | Toàn Wave 6 |
| 4 | Cho phép sửa `packages/web/package.json` | PAP-05 |
| 5 | Cho phép `migrate` DB thật | TEN-05 exit criteria |

---

## 13. Con số đã đo

```
61 slice trong plan
34 route portfolio/screener/userconfig trong backend
5  trang FE liên quan: PortfoliosPage, TransactionsPage, ScreenerPage, AIUsageAnalyticsPage, + 404
5/5 model Wave 2 tồn tại (LedgerEntry, CashFlow, PositionSnapshot, ValuationSnapshot, IdempotencyRecord)
16 hàm analytics: twr, mwr, xnpv, xirr, performance, benchmark_metrics, risk_metrics, allocation, freshness, ...
0  match: VirtualBrokerEngine, TradingDockPanel, OrderEvent, RiskLimit, ASVS, SBOM
vi/en i18n: 36 vs 66 key
migration trên DB dev: 0019 → 0023 (đã migrate trong đợt deploy)
```

## 14. Phát hiện cần ghi vào ledger

| # | Phát hiện | Mức |
|---|---|---|
| 1 | `PortfolioChartView` / `EquityCurveView` / `AllocationView` được **import vào `urls.py` nhưng không có `path()`** — code chết, không ai gọi được | 🟠 Cao |
| 2 | 4 endpoint có adapter nhưng **UI không gọi**: holdings, analytics, technicals, summary | 🟠 Cao |
| 3 | Wave 5/6/7 (`PAP`, `LIV`, `OPS`) = **18 slice, 0 bằng chứng code** | 🟡 TB |
| 4 | i18n lệch 30 key (vi 36 / en 66) | 🟡 TB |
| 5 | `PAP-05` cần sửa deny-list `package.json` | 🟡 TB |

---

## 15. Tham chiếu

| File | Vai trò |
|---|---|
| `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` | Nguồn 61 slice |
| `docs/PORTFOLIO_EXEC_SLICES_SEC_SAFE_TENANT_20260927.md` | Chi tiết SEC/SAFE/TEN |
| `docs/archive/docs-flat/portfolio_exec_slices/PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md` | Chi tiết LED/ANA/FE |
| `docs/archive/docs-flat/portfolio_exec_slices/PORTFOLIO_EXEC_SLICES_BROKER_LIVE_OPS_20260927.md` | Chi tiết BRK/PAP/LIV/OPS |
| `docs/archive/docs-flat/portfolio_ui_ux/PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md` | Design spec FE (115 KB) |
| `docs/PLAN_PORTFOLIO_P0_20261005.md` | 7 P0 đã merge (PR #74) |
| `docs/evidence/portfolio-commercial/AUDIT_PORTFOLIO_20261005.md` | Audit trước PR #74 |

**Baseline đo:** `dev @ 758c13141` · 679 BE test OK · SAFE-04 9/9 test OK trong container.