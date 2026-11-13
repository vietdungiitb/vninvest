# Gates Dot3 — bằng chứng chạy thật trên VPS staging (§12.3)

> Ngày: 2026-11-13 · Slice: `dot3-remaining-20261113` · Nơi chạy: `root@14.225.255.47`
> Worktree fail: `/tmp/wt-dot3-fail` @ `origin/dev` (`02a8891ce`) + test mới từ branch
> Worktree fix: `/tmp/wt-dot3-fix` @ branch tip · DB tạm: `dot3_fail` / `dot3_fix` (đã DROP sau chạy)

## 1. FAIL-BEFORE (code chưa sửa, test mới) — 6 đỏ / 2 xanh, đúng lý do nghiệp vụ

Lệnh: `manage.py test tests.test_dot3_remaining` trên `/tmp/wt-dot3-fail`, DB `dot3_fail`.

```
Ran 8 tests — FAILED (failures=6)
FAIL test_b4_financials_records_typed — AssertionError: {'roe','eps','symbol'} vs {period,year,quarter,report_date,items}
FAIL test_b4_period_invalid_400 — 200 != 400
FAIL test_b4_period_year_empty_400 — 200 != 400
FAIL test_b6_advisory_pat_without_scope_403 — 201 != 403 (unscoped PAT tạo advisory!)
FAIL test_b6_market_pat_without_scope_403 — 200 != 403
FAIL test_b6_signal_pat_without_scope_403 — 200 != 403
ok: test_b6_market_pat_with_scope_200, test_b6_human_session_unaffected (2 xanh giữ nguyên)
```

## 2. PASS-AFTER (code đã sửa) — 8/8 OK, rồi 9/9 sau bổ sung M1

- `@24587c0c3`: `Ran 8 tests — OK` (0.3s). Lỗi giữa chừng `NameError serializers` → fix import (`b5cd690cf`) → re-run **8/8 OK**.
- Sau guard `market_data/views.py` + test thứ 9 (B8-M1, commit `e6701a6f9`): `Ran 176 tests — OK` (9 dot3 + 167 market_data, 7.9s).

## 3. Hồi quy scope ảnh hưởng (DB `dot3_fix`)

| Suite | Kết quả |
|---|---|
| `market_serving market_data` | `Ran 203 tests — OK` (18.7s) |
| `signal_intelligence advisory` | `Ran 77 tests — FAILED (errors=1)`: `test_delete_cleans_up` → `UndefinedTable commercial_licensekey` |
| Đối chứng trên `origin/dev` (worktree fail, DB `dot3_fail`) | `Ran 3 tests — FAILED (errors=1)` — **cùng 1 lỗi → pre-existing**, không phải hồi quy |
| Sau migration 0008: `test_dot3_remaining` + `test_seed_alertcenter_demo` | `Ran 11 tests — OK` (0008 đồng thời sửa luôn lỗi pre-existing) |
| `makemigrations --check --dry-run` | `No changes detected` |
| `spectacular --file` (fix) vs (dev) | fix: `Warnings 124 (122 unique) / Errors 56 (14 unique)` == dev: `124 / 56` → **0 hồi quy**; grep `financial` trong lỗi → 0 hit |

## 4. Gates local (máy dev, 2026-11-13)

| Gate | Exit | Kết quả |
|---|---|---|
| `check-multi-agent` | 0 | 0 lỗi, 0 trùng migration (166 warning noise cũ) |
| `check-ledger-entry` | 0 | 91 header / 90 distinct / max 478, next 479 |
| `check-lessons` | 0 | 14 file, 59/60 |
| `normalize-eol` | 0 | OK |
| `scan-secrets` | 0 | 4679 tracked, 4494 scanned → OK |

## 5. CHƯA CHẠY (trung thực, không suy diễn)

- Full BE suite + full FE suite VPS (chỉ chạy scope ảnh hưởng + guard theo plan; 0 file FE bị chạm).
- `tsc --noEmit` / `eslint` / `npm run build` (0 file FE trong diff).
- E2E trình duyệt, visual baseline.
- Deploy staging D6 (`/opt/vninvest` không phải nhiệm vụ slice này).
- Verify token 401 (không có token trong tay).
- `ruff` trên file đổi (không có toolchain local; thay bằng `manage.py check` + test import trên VPS — `System check identified no issues`).
