# GATE EVIDENCE — 7 P0 PORTFOLIO (2026-10-05, rev.2)

| | |
|---|---|
| **Nhánh** | `feat/portfolio-p0-20261005` (base `dev` @ `d85e260d5`) |
| **Claim** | `docs/CLAIMS.md` — `opencode-portfolio-p0`, `opencode-portfolio-p0-b` |
| **DB test** | `pf_p0_verify` trên `127.0.0.1:5433` (Postgres, tạo mới, **rỗng**) |
| **Redis** | `127.0.0.1:6380` |
| **Rev.2** | Sau audit độc lập: 5 blocker + 11 major. Đã sửa 4 blocker + 7 major, loại 1 phát hiện sai. |

## 0. Biến môi trường bắt buộc

`settings.py:446` mặc định `REDIS_URL=redis://localhost:6379/1`. Ở máy này
Redis publish ở **6380**, không phải 6379 ⇒ không set thì test chết hàng loạt với
`redis.exceptions.ConnectionError: Error 10061`. Đây là bẫy môi trường, không
phải lỗi code.

```powershell
$env:DJANGO_DEBUG="1"
$env:CORE_DJANGO_SECRET_KEY="p0-verify-local-only-not-a-real-secret-000000000000"
$env:CORE_PAT_PEPPER="p0-verify-pepper-local-only-000000000000000000"
$env:CORE_AD_SIGNING_SECRET="p0-verify-ad-local-only-00000000000000"
$env:CORE_DATABASE_URL="postgresql://vninvest:devpassword@127.0.0.1:5433/pf_p0_verify"
$env:LEGACY_DATABASE_URL="postgresql://vninvest:devpassword@127.0.0.1:5433/pf_p0_verify"
$env:REDIS_URL="redis://127.0.0.1:6380/9"
```

Giá trị bí mật ở trên **chỉ dùng cho DB test cục bộ**, không phải bí mật thật.

## 1. Baseline đo được trước khi sửa

| Gate | Lệnh | Baseline |
|---|---|---|
| G1 | `pytest user_workspace/tests/{test_capability_matrix,test_ledger_models_wave2}.py` | **47 passed** |
| G2 | `jest src/adapters/core/__tests__/{route-contract,dnse-order-contract}.test.js` | **19 passed** |
| G3 | `node packages/web/scripts/check-multi-agent.mjs` | **exit 0**, 0 lỗi, 63 cảnh báo |
| G4 | `manage.py migrate` | OK tới `0023_append_only_guards` |
| G5 | `cd packages/web && npx tsc --noEmit` | **exit 0** |
| G6 | `manage.py makemigrations --check --dry-run` | `No changes detected`, exit 0 |

## 2. Kết quả sau khi sửa

| Gate | Lệnh | Kết quả |
|---|---|---|
| G1 | pytest 8 suite liên quan | **197 passed, 1 failed, 4 skipped** |
| G1a | `test_capability_matrix.py` | **45 passed** (baseline 13) |
| G1b | `test_transaction_ledger_sync.py` (mới) | **16 passed** |
| G1c | `test_ledger_holdings.py` | **29 passed** |
| G1d | `test_order_safety.py`, `test_valuation_nav.py`, `test_financial_validators.py`, `test_portfolio_analytics_native_routes.py` | xanh |
| G2 | `npm test -- src/adapters/core` | **195 passed**, 8 suite |
| G2b | `npx vitest run` | **Lần 1: 1 fail** (`soc-p2`, flaky) · **Lần 2: 105/105 file, 699/699 test** |
| G3 | `check-multi-agent.mjs` | **exit 0**, 0 lỗi |
| G5 | `npx tsc --noEmit` (web) | **exit 0** |
| G6 | `makemigrations --check --dry-run` | `No changes detected`, exit 0 |
| G7 | `tsc --noEmit` (mobile) | **CHƯA CHẠY** — xem mục 4 |
| S1 | `scan-secrets.mjs` | **OK**, 3619 file, 0 finding |
| S1b | `scan-secrets.mjs --self-test` | **52/52** |

### Vấn chạy không được bỏ lỡ

G2 và G2b **phải** gọi
`node --experimental-vm-modules node_modules/jest/bin/jest.js` — đúng như
`package.json` khai. Bỏ cờ đó thì `import.meta` không dùng được ⇒ `SyntaxError`,
**cả file `field-contract.test.js` lẫn `route-contract.test.js` cùng chết**
(nghĩa dương từ trước).

