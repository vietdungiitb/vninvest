# PLAN — ĐÓNG 7 P0 PORTFOLIO (rev.2)

| | |
|---|---|
| **Nguồn** | `docs/evidence/portfolio-commercial/AUDIT_PORTFOLIO_20261005.md` |
| **Nhánh** | `feat/portfolio-p0-20261005` (base `dev` @ `d85e260d5`) |
| **Claim** | `docs/CLAIMS.md` — `opencode-portfolio-p0`, commit `ba22c4993` |
| **Chế độ** | **Mode B — tự giám sát** |
| **Rev.2** | Sau `PLAN_AUDIT` verdict `NEED_REVISION`. Sửa 3 blocker + 18 objection. |
| **Ước lượng** | 8–12 engineer-days (rev.1 ước 6–9 — **thấp**, xem O11/O3) |

> **Vì sao Mode B.** P0-1 và P0-3 cùng chạm `views.py` ⇒ không rời nhau ⇒ Mode A tái tạo Hazard 1. Đồng thời 4 claim `in-progress` cũ đang giữ file trung tâm ⇒ không thể an toàn khi chạy song song.

---

## 0. Baseline gate — đo thật trước khi yêu cầu (hazard 6)

| # | Gate | Lệnh thật | Baseline @ `d85e260d5` |
|---|---|---|---|
| G1 | BE capability + ledger model | `pytest packages/core/backend/src/user_workspace/tests/{test_capability_matrix,test_ledger_models_wave2}.py` | **47 passed**, exit 0 |
| G2 | FE adapter contract | `jest src/adapters/core/__tests__/{route-contract,dnse-order-contract}.test.js` | **19 passed**, exit 0 |
| G3 | Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **exit 0**, 0 lỗi, 63 cảnh báo |
| G4 | Migration apply | `manage.py migrate` | **OK** tới `0023_append_only_guards` |
| G5 | TypeScript | `cd packages/web && npx tsc --noEmit` | **exit 0 — XANH** (đo bởi PLAN_AUDIT; rev.1 ghi CHƯA CHẠY là sai) |
| G6 | Migration parity | `manage.py makemigrations --check --dry-run` | **"No changes detected", exit 0 — XANH** (đo bởi PLAN_AUDIT) |
| G7 | Mobile typecheck | `cd packages/mobile && npx tsc --noEmit` | **CHƯA CHẠY** — không có `tsconfig.json`, không có test script ⇒ **không đặt thành AC** (O11) |

Hạ tầng: Postgres `127.0.0.1:5433` (`docker exec vninvest-dev-core-db`), Redis `127.0.0.1:6380` (`settings.py:446` mặc định 6379 ⇒ phải set), DB `pf_p0_verify`.

---

## 1. Số đo thay cho ước lượng

Mọi số dưới đây tái lập được bằng script AST, không đếm bằng mắt:

| Số | Giá trị | Cách tái lập |
|---|---|---|
| Write method trong `views.py` | **17** | AST `ClassDef` + `bases` chứa `View` + method ∈ `{post,put,patch,delete}` |
| Trong đó là **tài chính** | **10** | `PortfolioListCreateView.post` L113 · `PortfolioDetailView.{patch,delete}` L147 · `TransactionListCreateView.post` L253 · `TransactionDetailView.{patch,delete}` L289 · `SubAccountListCreateAPIView.post` L559 · `SubAccountDetailAPIView.{patch,delete}` L603 · `SubAccountTransactionsAPIView.post` L685 |
| Write method trong `portfolio_analytics_views.py` | **15** | Tất cả `[permissions.IsAuthenticated]` trần — **ngoài phạm vi**, file đang bị claim |

> **Sửa O4.** Báo cáo audit rev.1 ghi "9 endpoint" — **sai**, số đúng là **10 write method / 6 class**.
> **Sửa O15.** `migrations/0022:250-251` **không** phải chỗ backfill; thật là `0022:156,161`. `0022:250-251` là `operations=[RunPython(...)]`.

---

## 2. Ba blocker đã sửa

### O1 (blocker) — Gate AC-1 không thể phát hiện thứ nó phải phát hiện

**Vấn đề.** `test_capability_matrix.py:279-284` chỉ xét `ast.FunctionDef` có decorator `@api_view`. `views.py` dùng **class-based view** (`permission_classes` là class attribute). Thêm `views.py` vào tuple ở dòng 276 ⇒ **0 hàm khớp** ⇒ test xanh trong khi 24 endpoint vẫn hở. Tệ hơn: `test_ast_filter_actually_examines_functions` (`:311-342`) có `assertGreaterEqual(found, 7)` — thêm file làm `found` tụt ⇒ test này sẽ đỏ, tức lộ ra sự thật là filter hỏng, chứ không sửa được gì.

