# GATE EVIDENCE — 6 P0 PORTFOLIO (2026-10-05)

| | |
|---|---|
| **Nhánh** | `feat/portfolio-p0-20261005` (base `dev` @ `d85e260d5`) |
| **Claim** | `docs/CLAIMS.md` — `opencode-portfolio-p0`, `opencode-portfolio-p0-b` |
| **DB test** | `pf_p0_verify` trên `127.0.0.1:5433` (Postgres, tạo mới, **rỗng**) |
| **Redis** | `127.0.0.1:6380` |

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
| G1 | pytest capability + ledger models | **58 passed**, 3 skipped |
| G1b | pytest `test_transaction_ledger_sync.py` (mới) | **9 passed** |
| G1c | pytest regression (`test_order_safety.py` 561 LOC) | gộp trong G1 — xanh |
| G2 | `jest src/adapters/core` | **195 passed**, 8 suite |
| G2b | `vitest run` (component) | **699 passed**, 105 file |
| G3 | `check-multi-agent.mjs` | **exit 0**, 0 lỗi |
| G5 | `tsc --noEmit` (web) | **exit 0** |
| G6 | `makemigrations --check --dry-run` | `No changes detected`, exit 0 |
| G7 | `tsc --noEmit` (mobile) | **CHƯA CHẠY** — xem mục 4 |

## 3. Bằng chứng fail-before / pass-after (hazard 10)

Test xanh **cả trước và sau** thì không phải bằng chứng. Mỗi gate mới đã được
chạy lại trên bản cũ lấy từ `git show HEAD:<file>` — **không** dùng
`git checkout --` (hazard 11: lệnh đó xoá việc chưa commit, đã phá 2 lần).

| Gate mới | Bản cũ (`HEAD`) | Bản mới |
|---|---|---|
| `field-contract.test.js` — cấm spread | **FAIL** (`TransactionsPage.tsx:90 createTransaction`) | PASS |
| `field-contract.test.js` — tên field | **FAIL**: `field "side" khong ton tai. Cho phep: symbol, transaction_type, …` | PASS |
| `NoBarePermissionOnFinancialWritesTests` — `test_no_financial_write_uses_bare_isauthenticated` | **FAIL** (`views.py:113 PortfolioListCreateView … ['IsAuthenticated']`) | PASS |
| `…::test_financial_write_classes_declare_required_permission` | **FAIL** | PASS |
| `…::test_permission_order_keeps_tenant_scope_first` | **FAIL** | PASS |
| `…::test_financial_write_classes_are_scanned` | PASS cả hai — đây là **bằng chứng** bộ lọc không hỏng | PASS |
| `test_transaction_ledger_sync.py` | **8 failed, 1 passed** | **9 passed** |

Cách khôi phục bản cũ (không dùng `git checkout --`):

```powershell
Copy-Item <file> "$env:TEMP\pf_p0_keep\<name>.keep"   # copy ra ngoài TRƯỚC
git show HEAD:<path> | Out-File <path> -Encoding utf8 # thay bang ban cu
# … chay gate, ky vong FAIL …
Copy-Item "$env:TEMP\pf_p0_keep\<name>.keep" <path>  # khoi phuc
```

## 4. G7 — mobile typecheck: CHƯA CHẠY

Đã thêm `packages/mobile/tsconfig.json` + script `typecheck` (trước đó không
có, nên gate này không tồn tại).

**Giá trị đã chứng minh ngay:** nó bắt được lỗi JSX `TS17002`/`TS17008` trong
bản sửa của chính tôi, trước khi commit.

Kết quả chạy: **113 lỗi**, phân rã bằng lệnh:

| Nhóm | Số | Nguyên nhân |
|---|---|---|
| `TS2307` / `TS7006` / `TS2875` / `TS7016` | **108** | `packages/mobile/package.json` **không khai báo dependency nào** — không có `react`, `react-native`, `@expo/vector-icons`. `node_modules` rỗng. |
| `TS7053` / `TS2345` / `TS18046` | **5** | Có sẵn, không do thay đổi này: nằm ngoài hunk `@@ -183` của `DashboardScreen.tsx`, và ở `ProfileScreen.tsx`, `TransactionsScreen.tsx`, `WatchlistScreen.tsx`, `authStore.ts` — những file **không** được sửa. |

**0 lỗi** ở `portfolioApi.ts`, `types/portfolio.ts`, `i18n/index.ts`.

⇒ **KHÔNG CHẠY ĐƯỢC TRỌN.** Cần `npm install` trong `packages/mobile`, mà
`AGENTS.md:23` cấm chạy khi chưa hỏi (junction `node_modules` dùng chung).

## 5. Blocker chặn merge — test của agent khác

`test_ledger_models_wave2.py:441` (`ExpandPhaseIsNonDestructiveTests::
test_transaction_table_still_writable`):

```python
tx = Transaction.objects.create(...)
self.assertEqual(Transaction.objects.count(), 1)
self.assertEqual(LedgerEntry.objects.count(), 0)   # ← fail
```

Dòng này **đóng băng hành vi cũ**: "ghi `Transaction` thì không sinh dòng sổ
cái". Sau P0-2 thì đúng là có dòng sổ cái, nên khẳng định cũ không còn đúng.

**Không tự sửa.** File nằm trong `packages/core/backend/src/user_workspace/tests/`,
được claim `in-progress` bởi `portfolio-w3-api` (`docs/CLAIMS.md:277`). Theo
`AGENT_PROTOCOL.md` tôi không được sửa file agent khác đang giữ.

**Đề xuất cho coordinator/owner** (chưa thực hiện):

1. Khẳng định `LedgerEntry.objects.count() == 0` phải đổi thành khẳng định
   dòng sổ cái **khớp** giao dịch, và
2. bỏ tên lớp `ExpandPhaseIsNonDestructiveTests` vì "expand phase" đã hết ý
   nghĩa sau khi có đường ghi runtime, hoặc
3. giữ nguyên và đánh dấu `skip` kèm lý do, nếu LED-05 cutover vẫn được giữ.

Kết quả regression đầy đủ: **1 failed, 152 passed, 3 skipped** — `1 failed`
chính là dòng trên.

## 6. Những gì CHƯA CHẠY

| Hạng mục | Lý do |
|---|---|
| 33 file test `user_workspace` còn lại (≈7.500 LOC) | Chạy 6 suite liên quan trực tiếp; chưa chạy toàn bộ. Thời gian ~8,5 phút/6 suite |
| Migration trên DB **có dữ liệu** | `pf_p0_verify` là DB rỗng. `migrations/0019:30-33` cảnh báo state `0007` nổ `FieldError` tại `0008` |
| `test_web2e` / playwright | Chưa chạy |
| Mobile runtime / e2e | `packages/mobile` không có dependency |
| `pwsh -File scripts/agent-sync.ps1` | Chưa chạy |
| `node scripts/pre-push-gate.mjs` | Chưa chạy |
| Toàn bộ repo FE (jest ngoài `src/adapters/core`) | Chỉ chạy `src/adapters/core` + `vitest` |