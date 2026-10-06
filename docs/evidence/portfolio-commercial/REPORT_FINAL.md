# REPORT FINAL — 7 P0 PORTFOLIO

| | |
|---|---|
| **Nhánh** | `feat/portfolio-p0-20261005` (base `dev` @ `d85e260d5`) |
| **Claim** | `docs/CLAIMS.md` — `opencode-portfolio-p0`, `opencode-portfolio-p0-b` |
| **Báo cáo gốc** | `docs/evidence/portfolio-commercial/AUDIT_PORTFOLIO_20261005.md` |
| **Kế hoạch** | `docs/PLAN_PORTFOLIO_P0_20261005.md` (rev.2) |
| **Test** | `docs/evidence/portfolio-commercial/TEST_REPORT.md` |
| **Bằng chứng gate** | `docs/evidence/portfolio-commercial/portfolio-p0-gates.md` |

---

## 1. Tiền đề đã sửa

**Portfolios không nằm trong `vnsaas`.** App `user_workspace` bị cắt có chủ đích
(`vnsaas/docs/saas_design_pack/D05_FUNCTIONAL_DECOMPOSITION_20261002.md:242`).
Nó thuộc **`vninvest`**, là một trong 4 app phải port sang `vnsaas` khi mở rộng
scope. Yêu cầu ban đầu đã được chỉnh lại trước khi làm gì.

## 2. Đã làm

| Mã | Vấn đề | Sửa ở đâu |
|---|---|---|
| **P0-1** | Role `viewer` tạo/xoá được `Portfolio`, `Transaction`, `SubAccount` — 10 write method / 6 class chỉ có `[IsAuthenticated, TenantScopePermission]` | `views.py` · `permissions.py` |
| **P0-2** | Không có gì ghi `LedgerEntry`/`CashFlow` ở runtime ⇒ `nav = null` vĩnh viễn (`services.py:374`) | `ledger/transaction_sync.py` (mới) · `signals.py` |
| **P0-3** | `opening_balance` không có đường ghi ⇒ mọi danh mục trả `nav: null` | `serializers.py` · `PortfoliosPage.tsx` |
| **P0-4** | Mobile portfolio luôn rỗng: không unwrap envelope, và P&L là số 0 hardcode | `packages/mobile/src/services/portfolioApi.ts` |
| **P0-5** | `TransactionsPage` gửi `side`/`trade_date`, serializer đọc `transaction_type`/`date` ⇒ POST 400 mọi lần | `TransactionsPage.tsx` |
| **P0-6** | Gate FE↔BE chỉ kiểm PATH, không kiểm FIELD ⇒ 3 lỗi trên lọt | `field-contract.test.js` (mới) |
| **P0-7** | `/transactions` không truyền prop ⇒ trang luôn dừng ở "Vui lòng chọn danh mục", P0-5 là công việc vô nghĩa | `TransactionsPage.tsx` · `PortfoliosPage.tsx` |

Ngoài ra sửa **2 bug P0 có sẵn** phát hiện trong lúc làm:

- **`has_workspace_permission` so khoá workspace với tên permission** ⇒ mọi
  role khác `owner` bị 403 ở 8 endpoint broker + 10 endpoint portfolio.
  `owner` không lỗi vì có `['*']` — đó là lý do test cũ không bắt được.
- **`WorkspacePermission` khoá cả method `GET`** ⇒ `viewer` mất quyền đọc danh
  mục của chính mình.

## 3. Ba mốc quy trình đã qua

**Stage 2 — audit plan độc lập trả `NEED_REVISION`** với 3 blocker + 18 objection.
Cả 3 blocker đều đúng và đều là lỗi của kế hoạch, không phải của code:

- AC-1 dùng bộ lọc AST chỉ nhận `@api_view` ⇒ class-based view cho ra **0 hàm khớp**
  ⇒ test xanh trong khi 24 endpoint vẫn hở
- AC-2 yêu cầu `DELETE` trên bảng có trigger chặn 3 tầng ⇒ bất khả thi
- P0-5 sửa một trang không bao giờ render

**Stage 5 — audit code độc lập: 5 blocker + 11 major.** Tự kiểm chứng từng cái;
**1 trong 5 là phát hiện sai** (B5) và đã loại. 4 blocker còn lại đều là lỗi do
chính phiên này tạo ra:

| Mã | Lỗi | Tác động nếu không sửa |
|---|---|---|
| B1 | `startswith` khớp nhầm tiền tố: `'tx:59'` khớp `'tx:5'` | Sửa giao dịch pk=5 đảo nhầm dòng sổ của pk=59 |
| B2 | Khoá `external_id` lệch khuôn của migration `0022` | `CashFlow` đếm đôi, NAV sai **trong khi `nav_reason` vẫn rỗng** — hệ thống trả số sai một cách tự tin |
| B3 | `@atomic` bao ngoài `try/except` | Lỗi sổ cái kéo **rollback cả bản ghi `Transaction` hợp lệ** |
| B4 | `portfolio_write` khoá cả `GET` | `viewer` mất quyền đọc |

**Stage 8 — bài học quy trình**, xem mục 7.

## 4. Tự sửa một kết luận đã sai

Bản audit đầu kết luận P0-2 là *"NAV sai âm thầm"*. **Sai.** Đọc lại
`ledger/services.py` cho thấy hai nguồn khác nhau: `holdings`/`cash` đọc từ
`Transaction` (đã đúng), `cash_flow_total` đọc từ `CashFlow` (rỗng). Guard ở
`:374` **chặn** NAV bằng `nav_reason='cash_flows_not_backfilled'` — đúng
fail-closed của LED-03 R5, không phải số sai. Lỗi phát hiện khi viết test
runtime, không phải khi đọc code. Đã sửa ở mục 3 của báo cáo audit.

## 5. Test

| Hạng mục | Kết quả |
|---|---|
| Backend 8 suite | **197 passed, 1 failed, 4 skipped** |
| Capability + RBAC | **45 passed** (baseline 13) |
| Đồng bộ ledger | **16 passed** (mới) |
| NAV wiring + holdings | **29 passed** |
| Adapter contract FE | **195 passed**, 8 suite (baseline 19) |
| Component FE | **105/105 file, 699/699 test** |
| `tsc --noEmit` (web) | **exit 0** |
| `makemigrations --check` | `No changes detected`, exit 0 |
| Multi-agent gate | **exit 0** |
| scan-secrets | **OK**, 3619 file; self-test 52/52 |

Mọi gate mới đều có bằng chứng **fail trước / pass sau**, thực hiện bằng
`git show HEAD:<file>` chứ không dùng `git checkout --`.

## 6. Phải bàn giao cho Owner / coordinator

### 6.1 Blocker chặn merge

`tests/test_ledger_models_wave2.py:441` khẳng định
`LedgerEntry.objects.count() == 0` — đóng băng hành vi cũ mà P0-2 xoá bỏ.
**Không tự sửa**: thư mục `user_workspace/tests/` đang được claim `in-progress`
bởi `portfolio-w3-api` (`docs/CLAIMS.md:277`). Đề xuất 3 phương án ở
`portfolio-p0-gates.md` §5.1.

### 6.2 Hai nguồn nói ngược nhau — cần Owner chốt

`AGENTS.md:73` — **P0-LEGAL-01**: license `vnbroker` chưa ký ⇒ R3 live trading
không tồn tại.
`docs/CLAIMS.md:251` — Owner chốt 2026-09-27: `vnbroker` là **sở hữu của chủ
repo** ⇒ *"không còn blocker pháp lý"*, R3 live trading được phép.

Wave 6 (LIV-01..05, 21–28 ed) không thể mở tới khi chốt.

### 6.3 Bốn claim `in-progress` đều stale

| Claim | Dòng | Ngày | Bằng chứng |
|---|---|---|---|
| `portfolio-exec-plan` | 251 | 09-27 | Branch không tồn tại; 3/7 file đã bị archive |
| `sec03-secret-scan` | 259 | 09-28 | Tự ghi push `--no-verify`; PR #46 chưa merge |
| `portfolio-w3-api` | 277 | 09-29 | `docs/evidence/wave3-api/` không tồn tại |
| `owner-audit-fix` | 942 | — | Thiếu cột ngày; file đã bị commit bởi `1e1b6e0c4` |