**Sửa.** Viết lại `NoBarePermissionOnFinancialWritesTests`:
1. Quét `ast.ClassDef` (không `FunctionDef`).
2. Xét method `post|put|patch|delete` **bên trong** lớp.
3. Đọc `permission_classes` từ **class attribute** (`ast.Assign` với target `Name('permission_classes')`), không từ decorator.
4. Thêm self-test mới: khẳng định **≥ 6 class tài chính** được xét (theo đúng danh sách ở mục 1) — chống "0 hàm khớp ⇒ xanh im lặng".

### O2 (blocker) — AC-2 DELETE không khả thi

**Vấn đề.** `models.py:1004-1008` `AppendOnlyMixin.delete()` **raise vô điều kiện**; `migrations/0023_append_only_guards.py:41-45,100-107` thêm trigger Postgres `RAISE EXCEPTION`. Xoá `LedgerEntry` là **vi phạm thiết kế**, không phải bug.

**Sửa.** AC-2 đổi thành bù trừ theo `reversal_of` (`models.py:1129-1131`, `on_delete=PROTECT`):
- `Transaction` **DELETE** ⇒ tạo `LedgerEntry` loại `ADJUSTMENT` trừ ngược, `reversal_of` trỏ entry gốc. **Không** xoá dòng cũ.
- `Transaction` **PATCH** ⇒ tạo entry bù (cho phần đổi) + entry mới (cho giá trị mới). Bổ sung này — rev.1 bỏ sót (`views.py:306`).
- **Cấm tuyệt đối** dùng cờ `app.allow_ledger_mutation` (`0023:39`) trong code runtime.

### O3 (blocker) — P0-5 sửa một trang không bao giờ render

**Vấn đề.** `main.tsx` route `transactions` gọi `createElement(resolvePageComponent('transactions'))` — **không truyền prop nào**. `pageRegistry.js:5,33` forward props rỗng. `TransactionsPage.tsx:25` `portfolioId?` là optional ⇒ `tsc` xanh ⇒ `TransactionsPage.tsx:103` luôn trả `"Vui lòng chọn danh mục."`.

⇒ Sửa tên field trên trang không bao giờ hiện form là **công việc vô nghĩa**. Đây chính là intent trap: AC-5 chỉ pass được nếu test tự tiêm `portfolioId` bằng tay.

**Sửa.** Thêm **P0-7**: `TransactionsPage` tự resolve danh mục mặc định qua `getPortfolios()` khi không có `portfolioId`, **và** `PortfoliosPage` thêm link điều hướng sang `/transactions`. Không sửa `main.tsx` (file không nằm trong claim; cũng là route registry chung).

---

## 3. Thứ tự thực thi

```
S6  P0-6  gate field contract (sinh danh sách field từ OpenAPI, không viết tay)   [O13]
S1  P0-1  capability 10 write method tài chính trong views.py                      [O1,O4,O5]
S2  P0-3  đường ghi opening_balance + opening_balance_source                       [O8,O9]
S3  P0-5+7 TransactionsPage: contract field + resolve danh mục + link điều hướng  [O3,O12]
S4  P0-4  mobile unwrap envelope + bỏ số 0 giả                                     [O10]
S5  P0-2  signal Transaction→LedgerEntry + bù trừ theo reversal_of                  [O2,O6]
```

**S2 trước S5** vì `ledger/services.py:374-382` chặn NAV khi portfolio có `Transaction` mà chưa có `CashFlow`. AC-3 của S2 chỉ khẳng định trên portfolio **chưa có giao dịch** (O7).

---

## 4. Tiêu chí chấp nhận — sửa theo intent trap

### AC-6 — Gate field contract (P0-6)
- **Given** danh sách field lấy từ **OpenAPI schema** (`vninvest_core/urls.py:55` đã có `SpectacularAPIView`), **không** bảng viết tay (O13)
- **When** `jest src/adapters/core/__tests__/field-contract.test.js`
- **Then** exit ≠ 0 nếu tên field adapter gửi lệch với schema BE; exit 0 nếu khớp
- **Negative test bắt buộc (hazard 10):** đổi `transaction_type`→`side` trong `TransactionsPage.tsx`, gate phải đỏ, hoàn nguyên bằng `git show HEAD:<file> > <file>` (**không** dùng `git checkout --` — hazard 11)

### AC-1 — Capability trên write method tài chính (P0-1)
- **Given** user role `viewer` của tenant T (không có `sa:write`)
- **When** POST/PATCH/DELETE `Portfolio`, `Transaction`, `SubAccount` của T
- **Then** HTTP **403** **và** đếm hàng trong DB trước/sau **không đổi**
- **And** `permission_classes` mới giữ đúng thứ tự `[IsAuthenticated, TenantScopePermission, WorkspacePermission]` — **không** thay thế `TenantScopePermission` (thiếu nó thì `views.py:142-143` lưu `tenant=None`) (O5)
- **And** gate AST mới khẳng định **≥ 6 class** được xét, không phải 0