### Flake đã ghi nhận

`soc-p2.component.test.tsx` fail ở lần chạy vitest toàn bộ (1/699), pass khi
chạy riêng (8/8) và pass ở lần 2 (699/699). Không liên quan thay đổi này — không
file SOC nào được sửa. Không sửa để đổi định nghĩa; khớp baseline "đã 1 flake FE"
đã ghi trong `AGENTS.md:58`.

## 3. Bằng chứng fail-before / pass-after (hazard 10)

Test xanh **cả trước và sau** thì không phải bằng chứng. Mỗi gate mới đã chạy
lại trên bản cũ lấy từ `git show HEAD:<file>` — **không** dùng
`git checkout --` (hazard 11: lệnh đó xoá việc chưa commit, đã phá 2 lần).

| Gate mới | Bản cũ (`HEAD`) | Bản mới |
|---|---|---|
| `field-contract` — cấm spread | **FAIL** (`TransactionsPage.tsx:90 createTransaction`) | PASS |
| `field-contract` — tên field | **FAIL**: `field "side" khong ton tai. Cho phep: symbol, transaction_type, …` | PASS |
| `…test_no_financial_write_uses_bare_isauthenticated` | **FAIL** (`views.py:113 … ['IsAuthenticated']`) | PASS |
| `…test_financial_write_classes_declare_required_permission` | **FAIL** | PASS |
| `…test_permission_order_keeps_tenant_scope_first` | **FAIL** | PASS |
| `…test_financial_write_classes_are_scanned` | PASS cả hai — **bằng chứng** bộ lọc không hỏng | PASS |
| `test_transaction_ledger_sync.py` (v1) | **8 failed, 1 passed** | 9 passed |
| `test_transaction_ledger_sync.py::LedgerKeyDisambiguationTests` | **không tồn tại** — tái hiện B1/B2 | **6 passed** |

Cách khôi phục bản cũ (không dùng `git checkout --`):

```powershell
Copy-Item <file> "$env:TEMP\pf_p0_keep\<name>.keep"    # copy ra ngoài TRƯỚC
git show HEAD:<path> | Out-File <path> -Encoding utf8  # thay bằng bản cũ
# … chạy gate, kỳ vọng FAIL …
Copy-Item "$env:TEMP\pf_p0_keep\<name>.keep" <path>   # khôi phục
```

## 4. G7 — mobile typecheck: CHƯA CHẠY

Đã thêm `packages/mobile/tsconfig.json` (trước đó không có, nên gate này không
tồn tại).

**Giá trị đã chứng minh ngay:** nó bắt được lỗi JSX `TS17002`/`TS17008` trong
bản sửa của chính tôi, trước khi commit.

Kết quả chạy: **113 lỗi**, phân rã:

| Nhóm | Số | Nguyên nhân |
|---|---|---|
| `TS2307` / `TS7006` / `TS2875` / `TS7016` | **108** | `packages/mobile/package.json` **không khai báo dependency nào** — không có `react`, `react-native`, `@expo/vector-icons`; `node_modules` rỗng |
| `TS7053` / `TS2345` / `TS18046` | **5** | Có sẵn, không do thay đổi này: ngoài hunk `@@ -183` của `DashboardScreen.tsx`, và ở `ProfileScreen.tsx`, `TransactionsScreen.tsx`, `WatchlistScreen.tsx`, `authStore.ts` — những file **không** sửa |

**0 lỗi** ở `portfolioApi.ts`, `types/portfolio.ts`, `i18n/index.ts`.

⇒ **KHÔNG CHẠY ĐƯỢC TRỌN.** Cần `npm install` trong `packages/mobile`, mà
`AGENTS.md:23` cấm chạy khi chưa hỏi (junction `node_modules` dùng chung).

Script `typecheck` đã bị **xoá khỏi `package.json`** ở rev.2: đăng ký một gate
đỏ vĩnh viễn khiến người đọc bỏ qua nó, đúng kiểu hậu quả mà `AGENTS.md` §12 nêu
về `--no-verify`.

## 5. Blocker chặn merge — test của agent khác

### 5.1 `test_ledger_models_wave2.py:441`

```python
tx = Transaction.objects.create(...)
self.assertEqual(Transaction.objects.count(), 1)
self.assertEqual(LedgerEntry.objects.count(), 0)   # ← FAIL
```

Dòng này **đóng băng hành vi cũ**: "ghi `Transaction` thì không sinh dòng sổ
cái". Sau P0-2 thì đúng là có dòng sổ cái, nên khẳng định cũ không còn đúng.

