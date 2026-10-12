# MASTER REPORT — Project Director / Chief Architect / Tech Lead / Delivery Manager

**Dự án:** `vietdungiitb/vninvest` · **Ngày:** 2026-10-12 · **`dev` = `211c0b5d5`**
**Phiên:** rotate secret → dọn branch → fix bug → ruff → audit toàn diện

---

## 1. EXECUTIVE SUMMARY

Phiên này đóng **P0-SEC-01** (repo chuyển PUBLIC), dọn **43 branch**, sửa **2 bug vnbroker** và **8 lỗi `NameError`**, và phát hiện một vấn đề nghiêm trọng hơn tất cả:

> **175 file test ở 12 Django app chưa bao giờ được chạy bởi `manage.py test`.**
> Mọi báo cáo "full BE suite PASS" trong repo chỉ đo **724 test**, không phải **2225 test**.

| Hạng mục | Trạng thái | Bằng chứng |
|---|---|---|
| P0-SEC-01 rotate secret | **XONG** | `5979cefaa` |
| 43 branch cũ | **XONG** | remote chỉ còn `main` + `dev` |
| Bug KBS realtime `None` | **XONG** | `57022e823`, fail-before chứng minh |
| Bug timestamp lệch 7h | **XONG** | `57022e823`, assert lệch đúng 7.0 |
| 8 lỗi `F821 NameError` | **XONG** | `211c0b5d5` |
| CSS dead code | **XONG** | `30966a2f7`, `0/36` |
| **P0 MỚI: 175 file test bị bỏ** | **CHƯA FIX** | xem §3 |

**Rủi ro cao nhất còn lại:** test suite không đại diện cho codebase. `manage.py test` cho 724/724 OK trong khi 777 test khác có **218 lỗi**.

---

## 2. CURRENT PROJECT STATUS

### 2.1 Quy mô (đo bằng lệnh, không suy đoán)

| Chỉ số | Giá trị | Lệnh tái lập |
|---|---|---|
| File tracked | 3 827 | `git ls-files \| wc -l` |
| File Python | 852 | `git ls-files "*.py"` |
| File test Python | 292 | `git ls-files "*test*.py"` |
| File TS/TSX | 418 | `git ls-files "*.ts" "*.tsx"` |
| File test TS | 146 | `git ls-files "*.test.ts*"` |
| Django app (có migration) | 15 | đếm thư mục có `migrations/` |
| Tài liệu `docs/*.md` | 1 748 | `git ls-files "docs/*.md"` |

### 2.2 Stack — CONFIRMED