### AC-2 — `opening_balance` ghi được (P0-2 → đánh số lại)
- **Given** `Portfolio` P có **chưa** giao dịch nào, `opening_balance = 1_000_000_000`
- **When** PATCH `opening_balance` + `opening_balance_source`
- **Then** HTTP 200, GET `.../summary/` trả `nav` là **số**, `nav_reason` ≠ `no_opening_balance`
- **And** `opening_balance < 0` ⇒ **400** (validator đặt ở serializer, **không** đổi schema) (O8)
- **And** `opening_balance_source` bắt buộc được ghi cùng lúc — không nhận con số không rõ gốc (O9)

### AC-3 — `Transaction` cập nhật ledger (P0-2)
- **Given** portfolio có `opening_balance` hợp lệ
- **When** POST một `Transaction` BUY
- **Then** có `LedgerEntry` + `CashFlow` ứng với giao dịch đó; `compute_nav()` trả `nav` là số; `cash_cross_check` **không** bật `reconciliation_required`
- **And** **idempotent** — POST lại cùng `external_id` không tạo dòng trùng (ràng buộc `models.py:1150-1154`)
- **And** **PATCH** `Transaction` ⇒ sinh entry bù **và** entry mới (O6)
- **And** **DELETE** `Transaction` ⇒ sinh entry `ADJUSTMENT` trỏ `reversal_of`; **không** xoá entry gốc; **không** dùng `app.allow_ledger_mutation` (O2)

### AC-4 — Mobile đọc được dữ liệu thật (P0-4)
- **Given** BE trả `{data:{count:1,results:[…]}, meta:{}}`
- **When** gọi `getPortfolios()` qua `authClient` thật
- **Then** trả mảng **1 phần tử**, không phải `[]`
- **And** `getSummary.total_realized_pl` / `total_dividends` lấy từ `portfolio_analytics_views.py:286,287` thật — **không** còn `0` hardcode (O10)
- **And** `getHoldings` / `getAllocation` dùng dữ liệu server, không tự roll-forward lệch (O10)
- **And** `loadPortfolioTransactions` (`:78`) sửa cùng lỗi `response.data?.results` — nếu không, `getSummary`/`getHoldings`/`getAllocation` vẫn rỗng dù AC đầu xanh

### AC-5 — Người dùng thực sự tạo được giao dịch (P0-5 + P0-7)
- **Given** user đăng nhập, **mở `/transactions` từ menu — không tiêm `portfolioId` bằng tay**
- **When** trang tự resolve danh mục, người dùng điền form và submit
- **Then** form **hiện ra** (không dừng ở "Vui lòng chọn danh mục."), HTTP **201**, hàng mới có `transaction_type` + `date` đúng
- **And** bảng hiển thị `transaction_type` / `date` **đúng giá trị** — không phải chỉ "không `undefined`" (O12)
- **And** từ `/portfolios` có link điều hướng sang `/transactions`
- **And** giá trị `side`/`trade_date` cũ vẫn được chấp nhận để không phá client cũ

---

## 5. Slice và file — rời nhau sau khi sửa

| Slice | File sửa | Ràng buộc |
|---|---|---|
| **S6** | `packages/web/src/adapters/core/__tests__/field-contract.test.js` (mới) | File mới, không tranh ai |
| **S1** | `user_workspace/views.py`, `user_workspace/tests/test_capability_matrix.py` | `permissions.py` **chỉ đọc** |
| **S2** | `user_workspace/serializers.py` | `views.py` dùng chung với S1 ⇒ serialize S1→S2 |
| **S3** | `packages/web/src/pages/TransactionsPage.tsx`, `packages/web/src/pages/PortfoliosPage.tsx` | `adapters/core/workspace.js` **không** sửa (claim L277) |
| **S4** | `packages/mobile/src/services/portfolioApi.ts` | |
| **S5** | `user_workspace/signals.py`, `user_workspace/ledger/` (module mới), `user_workspace/tests/test_transaction_ledger_sync.py` (mới) | `ledger/services.py` **không** sửa (claim L277) |

**S1 và S2 chung `views.py`** ⇒ serialize.

### Coupling phải ghi nhận (O17)

`serializers.py` là dependency của file **đang bị claim**:
- `views_dnse.py:36` (claim L277) import từ `serializers.py`
- `portfolio_analytics_views.py:1955,1960` (claim L942) import từ `serializers.py`