Đang **chặn file** mà không ai giữ — gồm `portfolio_analytics_views.py`,
`views_dnse.py`, `ledger/services.py`, `adapters/core/workspace.js`.

### 6.4 Bảy dòng tài liệu sai đã xác minh

`AGENTS.md:71` và `:75` (volume/quantity, `ops_audit.action`) · `OPEN_WORK_20260929.md`
OW-01/02/03 (secret trong git, `SecretStore`, CI) — đã bị sửa nhưng tài liệu chưa
cập nhật. Bảng đối chiếu ở `AUDIT_PORTFOLIO_20261005.md` §5.

### 6.5 Migration trên DB có dữ liệu: CHƯA CHẠY

`migrations/0019:30-33` cảnh báo DB ở state `0007` có row tenant-less sẽ nổ
`FieldError` tại `0008`, **trước khi** tới `0019`. Chưa kiểm chứng — `pf_p0_verify`
là DB rỗng.

### 6.6 15 write method trần trong `portfolio_analytics_views.py`

Đều `[IsAuthenticated]` trần, không có khai báo capability. **Không sửa được**
trong phiên này: file đang bị claim. Đây là phần tồn dư của SAFE-04.

## 7. Bài học quy trình (Stage 8)

**Không đọc code để kết luận hành vi của hệ thống tài chính.** Hai lần trong phiên
này:

1. Kết luận "NAV sai âm thầm" — sai; thực tế là **bị chặn** với mã lý do. Sai lệch
   này định hướng sửa hoàn toàn khác.
2. Kết luận "gate chạy được" — chỉ đúng khi dùng **đúng** lệnh của repo. Bỏ cờ
   `--experimental-vm-modules` thì mọi suite dùng `import.meta` chết, gồm cả
   suite có sẵn từ trước.

**Test runtime bắt được bug mà test AST không bắt.** Bug `has_workspace_permission`
so sai tên (B) chỉ lộ ra khi gọi HTTP thật với `editor`: role đúng, quyền có
trong `perms`, vẫn 403. Đọc `permissions.py` không bao giờ lộ ra vì `.get()` mặc
định trùng hợp lệ trông như đúng.

**Một test đóng băng hành vi cũ là tài sản, không phải rác.** Fixture dựng tay
`CashFlow` đúng như migration `0022` sẽ tạo — đó chính là trạng thái thật của
dữ liệu production sau backfill. Đừng xoá; hãy dựng lại đúng hình dạng đó.

**Audit độc lập có giá trị ngay cả khi một phần sai.** 4/5 blocker là lỗi thật
của chính phiên này. Phát hiện sai (B5) bị loại sau khi tự kiểm chứng — đó là lý
do phải tự chạy lại thay vì tin lời.

## 8. Việc chưa làm (ngoài phạm vi, đã thống nhất)

1. Không đóng 4 claim stale — cần Owner.
2. Không sửa `AGENTS.md` / `OPEN_WORK` (deny-list + mâu thuẫn license).
3. Không bảo vệ 15 write method trong `portfolio_analytics_views.py` — file bị claim.
4. Không mở Wave 3 FE-02/05/06 — cần route 4 view chết trong file bị claim.
5. Không đụng Wave 4–7 (17 slice) — cần Owner chốt license.
6. Không sửa `pav:1963,1969` `NameError` — file bị claim.
7. Không nối `ledger/analytics.py` vào view (ANA-01..05) — cần sửa file bị claim.
8. Không tạo migration. Không chạy `npm install` / `pip install`.
9. Không sửa `AGENTS.md` hay `packages/web/package.json` (deny-list).

## 9. Điều kiện đóng

| Cổng | Trạng thái |
|---|---|
| 3→4 Claim trước khi sửa | ✅ `ba22c4993` |
| 4→5 Audit code | ⚠ 5 blocker + 11 major → đã sửa 4 blocker + 7 major; **1 fail test chưa đóng** (mục 6.1) |
| 5→6 Test report | ✅ ghi rõ `Pass` / `Fail` / `CHƯA CHẠY` |
| 6→7 Sync + merge | ❌ **CHƯA** — cần Owner giải quyết 6.1 |

**Không merge được khi mục 6.1 còn nguyên**: suite đỏ mà không ai được sửa là
trạng thái không đóng được.