# Gates — AI Advisory UI Refactor (2026-09-26)

Tất cả lệnh chạy trên host (`packages/core/backend/.venv`), không dùng container image cũ.
Frontend chạy trong `packages/web`.

## Backend

| Lệnh | Kết quả |
|---|---|
| `.venv\Scripts\python.exe manage.py check` | `System check identified no issues (0 silenced)` — exit 0 |
| `.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` | `No changes detected` — exit 0 |
| `.venv\Scripts\python.exe manage.py test tests.test_advisory_signal_norm tests.test_advisory_sanitize tests.test_advisory_orchestrator_contract tests.test_advisory_model_validation tests.test_advisory_api_contract tests.test_advisory_race tests.test_advisory_backtest tests.test_advisory_status tests.test_advisory_api_routes tests.test_advisory_budget tests.test_advisory_tasks tests.test_advisory_ssot tests.test_ai_cc_config_isolation` | **`Ran 130 tests` — OK (skipped=2)** |

2 test skip là `test_index_exists_in_db` và `test_unique_index_rejects_duplicate_session`: chúng
kiểm tra unique index ở tầng DB nên chỉ chạy được trên PostgreSQL, còn host test dùng SQLite.
**Đã verify index thật trên Postgres** — xem `bundle.md`.

### Test mới của W0

| File | Nội dung | Số test |
|---|---|---|
| `tests/test_advisory_signal_norm.py` | 14 case bằng chứng (regression) + 6 case biên + confidence + side mapping | 14 |
| `tests/test_advisory_orchestrator_contract.py` | `_build_structured_output` đủ key, `_coerce_float`, error code map, retry policy | 26 |
| `tests/test_advisory_model_validation.py` | provider↔model matrix, gồm case đã hỏng production | 17 |
| `tests/test_advisory_api_contract.py` | 18 field của contract, symbol stats thật, list view thật, isolation | 19 |
| `tests/test_advisory_sanitize.py` | đệ quy vào `list` (R0.7) | 7 |
| `tests/test_advisory_race.py` | guard trùng + unique index | 6 |

## Frontend

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 — 0 errors |
| `npm run check:shell` | exit 0 — gồm `check:tokens`, `check:contrast`, `check:admin-spa-routes`, `i18n:scan`, `check:i18n-hardcoded` |
| `npm run build` | exit 0 |
| `npx vitest run src/components/__tests__/whale-advisory src/hooks/useWhaleAdvisoryData.s15.component.test.js src/i18n --testTimeout=30000 --maxWorkers=1 --fileParallelism=false` | **`Test Files 13 passed` — `Tests 130 passed (130)`** |

### Test mới của W6

| File | Nội dung | Số test |
|---|---|---|
| `whale-advisory-panel-sidebar.component.test.tsx` | sidebar + command panel — trước đây **0 test** | 16 |
| `whale-advisory-signal-parity.component.test.ts` | bảng case **chung** với `tests/test_advisory_signal_norm.py` | 12 |
| `whale-advisory-a11y.component.test.tsx` | viết lại: thay assert đọc-chuỗi-source bằng assert DOM render thật | 12 |

## Minh chứng chạy thật trong container

Xem `e2e.md`.

---

# Vòng B1–B4 + N1–N3 (2026-09-26, sau vòng W0–W6)

Lệnh chạy từ `packages/web` trừ khi ghi rõ khác.

## Backend

| Lệnh | Kết quả |
|---|---|
| `.venv\Scripts\python.exe manage.py check` | `System check identified no issues (0 silenced)` — exit 0 |
| `.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` | `No changes detected` — exit 0 (kể cả sau migration `0011`) |
| `manage.py test tests.test_advisory_ssot tests.test_advisory_tasks tests.test_advisory_api_routes tests.test_advisory_budget tests.test_advisory_runtime_integrity tests.test_advisory_model_validation tests.test_symbol_search_ranking tests.test_market_data_api_routes --keepdb` | **`Ran 72 tests` — OK** |

### Test mới của vòng này

| File | Nội dung | Số test |
|---|---|---|
| `tests/test_advisory_runtime_integrity.py` | 3 lỗi N2: phân biệt quota vs rate-limit + `Retry-After`; metric deterministic từ DB; chống rò rỉ component cũ | 15 |
| `tests/test_symbol_search_ranking.py` | xếp hạng search: khớp chính xác lên đầu, tiền tố, tên; cursor phân trang không trùng; không `q` thì giữ thứ tự cũ | 8 |

### Ghi nhận test flaky có sẵn (KHÔNG phải do vòng này)

`src/hooks/useAlertCenterSnapshot.pagination.component.test.ts` — test
"bóc token cursor từ next URL đầy đủ của BE" fail **không ổn định** khi chạy
full suite (chạy 92 file thì có lúc xanh 545/545, có lúc đỏ 544/545). Chạy
riêng file này thì **luôn pass 3/3**.

Đã **chứng minh pre-existing bằng worktree sạch tại HEAD** (`git worktree add
--detach` + junction `node_modules`): full suite ở HEAD sạch cho ra
`Test Files 1 failed | 79 passed (80)` với **cùng một test fail** này. Không
liên quan file nào vòng này sửa (`git status` xác nhận 0 thay đổi trong
`useAlertCenterSnapshot.js`, test của nó, `core/market.js`, `coreApiAdapter.js`).

## Frontend

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 — **0 errors**, 3.578 warnings (pre-existing) |
| `npm run check:shell` | exit 0 — 0 chuỗi VI hardcode trong 19 file |
| `npm run build` | exit 0 |
| `npx vitest run --testTimeout=30000 --maxWorkers=1 --fileParallelism=false` | `Test Files 92 passed` — `Tests 545 passed` *(lần chạy sạch)*; lần có yếu tố thứ tự: 544/545 do test flaky nói trên |
| `npx playwright test tests/visual/advisory-visual-qa.spec.ts --project=chromium --workers=1` | **8 passed** |

### Bằng chứng đo lại bundle

```powershell
npm run build
node scripts/measure-route-graph.mjs WhaleAdvisoryPage
# 7 chunk / 1.998,6 KB (có echarts 623 KB)  ->  15 chunk / 1.339,8 KB (không echarts)
node scripts/measure-route-graph.mjs DashboardPage
# vẫn tải echarts 623 KB — không gãy route vẽ biểu đồ
```

Chi tiết chuỗi điều tra (vì sao `manualChunks` cũ không đủ) ở `bundle.md`.