⇒ S2 **chỉ thêm field**, không xoá/không đổi tên field cũ. Nếu cần serializer riêng thì tạo file mới, không sửa `serializers.py` theo cách phá vỡ import.

### Hai claim `in-progress` chồng thư mục `tests/` (O18)

`CLAIMS.md:277` giữ `user_workspace/tests/`; `CLAIMS.md:942` giữ 2 file trong đó. `check-multi-agent.mjs` **vẫn PASS** vì không kiểm tra chồng claim.

⇒ File test **mới** (`test_transaction_ledger_sync.py`) không đụng 2 file bị giữ. `test_capability_matrix.py` không nằm trong danh sách giữ. **Không sửa 2 file bị giữ** — đã ghi trong claim.

### File KHÔNG được chạm

`portfolio_analytics_views.py` · `views_dnse.py` · `ledger/services.py` · `adapters/core/workspace.js` — claim `in-progress` agent khác (`CLAIMS.md:277`, `:942`).

⇒ **15 write method trần `[IsAuthenticated]` trong `portfolio_analytics_views.py` không thể bảo vệ trong kế hoạch này.** Đã ghi ở mục 6.

### Deny-list — KHÔNG sửa

`AGENTS.md` · `packages/web/package.json` · `pyproject.toml` · `requirements.txt` · `package-lock.json` · `docker-compose*.yml` · `.env*`

⇒ G7 (mobile typecheck) không chạy được vì thiếu hạ tầng, mà thêm script cần sửa `package.json` = deny-list. Ghi `CHƯA CHẠY` thay vì lách. Gate P0-6 là **file test mới** chạy bằng lệnh `jest` trực tiếp (`jest.config.js:18-20` `testMatch` tự thu thập — không cần khai báo, O14).

---

## 6. Ngoài phạm vi (explicit non-goals)

1. **Không** đóng 4 claim stale (L251/259/277/942) — cần Owner.
2. **Không** sửa dòng sai trong `AGENTS.md` / `OPEN_WORK` (deny-list + mâu thuẫn license cần Owner chốt).
3. **Không** bảo vệ **15 write method trần** trong `portfolio_analytics_views.py` — file bị claim L942/L277.
4. **Không** mở Wave 3 FE-02/05/06 — cần route 4 view chết trong file bị claim.
5. **Không** đụng Wave 4–7 (17 slice chưa làm) — cần Owner chốt license `vnbroker`.
6. **Không** sửa `pav:1963,1969` `NameError` — file bị claim.
7. **Không** nối `ledger/analytics.py` vào view (ANA-01..05) — cần sửa `portfolio_analytics_views.py`.
8. **Không** dùng cờ `app.allow_ledger_mutation` (`0023:39`) trong code runtime.
9. **Không** migrate dữ liệu thật — `pf_p0_verify` là DB rỗng.
10. **Không** chạy `npm install` / `pip install`.
11. **Không** thêm npm script — deny-list (O11, O14).
12. **Không** sửa `main.tsx` — không nằm trong claim; giải quyết P0-7 bằng tự-resolve trong page.

---

## 7. Không tạo migration

Head = `0023_append_only_guards` (`migrations/0023_append_only_guards.py:155`).

P0-2 chỉ dùng field **đã có trong DB** (`opening_balance` `0021:35`, `opening_balance_source` `0021:40`) ⇒ không đổi schema. Validator đặt ở **serializer** (`serializers.py`), không thêm `validators=` vào model — nếu thêm vào model thì Django sinh migration mới.

Kiểm bằng G6 (`makemigrations --check --dry-run`) phải vẫn "No changes detected".

**Không bao giờ** tự đặt số migration (AGENTS.md:22 — đã gây chặn deploy 2026-09-26).

---

## 8. Chiến lược hoàn nguyên

Mỗi slice **một commit riêng**. Hoàn nguyên đơn lẻ: `git revert <hash>`.

Không dùng `git checkout -- <file>` để hoàn nguyên thử nghiệm (hazard 11 — đã phá việc 2 lần):

```bash
cp <file> /tmp/keep.<ext>
git show HEAD:<file> > <file>
npx jest <test>          # kỳ vọng FAIL
cp /tmp/keep.<ext> <file>
```

---

## 9. Cổng Stage

| Cổng | Điều kiện |
|---|---|
| 1→2 | `PLAN_AUDIT` = `PASS` hoặc `AGREE` |
| 3→4 | Claim đã commit riêng (`ba22c4993`) ✅ · `git diff <base>...HEAD` khác rỗng |
| 4→5 | `AUDIT` báo 0 `blocker`, 0 `major`, `confidence: high` |
| 5→6 | Mọi dòng `TEST_REPORT` là `Pass` hoặc `CHƯA CHẠY` kèm lý do |
| 6→7 | Cả hai + claim → `released` |