# Gates S2 — Index constituents EP-6 (bằng chứng chạy thật trên VPS staging)

> Ngày: 2026-11-13 · Branch: `feat/constituents-s2` · Worktree fail `/tmp/wt-idx-fail` @ `origin/dev`, fix `/tmp/wt-idx-fix` @ branch tip · DB: `idx_fail` / `idx_fix` (đã DROP sau chạy)

## 1. FAIL-BEFORE — endpoint chưa tồn tại

`manage.py test market_data.tests.test_index_constituents` trên code chưa sửa: `Ran 5 tests — FAILED (failures=5)`, cả 5 đều `404 != 200/400/403` (route chưa mount). (Trước đó 1 lỗi syntax do tool viết thiếu từ `import` — đã sửa test, không liên quan code.)

## 2. PASS-AFTER — 5/5 OK

`Ran 5 tests — OK`: shape `{code,count,symbols,note}` · code lạ 400 `INVALID_INDEX` · PAT rỗng 403 · PAT `market:read` 200 · group rỗng 200 count 0.

## 3. Hồi quy + gates

| Gate | Kết quả |
|---|---|
| `market_data` (172 tests) | OK |
| `makemigrations --check` | `No changes detected` (không model mới) |
| `spectacular` diff vs dev baseline | RỖNG → SPECTACULAR-CLEAN |
| Local: `check-multi-agent` / `check-ledger-entry` / `check-lessons` / `normalize-eol` / `scan-secrets` | chạy ở bước đóng slice |
