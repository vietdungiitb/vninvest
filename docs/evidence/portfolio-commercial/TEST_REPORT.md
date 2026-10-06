# TEST REPORT — 7 P0 PORTFOLIO

| | |
|---|---|
| **Nhánh** | `feat/portfolio-p0-20261005` (base `dev` @ `d85e260d5`) |
| **Claim** | `docs/CLAIMS.md` — `opencode-portfolio-p0`, `opencode-portfolio-p0-b` |
| **Hạ tầng** | Postgres `127.0.0.1:5433` · Redis `127.0.0.1:6380` · DB test `pf_p0_verify` |
| **Bằng chứng đầy đủ** | `docs/evidence/portfolio-commercial/portfolio-p0-gates.md` |

> **Quy tắc trung thực.** Gate không chạy được là `CHƯA CHẠY`, không phải `Pass`.
> `CHƯA CHẠY` là kết quả hợp lệ và có ích.

## 1. Backend

| Gate | Lệnh | Kết quả |
|---|---|---|
| Regression 8 suite | `pytest` (xem mục 0 môi trường) | **Fail** — 1 fail |
| Capability + RBAC | `pytest user_workspace/tests/test_capability_matrix.py` | **Pass** — 45 passed |
| Đồng bộ ledger | `pytest user_workspace/tests/test_transaction_ledger_sync.py` | **Pass** — 16 passed |
| NAV wiring + holdings | `pytest user_workspace/test_ledger_holdings.py` | **Pass** — 29 passed |
| Order safety (561 LOC) | `pytest user_workspace/test_order_safety.py` | **Pass** |
| Migration parity | `manage.py makemigrations --check --dry-run` | **Pass** — `No changes detected`, exit 0 |
| Migration apply | `manage.py migrate` (DB rỗng) | **Pass** — tới `0023_append_only_guards` |
| Migration trên DB **có dữ liệu** | — | **CHƯA CHẠY** — `pf_p0_verify` rỗng |
| 25 file test còn lại | — | **CHƯA CHẠY** — xem mục 4 |

### Fail duy nhất — không phải của phiên này

`tests/test_ledger_models_wave2.py:441`
(`ExpandPhaseIsNonDestructiveTests::test_transaction_table_still_writable`)

```
E  AssertionError: 1 != 0
```

Khẳng định `LedgerEntry.objects.count() == 0` sau khi ghi `Transaction` — tức
**đóng băng hành vi cũ** mà P0-2 xoá bỏ. Không tự sửa: thư mục
`user_workspace/tests/` đang được claim `in-progress` bởi `portfolio-w3-api`
(`docs/CLAIMS.md:277`). Chi tiết và đề xuất: bằng chứng gate mục 5.1.

## 2. Frontend web

| Gate | Lệnh | Kết quả |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **Pass** — exit 0 |
| Adapter contract | `npm test -- src/adapters/core` | **Pass** — 195 passed, 8 suite |
| Component tests | `npx vitest run` | **Pass** — 105/105 file, 699/699 test (lần 2; lần 1 có 1 flake `soc-p2`) |
| Playwright e2e | `npm run test:visual` | **CHƯA CHẠY** |

⚠ Cả hai lệnh jest/vitest phải chạy đúng như `package.json` khai
(`node --experimental-vm-modules …` cho jest). Bỏ cờ đó ⇒ mọi suite dùng
`import.meta` chết, kể cả suite có sẵn.

## 3. Mobile

| Gate | Lệnh | Kết quả |
|---|---|---|
| Typecheck | `packages/web/node_modules/.bin/tsc --noEmit` (mobile) | **CHƯA CHẠY** — 113 lỗi, 108 do thiếu `react`/`react-native`; **0 lỗi ở 3 file đã sửa** |
| Config gate | `npm run check:mobile` | **CHƯA CHẠY** |
| Navigation gate | `npm run check:mobile-navigation` | **CHƯA CHẠY** |
| Runtime / e2e | — | **CHƯA CHẠY** — không có dependency |

## 4. Quy trình / bảo mật

| Gate | Lệnh | Kết quả |
|---|---|---|
| Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **Pass** — exit 0, 0 lỗi, 63 cảnh báo |
| Quét bí mật | `node packages/web/scripts/scan-secrets.mjs` | **Pass** — 3619 file, 0 finding |
| Self-test quét bí mật | `… --self-test` | **Pass** — 52/52 |
| Sync + gate | `pwsh -File scripts/agent-sync.ps1` | **CHƯA CHẠY** |
| Pre-push gate | `node scripts/pre-push-gate.mjs` | **CHƯA CHẠY** |

## 5. Tổng kết

| Hạng mục | Pass | Fail | CHƯA CHẠY |
|---|---|---|---|
| Backend | 4 | 1 (không thuộc phiên này) | 2 |
| Web | 3 | 0 | 1 |
| Mobile | 0 | 0 | 4 |
| Quy trình | 3 | 0 | 2 |

**Không có mục nào được báo `Pass` mà chưa chạy.**

Mọi khẳng định `Pass` ở trên đều kèm số liệu đo được và lệnh tái lập. Chi tiết
phân rã flake, bằng chứng fail-before/pass-after, và danh sách `CHƯA CHẠY` ở
`docs/evidence/portfolio-commercial/portfolio-p0-gates.md`.