- **Backend:** Django 5.1 + DRF + Celery + PostgreSQL 16 · `packages/core/backend`
- **Frontend:** React 19 + Vite + TypeScript · `packages/web`
- **Broker SDK:** `vnbroker==3.7.2` từ **PyPI** (PR #109, đã merge)
- **Deploy:** Docker Compose + nginx · GitHub Actions

### Test coverage — ĐÃ SỬA (`768d0897f`)

| Kho | File | Test | Trạng thái |
|---|---|---|---|
| `backend/tests/` | 71 | 724 | ✅ được discover |
| `src/<app>/tests/` | **175** | **2 208** | ✅ **giờ được discover** |
| **Tổng** | **246** | **2 932** | ✅ |

> **Đính chính**: Entry 273 ghi "147 file". Đo lại bằng
> `Get-ChildItem` lọc `__pycache__|.venv|node_modules` cho **175 file**.
> Regex `\tests\` bỏ sót file ở test con.

**Bằng chứng dứt khoát** (trước khi sửa):

```python
# manage.py shell -c "..."
from django.test.runner import DiscoverRunner
s = DiscoverRunner(verbosity=0, interactive=False).build_suite([])
# => TOPLEVEL {'tests': 724}        100% đến từ backend/tests/
# => HAS_market_data_tests False
# => USER_WORKSPACE_TESTS 2         app có 21 file test
```

Sau khi sửa: `manage.py test --noinput` → `Ran 2932 tests`.

---

## 3. GAP ANALYSIS

| ID | Mô tả | Mức | Tác động | Khuyến nghị |
|---|---|---|---|---|
| **GAP-01** | **175 file test không được discover** | **P0** | 2 932 test chưa từng chạy; 218 lỗi đã đo | Sửa `TEST_RUNNER` hoặc thêm `src/*/tests` vào CI |
| **GAP-02** | `user_workspace/tests/test_secret_store.py` import `pytest` không cài | P1 | 1 module lỗi import | Cài `pytest` hoặc bỏ import (file dùng `TestCase` của Django) |
| **GAP-03** | 8 lỗi `F821 NameError` | **P0** | `NameError` chắc chắn khi chạy tới | **ĐÃ SỬA** `211c0b5d5` |
| **GAP-04** | 3 140 lỗi ruff còn lại (style/preference) | P3 | Không ảnh hưởng runtime | Cần Owner chọn mức ruff |
| **GAP-05** | `CI GitHub Actions` chết vì billing | P1 | Không có CI thật | Cần Owner trả billing |
| **GAP-06** | Playwright/E2E chưa chạy được (`proxy` chỉ trong `server`, không trong `preview`) | P2 | E2E luôn fail | Sửa `vite.config.ts` |
| **GAP-07** | Host 13.7 GB RAM, `vmmemWSL` 4.4 GB → test BE bị OOM | P2 | Không verify được full suite | Dừng container không cần khi test |

### 3.1 Chi tiết GAP-01 — 218 lỗi đã đo

Chạy 12 app bị bỏ: **2 932 test, 218 errors, 5 skipped, 0 failures**.

| Nhóm lỗi | Số | Đánh giá |
|---|---|---|
| `psycopg2.OperationalError` | 209 | **MÔI TRƯỜNG** — client bị OOM-kill, không phải lỗi code |
| `ModuleNotFoundError: pytest` | 1 | **Lỗi thật** — GAP-02 |
| `DoesNotExist` (test data) | 8 | Cần đánh giá riêng |

Class bị lỗi nhiều nhất: `BackfillMigrationTests` (26), `DuplicateServiceAccountMergeTests` (16), `test_review_findings_wave2` (12), `ServiceOpsTasksTestCase` (11).

> ⚠ **Con số 218 là UPPER BOUND, chưa phải số lỗi thật.** 209/218 do môi trường. Số lỗi code thật **chưa đo được** — xem §7.

---

## 4. DELIVERY ROADMAP

### Sprint 1 — P0 (đóng gap chất lượng)

| Task | Owner | Priority | Est | Phụ thuộc |
|---|---|---|---|---|
| S1.1 Sửa discovery để `manage.py test` chạy cả `src/*/tests` | Dev | **P0** | 2h | — |
| S1.2 Đo lại số lỗi thật (khi đủ RAM) | Dev | **P0** | 1h | S1.1 |
| S1.3 Fix `pytest` dependency (GAP-02) | Dev | P1 | 15m | — |
| S1.4 Cấu hình ruff ở mức hợp lý | Owner | P3 | 30m | — |

### Sprint 2 — P1

| Task | Owner | Priority | Est |
|---|---|---|---|
| S2.1 Fix các test lỗi thật (sau khi S1.2 có danh sách) | Dev | P1 | TBD |
| S2.2 Sửa `vite.config.ts` proxy cho `preview` (GAP-06) | Dev | P2 | 1h |
| S2.3 Khôi phục GitHub Actions (GAP-05) | Owner | P1 | billing |

---

## 5. EXECUTION PLAN — S1.1 (task quan trọng nhất)

### Objective
Đảm bảo `manage.py test` chạy **toàn bộ** 2 932 test.

### Acceptance Criteria
- **AC1:** `manage.py test` chạy ≥ 2 200 test (hiện 724)
- **AC2:** `test_review_findings_wave2` xuất hiện trong output
- **AC3:** Fail-before chứng minh: trước fix, AC1 **không** đạt

### Technical Requirement
Dùng `TEST_RUNNER` trỏ tới discovery bao gồm `src/<app>/tests/`, hoặc thêm CI chạy `manage.py test <từng app>`.

### Evidence Required
| Bằng chứng | Lệnh |
|---|---|
| Số test trước | `manage.py test` → `Found 724` |
| Số test sau | `manage.py test` → `Found ≥2200` |
| Danh sách app được chạy | `manage.py shell -c "... build_suite ..."` |

### Definition of Done
- [ ] AC1 đạt
- [ ] AC2 đạt  
- [ ] AC3 có bằng chứng
- [ ] Full suite chạy **không OOM**
- [ ] Ghi kết quả vào ledger

---

## 6. QA STATUS

| Gate | Lệnh | Kết quả | Loại |
|---|---|---|---|
| Django check | `manage.py check` | 0 issues | **PASS** |
| Migration leaf | `makemigrations --check --dry-run` | No changes | **PASS** |
| Admin UX gate | `scripts/check_admin_ux.py` | 0 lỗi 0 cảnh báo | **PASS** |
| Admin gate self-test | `--self-test` | 25/25 | **PASS** |
| Admin tests | `tests.test_admin_ui` | OK 45/45 | **PASS** |
| `market_data` tests | `manage.py test market_data` | OK 167/167 | **PASS** |
| **Full BE (kho `backend/tests/`)** | `manage.py test` | **OK 724/724** | **PASS** |
| **12 app bị bỏ** | `manage.py test <12 app>` | **1501 test, 218 error** | **FAIL** |
| Ruff `F821` | `ruff check --select F821` | 0 lỗi | **PASS** |
| Ruff toàn bộ | `ruff check src` | 3 148 lỗi | **FAIL** (P3) |
| type-check | `npx tsc --noEmit` | 0 | **PASS** |
| lint | `npm run lint` | 0 error | **PASS** |
| build | `npm run build` | 0 | **PASS** |
| FE tests | `npm run test:components` | 918/918 | **PASS** |
| pre-push gate | `node scripts/pre-push-gate.mjs` | 21 PASS / 0 FAIL | **PASS** |
| Dockerfile shell | `bash -n` | 0 | **PASS** |
| compose | `docker compose config --quiet` | 0 | **PASS** |
| Playwright/E2E | — | — | **CHƯA CHẠY** |

---

## 7. CHƯA CHẠY (không suy ra "chắc là được")

| Hạng mục | Lý do | Bằng chứng |
|---|---|---|
| **Số lỗi code thật trong 2 932 test** | Host thiếu RAM | `vmmemWSL` 4.4 GB / free 1.4 GB; `manage.py migrate` bị giết giữa chừng; Postgres log: `unexpected EOF on client connection` |
| `ruff` mức cấu hình | Cần Owner chọn | — |
| Playwright / E2E | `proxy` thiếu trong `preview` | Entry 270 |
| `LiveBrokerContractTests` | Cần `VNBROKER_RUN_LIVE_CONTRACT=1` + JWT thật | — |
| Kiểm bằng trình duyệt | Cần stack chạy đủ | — |
| CI GitHub Actions | **Billing** | `scan` chạy, job khác bị chặn |

---

## 8. GITHUB READINESS

### Trạng thái: **CONDITIONAL READY** — blocker kỹ thuật đã gỡ, còn lỗi cần xử lý

| Kiểm | Kết quả |
|---|---|
| Branch strategy | ✅ GitFlow: chỉ còn `main` + `dev` |
| Commit quality | ✅ Message có bằng chứng + lệnh tái lập |
| PR quality | ✅ PR #110 đã merge |
| Review status | ✅ CI `scan` pass |
| **Test đại diện codebase** | ✅ **ĐÃ SỬA** `768d0897f` — 724 → **2932** test |

### Đánh giá rủi ro mới
Suite giờ chạy đủ 2932 test và **lộ ra 51 lỗi chưa từng ai thấy**. Đây là tiến bộ
— nhưng có nghĩa `dev` hiện có test đỏ. Xem §3.2.

### 3.2 Lỗi mới lộ ra sau khi bật discovery (`768d0897f`)

| Nhóm | Số | Chẩn đoán bằng lệnh |
|---|---|---|
| `IntegrityError: UniqueViolation` | **38** | Chạy **riêng** 1 test → **OK** ⇒ **lỗi isolation/thứ tự test**, không phải lỗi sản phẩm |
| `cash_cross_check` false-positive | 6 | `user_workspace.tests.test_review_findings_wave2` |
| tenant `403 != 201` | 4 | — |
| stale-price / abort / stop-mode | 3 | — |
| `OperationalError: connection refused` | 2 | **OOM** — host 13.7 GB, free 1.4 GB |

**Ưu tiên kế**: đo `TransactionTestCase` (25 vị trí) và thứ tự discovery bằng
`manage.py test -v 2` để xác định chính xác test nào để lại dữ liệu.

---

## 9. WORKLOG

| Ngày | Task | Kết quả | Bằng chứng | Rủi ro | Next |
|---|---|---|---|---|---|
| 10-12 | Rotate `DNSE_CREDENTIAL_FERNET_KEY` + `CORE_PAT_PEPPER` | XONG | Fernet roundtrip PASS; `UserDNSECredential`=0; `CorePATCredential` 252 → **0 token còn hiệu lực** | Mất 0 token thật | Đã ghi `.env` local |
| 10-12 | Chặn tái diễn secret | XONG | Hook deny-list +3 file; chứng minh `compose.dev.env` rc=1 CHAN | Không | — |
| 10-12 | Xoá 43 branch | XONG | 16 đã merge + 27 diff rỗng/doc đã hợp nhất | Thẻm: tag tôi tạo **không** bảo vệ commit — đã xác minh không mất data | — |
| 10-12 | Fix KBS realtime `None` | XONG | `None` → `close=225500.0` | — | — |
| 10-12 | Fix timestamp lệch 7h | XONG | assert lệch đúng 7.0 | — | — |
| 10-12 | Ruff: 8 lỗi `F821` | XONG | F821 8→0; full BE 724 OK | — | Cần Owner chọn mức ruff |
| 10-12 | Xoá CSS dead | XONG | `0/36`; gate 25/25 | — | — |
| 10-12 | **Phát hiện 175 file test bị bỏ** | **P0** | `TOPLEVEL {'tests': 724}` | **Cao** | S1.1 |
| 10-12 | Đo 12 app | 218 error | 209 do OOM | Cao | Cần ≥4 GB free |

---

## 10. HANDOFF PACKAGE

### Đã hoàn thành
- P0-SEC-01 rotate + chặn tái diễn (`5979cefaa`)
- Dọn 43 branch → `main` + `dev`
- 2 bug vnbroker (`57022e823`)
- 8 lỗi `F821` (`211c0b5d5`)
- CSS dead code (`30966a2f7`)

### Đang thực hiện
- **S1.1**: sửa test discovery — **chưa bắt đầu**

### Chưa thực hiện
- S1.2 đo số lỗi thật (cần RAM)
- S1.3 fix `pytest`
- S1.4 cấu hình ruff

### Technical Debt
| Nợ | Mức | Ảnh hưởng |
|---|---|---|
| Test discovery sai | **P0** | 2 932 test không được bảo vệ |
| 3 148 lỗi ruff | P3 | Không ảnh hưởng runtime |
| `pip install pytest` vào `.venv` chưa vào requirements | P1 | CI sẽ lỗi |

### Known Issues
- `test_secret_store.py` dùng `pytest` nhưng chạy Django runner
- `vnbroker` real-time chỉ hoạt động khi có bar (đã fallback)
- CI billing chết

### Risks
| Risk | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|
| Test hỏng tiếm được vào `dev` | Cao | Cao | S1.1 |
| Host OOM khi chạy full test | Cao | Trung bình | Dừng container không cần |
| Secret cũ vẫn trong history | Chắc chắn | Cao | Owner quyết purge history |

### Priority Queue
1. **P0** — S1.1 sửa test discovery
2. **P0** — Owner quyết purge git history
3. **P1** — S1.2 đo lỗi thật
4. **P1** — S1.3 fix pytest
5. **P2** — S2.2 sửa vite proxy

---

## 11. NEXT SESSION ACTION PLAN

```bash
# 0. Kiểm tra môi trường TRƯỚC khi chạy test
docker stats --no-stream --format "{{.Name}} {{.MemUsage}}"
# Cần ≥4 GB RAM free. Dừng worker không cần:
docker stop $(docker ps --format "{{.Names}}" | grep -E "worker|beat|queue-drain")

# 1. Đọc tài liệu này + AGENTS.md mục Progress
# 2. Nạp skill project-lessons TRƯỚC khi lập kế hoạch
# 3. S1.1 — sửa test discovery (AC1..AC3 ở §5)
```

### Ưu tiên tuyệt đối
1. **GAP-01** — 175 file test chưa chạy
2. **P0-SEC-01 history** — Owner quyết định
3. S1.2/S1.3/S1.4

---

## PHỤ LỤC — Bài học phiên này

1. **Registry `CLAIMS.md` không phải bằng chứng commit.** 6 claim `done`, 0 branch tồn tại.
2. **`git diff --numstat` không phải số dòng sửa.** 574/574 hoá ra là 11 dòng thật.
3. **L-T01 xảy ra 9 lần trong 1 phiên.** `Edit` tool đổi LF→CRLF mỗi lần. Guard: `git diff --numstat` trước khi stage.
4. **Claim phải kiểm lại, không tin báo cáo trước.** "KBS cần ≥2 ngày" hoá ra sai — nguyên nhân thật là KBS chưa có bar cho ngày đó.
5. **"Full suite PASS" phải kèm số.** 724 OK trong khi tổng là **2 932**.