**Không tự sửa.** `test_ledger_models_wave2.py` không có dòng claim nào trỏ
trực tiếp, nhưng nó nằm trong `packages/core/backend/src/user_workspace/tests/` —
thư mục được claim `in-progress` của `portfolio-w3-api` (`docs/CLAIMS.md:277`).

**Đề xuất cho coordinator/owner** (chưa thực hiện):

1. Đổi khẳng định `LedgerEntry.objects.count() == 0` thành khẳng định dòng sổ
   cái **khớp** giao dịch, **và**
2. đổi tên lớp `ExpandPhaseIsNonDestructiveTests` — "expand phase" đã hết ý
   nghĩa sau khi có đường ghi runtime, hoặc
3. giữ nguyên và đánh dấu `skip` kèm lý do, nếu LED-05 cutover vẫn được giữ.

### 5.2 Rủi ro đã ghi sẵn, chưa kiểm chứng

`migrations/0019:30-33` cảnh báo: DB đang ở state `0007` có sẵn row tenant-less
sẽ nổ `FieldError` tại `0008`, **trước khi** tới `0019`. Chưa kiểm chứng trên DB
có dữ liệu (đã ghi `CHƯA CHẠY` ở mục 6).

## 6. Đã sửa sau audit độc lập

| Mã | Vấn đề | Sửa |
|---|---|---|
| B1 | `startswith` trần khớp nhầm tiền tố (`'tx:59'` khớp `'tx:5'`) | `Q(external_id=ref) \| Q(external_id__startswith=f'{ref}:v')` |
| B2 | Khoá `external_id` lệch khuôn của `0022` ⇒ đếm trùng `CashFlow`, NAV sai mà `nav_reason` vẫn rỗng | Dùng đúng `0022:105` |
| B3 | `@atomic` ngoài `try` ⇒ biến lỗi sổ cái thành mất giao dịch | `atomic` **trong** `try` (savepoint) |
| B4 | `portfolio_write` khoá cả `GET` ⇒ `viewer` mất quyền đọc danh mục | `WorkspacePermission.SAFE_METHODS` |
| M2 | `max_length=64` vs cột DB `varchar(32)` ⇒ HTTP 500 | đặt 32 |
| M3 | `validate()` chặn PATCH không liên quan | chỉ kiểm khi `opening_balance` có trong `attrs` |
| M8 | `unwrapList` bỏ qua `{data:[...]}` của holdings/technicals | thêm nhánh |
| M10/M11 | `mountedRef` không chặn được response cũ | `requestIdRef` |
| M9 | Gate mobile đỏ vĩnh viễn | Xoá script |
| m1 | 31 byte mojibake trong `permissions.py` do `edit` làm hỏng | Viết lại UTF-8 |

**B5 — phát hiện SAI, đã loại.** Auditor bảo gate "không bao giờ chạy được"
(`SyntaxError: Cannot use 'import.meta' outside a module`). Tự kiểm chứng: chạy
đúng lệnh của repo (`npm test` = `node --experimental-vm-modules …`) cho
**4 passed**. Không có cờ thì mới lỗi — mà `route-contract.test.js` cũng vậy
(nghĩa dương từ trước). Đã ghi rõ yêu cầu cờ để không ai chạy nhầm.

## 7. Những gì CHƯA CHẠY

| Hạng mục | Lý do |
|---|---|
| 25 file test `user_workspace` còn lại (≈7.500 LOC) | Đã chạy 8 suite liên quan trực tiếp; toàn bộ mất ~25 phút |
| Migration trên DB **có dữ liệu** | `pf_p0_verify` là DB rỗng; `0019:30-33` cảnh báo state `0007` |
| `vitest` e2e / playwright | Chưa chạy |
| Mobile runtime / e2e | `packages/mobile` không có dependency |
| `pwsh -File scripts/agent-sync.ps1` | Chưa chạy |
| `node scripts/pre-push-gate.mjs` | Chưa chạy |
| jest ngoài `src/adapters/core` | Chỉ chạy `src/adapters/core` + toàn bộ `vitest` |
| Race `_next_version` (2 PATCH đồng thời) | Cần `TransactionTestCase` + thread thật; `TestCase` bọc transaction nên thread 2 không thấy row chưa commit. **Bán kính nổ** đã chứng minh bằng `IntegrityError`; bản thân cuộc đua chỉ kết luận từ đọc code |