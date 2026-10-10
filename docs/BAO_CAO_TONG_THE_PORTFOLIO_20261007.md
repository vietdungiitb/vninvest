# BÁO CÁO TỔNG THỂ PORTFOLIO & HƯỚNG HOÀN THIỆN

> Ngày: 2026-10-07 · Baseline: `dev @ 758c13141` (đã merge PR #74, #75)
> Nguồn: `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` (61 slice / 9 wave) + đo bằng lệnh
> Bản đối chiếu chi tiết: `docs/DOI_CHIEU_PLAN_BACKEND_FRONTEND_PORTFOLIO_20261007.md`

---

## PHẦN 1 — TỔNG QUAN

### 1.1 Con số

| Chỉ số | Giá trị |
|---|---|
| Slice trong plan | **61** |
| Đã xong | **32** (52%) |
| Một phần | **7** (11%) |
| Chưa có | **21** (34%) |
| Cần Owner | **1** (2%) |
| Ước lượng ban đầu | 192–251 engineer-days / 5–6 tháng |
| Đã làm | **~120 ed** |
| Còn lại | **~92 ed** |

### 1.2 Trạng thái theo wave

| Wave | Tên | Kết quả | Đánh giá |
|---|---|---|---|
| **−1** | Security | 2/3 ✅ · 1 ⏸ | Tốt — phần còn lại đã chủ động trì hoãn |
| **0** | Safety | 6/7 ✅ · 1 ⚠ | Tốt — SAFE-07 bị chặn bởi billing |
| **1** | Tenant | 5/6 ✅ · 1 ⚠ | Tốt |
| **2** | Ledger + Analytics | **12/12 ✅** | **Hoàn hảo** |
| **3** | API + FE | **2/10** | **Nút thắt lớn nhất** |
| **4** | Broker | 4/6 ✅ | Khá |
| **5** | Paper | 0/5 ✅ (3 một phần, 1 cần Owner) | Gần như trống |
| **6** | Live | 0/5 | Chưa bắt đầu — **đã mở khoá pháp lý** |
| **7** | Hardening | 0/7 | Chưa bắt đầu |

### 1.3 Kết luận một câu

> **Backend vững, Frontend là nút thắt.** Toàn bộ Wave 2 (ledger + analytics) đã có đủ
> model, NAV engine, TWR/MWR, VaR, benchmark, allocation, freshness — nhưng **6 trang
> giao diện chưa tồn tại** dù backend và adapter đã sẵn sàng.

---

## PHẦN 2 — 4 QUYẾT ĐỊNH ĐÃ XỬ LÝ

| # | Quyết định | Kết quả |
|---|---|---|
| 1 | License `vnbroker` là của Owner | ✅ `AGENTS.md` sửa — **Wave 6 (LIV-01..05) không còn bị chặn pháp lý** |
| 2 | Rotate secret — phần mềm đang phát triển | ✅ **Trì hoãn có chủ đích**, ghi rõ lý do + điều kiện mở lại |
| 3 | Cho sửa `package.json` | ✅ Ghi nhận — mở đường cho PAP-05 (widget 1.2.5 → 1.4.0) |
| 4 | Migrate DB thật | ✅ **Đã migrate xong** `0019` → `0023`, `makemigrations --check`: No changes |

### 2.1 Bằng chứng cho quyết định #2 (rotate secret)

Mô tả cũ trong tài liệu **đã sai** — kiểm chứng lại:

| Secret | Commit chứa giá trị thật | Còn dùng? | Kết luận |
|---|---|---|---|
| `DNSE_CREDENTIAL_FERNET_KEY` | **7** | ❌ Không — key đã chết, DB có **0** `UserDNESCredential` | Rotate vô nghĩa, không mất dữ liệu nào |
| `CORE_PAT_PEPPER` | **11** | ⚠ **Có** — giá trị hiện tại trùng giá trị trong history | **Cái cần xử lý khi lên production** |

Ngoài ra: `compose.dev.env` **không còn tracked** (`2db35ed85`), `.gitignore:49` đã chặn
tái diễn, file tracked chỉ chứa `<REQUIRED>`. Repo **PRIVATE**.

⇒ **Điều kiện mở lại:** lên production · repo thành public · cấp access repo cho bên thứ ba.

### 2.2 Bằng chứng cho quyết định #4 (migrate DB)

```
user_workspace:  19 migration (0019)  →  23 migration (0023)
makemigrations --check --dry-run  →  No changes detected
DB có dữ liệu thật:  3 tenant · 4 user · 1 portfolio
```

⇒ Migration chạy **trên DB có dữ liệu**, không phải DB rỗng.
**Điều này đáp ứng exit criteria của TEN-05** (Wave 1): *"migration `0008` chạy được trên DB có dữ liệu"*.

### 2.3 Bằng chứng cho quyết định #1 (license)

`AGENTS.md` trước: *"license `vnbroker` chưa ký ⇒ R3 live trading không tồn tại"*
`CLAIMS.md:251` (2026-09-27): *"vnbroker là sở hữu của chủ repo ⇒ không còn blocker pháp lý"*

Hai nguồn **nói ngược nhau 4 tháng**. Owner xác nhận 2026-10-07 → đã sửa `AGENTS.md`.

---

## PHẦN 3 — PHÂN TÍCH KHOẢNG TRỐNG

### 3.1 Nút thắt #1: Frontend thiếu 6 trang, backend đã có

| Slice | Trang cần có | Backend | Adapter | UI |
|---|---|---|---|---|
| **FE-02** | Overview (KPI + equity curve) | `PortfolioEquityCurveView` ⚠ **chưa có route** | ❌ 0 hàm | ❌ |
| **FE-03** | Holdings (bảng 13 cột) | `PortfolioHoldingsView` ✅ | ✅ `getPortfolioHoldings` | ❌ |
| **FE-04** | Activity (timeline + CSV) | ⚠ `/transactions` có nhưng là bảng giao dịch | ✅ | ⚠ một phần |
| **FE-05** | Analytics (perf/risk/drawdown) | `PortfolioAnalyticsView` ✅ | ✅ `getPortfolioAnalytics` | ❌ |
| **FE-06** | Allocation (ECharts treemap) | `PortfolioAllocationView` ⚠ **chưa có route** | ❌ 0 hàm | ❌ |
| **FE-08** | i18n VI/EN parity | — | — | ⚠ lệch 30 key (vi 36 / en 66) |

**Dead code phát hiện được:**
```
PortfolioChartView        import trong urls.py, 0 path()
PortfolioEquityCurveView  import trong urls.py, 0 path()
PortfolioAllocationView   import trong urls.py, 0 path()
```
⇒ 3 view đã viết xong nhưng **không ai gọi được**.

### 3.2 Nút thắt #2: Wave 5/6/7 chưa bắt đầu

`VirtualBrokerEngine` = 0 match · `TradingDockPanel` = 0 · `OrderEvent` = 0 ·
`RiskLimit` = 0 · `ASVS` = 0 · SBOM = 0 file.

Đây **không phải "vừa xong"** mà là **chưa có gì**. 18 slice.

### 3.3 Điểm đã đóng

- **SAFE-04** (PR #75): 15 endpoint có kiểm tra quyền · 679 BE test OK · 9/9 SAFE-04 test OK trong container
- **7 P0 portfolio** (PR #74): P0-1..P0-6 + P1-5/6/8
- **Deploy docker dev**: 18 container, 0 unhealthy, API `status: ok`, migration `0019` → `0023`

---

## PHẦN 3b — BACKEND CÒN THIẾU GÌ (trả lời trực tiếp câu hỏi Owner)

> Owner hỏi: *"chưa code chưa làm — trả lời backend còn thiếu gì"*
> Đo bằng lệnh, 2026-10-07.

### 3b.1 Backend ĐÃ ĐỦ (không cần code thêm)

| Hạng mục | Bằng chứng |
|---|---|
| 5/5 model Wave 2 | `LedgerEntry:1040` · `CashFlow:1211` · `PositionSnapshot:1268` · `ValuationSnapshot:1324` · `IdempotencyRecord:1387` |
| 16 hàm analytics | `twr` · `mwr` · `xnpv` · `xirr` · `performance` · `benchmark_metrics` · `risk_metrics` · `allocation` · `freshness` · `daily_series` · `chain_link` · `percentile` … |
| NAV engine | `valuation.py:compute_nav` + `portfolio_valuation` |
| Append-only guard 2 tầng | `AppendOnlyMixin` — Python **và** DB trigger (migration `0023`) |
| Transaction → Ledger tự động | `signals.py:sync_transaction_to_ledger_on_save` |
| Pagination + filter | `CoreCursorPagination` (portfolio) · `TransactionCursorPagination` + filter `symbol` |
| RFC 9457 `problem+json` | 28 match |
| OpenAPI baseline + envelope | `openapi-schema-baseline.json` + 87 match |
| 3 view equity-curve/allocation/chart | **CÓ LOGIC THẬT** (`_compute_holdings`, `DailyPrice`) — chỉ thiếu route |
| Secret management | `SecretStore` + `secret_version` + `reencrypt_broker_secrets` |
| Test coverage ledger/analytics | `test_ledger_models_wave2.py` · `test_analytics_wave2.py` · `test_ledger_migration_backfill.py` |
| **Không có stub** | Grep `NotImplementedError`/`TODO`/`stub` trong `user_workspace` → chỉ comment + tên lớp test |

### 3b.2 Backend CÒN THIẾU — chia 2 mức

**Mức 1: rẻ, nên làm ngay**

| # | Thiếu | Bằng chứng | ed |
|---|---|---|---|
| **B1** | **3 route cho view đã có** | `PortfolioChartView` / `EquityCurveView` / `AllocationView` import trong `urls.py` nhưng **0 `path()`** | **0.5** |
| **B2** | BRK-01 credential deprecation **410** | `dnse_credential_views.py` — grep `410\|deprecat` → **0** | 4 |
| **B3** | PAP-04 phần **plan gating** | `MODE_PAPER`/`MODE_LIVE` có (`views_dnse.py:303-344`); gating theo `CoreTenant.Plan` chưa thấy | 2 |

**Mức 2: wave lớn, chưa bắt đầu**

| # | Thiếu | Bằng chứng | ed |
|---|---|---|---|
| **B4** | PAP-01 `VirtualBrokerEngine` | **0 match toàn repo** | 4 |
| **B5** | PAP-02 `TradingDockPanel` (FE nhưng cần endpoint hỗ trợ) | **0 match** | 3 |
| **B6** | LIV-01 **approval gate** cho live order | Kill-switch có (SAFE-03); approval chưa có | 4 |
| **B7** | LIV-02 `OrderEvent` | **0 match** | 4 |
| **B8** | LIV-03 `RiskLimit` + enforcement | **0 match** | 5 |
| **B9** | LIV-04 canary release | `canary` 14 match nhưng ở AI advisory, không phải trading | 4 |
| **B10** | LIV-05 DR drill | Không có runbook | 4 |
| **B11** | OPS-01 SLO/error budget **cho trading** | 148 match `SLO` nhưng ở AI advisory | 4 |
| **B12** | OPS-03 PITR (backup có rồi, thiếu point-in-time recovery) | `scripts/test-backup-restore.sh` có; PITR chưa | 2 |
| **B13** | OPS-05 retention policy 7 năm (cho dữ liệu tài chính) | 248 match `retention` nhưng ở token/UI | 2 |
| **B14** | OPS-06 SBOM CycloneDX | **0 file** | 2 |
| **B15** | OPS-04 ASVS L2 + pen test | **0 match** | 5 |
| **B16** | OPS-02 load test | Không có kịch bản | 3 |
| **B17** | BRK-06 SOC panel Broker Ops (backend endpoint cho panel) | Panel đang ở `/portfolios/manage`, không phải SOC | 3 |

### 3b.3 Trả lời thẳng câu hỏi

> **Backend core (ledger + analytics + API) ĐÃ ĐỦ** — không cần code thêm cho
> nghiệp vụ danh mục/holdings/NAV/chỉ số. Wave 2 hoàn hảo 12/12.
>
> **Backend còn thiếu tập trung ở 2 nơi:**
> 1. **Live trading** (B6–B10): `RiskLimit`, `OrderEvent`, approval gate, canary — **0 match**.
>    Đây là 21 ed, và giờ **đã mở khoá** sau khi bạn xác nhận license.
> 2. **Compliance/hardening** (B12–B16): ASVS, SBOM, PITR, load test — **0 match**, 18 ed.
>
> **Việc rẻ nhất còn lại: B1 = 0.5 ed** thêm 3 dòng `path()` — mở khóa FE-02 + FE-06.

---


### Phase A — Mở khóa giá trị đã có (~21.5 ed, ưu tiên cao)

> Backend đã sẵn sàng. Chỉ thiếu route + UI + token.

| # | Việc | Phụ thuộc | ed | Kết quả |
|---|---|---|---|---|
| **A1** | Thêm `path()` cho 3 view (chart/equity-curve/allocation) | — | **0.5** | Mở khóa FE-02 + FE-06 |
| **A2** | FE-03 trang Holdings — bảng 13 cột | A1 | 4 | Route + adapter đã có |
| **A3** | FE-05 trang Analytics — perf/risk/drawdown | A1 | 4 | `risk_metrics` đã đầy đủ |
| **A4** | FE-02 trang Overview — KPI + equity curve | A1 | 4 | Exit criteria của Wave 3 |
| **A5** | FE-06 trang Allocation — ECharts treemap | A1 | 3 | `allocation()` đã có |
| **A6** | Gọi `getPortfolioTechnicals` từ UI | A2 | 1 | Adapter có sẵn |
| **A7** | FE-08 i18n parity — lệch 30 key | — | 2 | vi 36 / en 66 |
| **A8** | FE-07 token portfolio + dark/light | — | 3 | `soc.tokens.css` hiện 0 token |

**Phase A biến 6 slice ❌ → ✅ với ~21.5 ed** — hiệu quả cao nhất.

### Phase B — Broker gap (~7 ed)

| # | Việc | ed |
|---|---|---|
| B1 | BRK-01 credential cutover + deprecation 410 | 4 |
| B2 | BRK-06 SOC panel Broker Ops đúng chỗ (hiện ở `/portfolios/manage`) | 3 |

### Phase C — Paper trading (~16 ed)

| # | Việc | ed | Lưu ý |
|---|---|---|---|
| C1 | PAP-01 `VirtualBrokerEngine` + `pnlDisplayMode=net` | 4 | Phụ thuộc Phase A |
| C2 | PAP-02 `TradingDockPanel` vào Broker Hub | 3 | |
| C3 | PAP-04 plan gating (bổ sung — `mode` đã có) | 3 | |
| C4 | PAP-05 widget `1.2.5` → `1.4.0` | 4 | ✅ **Owner đã cho sửa `package.json`** |
| ~~C5~~ | ~~PAP-03 chặn crypto~~ | — | ✅ **Đã xong** (`Market` enum, D-35) |

### Phase D — Live trading (~21 ed) — **đã mở khoá**

| # | Việc | ed |
|---|---|---|
| D1 | LIV-01 live gates (kill-switch + capability + approval) | 4 |
| D2 | LIV-02 order modify/cancel + `OrderEvent` | 4 |
| D3 | LIV-03 `RiskLimit` + enforcement | 5 |
| D4 | LIV-04 canary 1% → 100% | 4 |
| D5 | LIV-05 DR drill | 4 |

### Phase E — Hardening (~26 ed)

| # | Việc | ed |
|---|---|---|
| E1 | OPS-01 SLO + error budget + alert (cho trading, không phải AI) | 4 |
| E2 | OPS-03 backup/restore + PITR (hiện chưa có runbook) | 3 |
| E3 | OPS-04 ASVS 5.0 L2 + pen test | 5 |
| E4 | OPS-06 SBOM CycloneDX ≥1.6 | 2 |
| E5 | OPS-07 ISO 27001 evidence pack | 3 |
| E6 | OPS-02 load test 1000 user | 3 |
| E7 | OPS-05 retention policy 7 năm | 2 |

---

## PHẦN 5 — NGÂN SÁCH & LỊCH

| Phase | ed | Slice | Ưu tiên |
|---|---|---|---|
| ~~Đã làm~~ | ~~120~~ | ~~32~~ | — |
| **A** | **21.5** | 8 | 🔴 Cao |
| **B** | **7** | 2 | 🟡 TB |
| **C** | **16** | 4 | 🟡 TB |
| **D** | **21** | 5 | 🟢 Sau C |
| **E** | **26** | 7 | 🟢 Sau D |
| **Tổng còn lại** | **~92** | **21** | |

**Ưuớc lượng:** Phase A+B ≈ **4 tuần** (1 agent). Đủ để có sản phẩm dùng được
vì ledger + analytics + API đã xong — chỉ thiếu lớp trình bày.

---

## PHẦN 6 — QUYẾT ĐỊNH CÒN LẠI CẦN OWNER

| # | Việc | Trạng thái | Chặn |
|---|---|---|---|
| 1 | License `vnbroker` | ✅ **Đã chốt** | — |
| 2 | Rotate secret | ✅ **Trì hoãn có chủ đích** | Mở lại khi lên production |
| 3 | Sửa `package.json` | ✅ **Đã cho phép** | Mở PAP-05 |
| 4 | Migrate DB thật | ✅ **Đã xong** | — |
| 5 | **Trả billing GitHub** | ✅ **CHỦ ĐỘNG TẮT** (2026-10-07) | Owner chọn dev local, không dùng CI |
| 6 | Xác nhận mức độ ưu tiên Phase A | ⏳ | Quyết định lộ trình |

**Về #5 (billing):** Owner đã chốt 2026-10-07 — **phát triển bằng dev local, merge
thẳng `dev`, không dùng CI GitHub**. Hệ quả: **SAFE-07 không đạt** (đây là quyết định,
không phải thiếu sót). Gate thực tế chạy ở local: `.githooks/pre-push` → **17 PASS**.

---

## PHẦN 7 — RỦI RO CẦN BIẾT

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| 1 | `CORE_PAT_PEPPER` đang dùng **và** nằm trong git history (11 commit) | 🟠 TB | Repo PRIVATE nên rủi ro thấp. **Bắt buộc rotate trước khi lên production** |
| 2 | `BROKER_SECRET_KEY` dev do tôi sinh — **không khớp** vnbroker thật | 🟠 TB | Lệnh broker sẽ 401 nếu dev cần nối vnbroker thật. Cần key thật khi chuyển sang test |
| 3 | 25 file test `src/*/tests/` chưa chạy | 🟡 TB | Chưa có kết luận cho các file này |
| 4 | Playwright E2E chưa chạy | 🟡 TB | UI mới (Phase A) cần E2E để tránh hồi quy |
| 5 | Chưa có runbook backup/restore (OPS-03) | 🟡 TB | Tôi backup DB thủ công 2.42 GB khi deploy — chưa tự động hoá |

---

## PHẦN 8 — TRẠNG THÁI HẠ TẦNG

| Hạng mục | Trạng thái |
|---|---|
| Docker dev stack | ✅ 18 container, 0 unhealthy |
| API | ✅ `status: ok` |
| Migration DB | ✅ `0019` → `0023`, có dữ liệu thật |
| BE test | ✅ 679/679 OK (baseline có 1 error → đã hết) |
| SAFE-04 test | ✅ 9/9 OK trong container |
| `pre-push-gate` | ✅ 17 PASS / 0 SKIP / 0 FAIL |
| `tsc --noEmit` | ✅ 0 lỗi |
| CI GitHub | ❌ 8/9 workflow bị disable (billing) |
| E2E / mobile | ❌ chưa chạy |

---

## THAM CHIẾU

| File | Vai trò |
|---|---|
| `docs/DOI_CHIEU_PLAN_BACKEND_FRONTEND_PORTFOLIO_20261007.md` | Bảng đối chiếu 61 slice chi tiết |
| `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` | Nguồn plan |
| `docs/OPEN_WORK_SEC_20260929.md` | OW-01 trì hoãn · OW-03 billing · OW-05 đã chọn (b) |
| `docs/LESSONS/INDEX.md` | 19 bài học phòng ngừa |
| `docs/CLAIMS.md` | Registry claim |

**Baseline đo:** `dev @ 758c13141` · PR #74 + #75 đã merge · 679 BE test OK ·
SAFE-04 9/9 trong container · migration `0019` → `0023`.