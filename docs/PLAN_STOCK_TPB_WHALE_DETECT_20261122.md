# PLAN — Sửa `UnboundLocalError: datetime` làm chết whale-detect từ ~06/11

- **Date**: 2026-11-22 · **Lessons áp dụng**: [L-V02, L-V04, L-B01, L-T01, L-F07]
- **Trạng thái**: B1–B7 xong. B3 r1 NEED_REVISION (OB-1 fail-before giả) → B3 r2 PASS;
  B8 r1 NEED_REVISION (OB-1 thiếu evidence) → evidence đã bổ sung, chờ B8 r2.
  S3 (merge + deploy + verify beat/backfill) CHƯA CHẠY.

## B1. Kết quả đo lường

- Worker log staging: `detect_and_store_global_whale_alerts` raised `UnboundLocalError:
  cannot access local variable 'datetime'` tại `tasks.py:101` — beat 5m gửi đều,
  task chết 100% (không fail-safe, không retry vì unexpected).
- DB staging: `WhaleAlertCanonical` max `session_date` toàn hệ thống = 2026-11-06;
  0 dòng 8 ngày gần nhất; TPB ticks vẫn chảy tới 20/11 → detection chết, không
  phải hết cá mập.
- Code: `tasks.py:3` đã `from datetime import datetime, time, timedelta`;
  `tasks.py:86` (`from datetime import datetime` trong nhánh `if session_date is not None`,
  thêm ở D05) biến `datetime` thành biến LOCAL của cả hàm → nhánh beat
  (`session_date=None`) không chạy import → dòng 101 `datetime.combine` nổ.
  Chỉ 1 chỗ shadow trong file (grep).
- Test hiện có `test_detect_historical.py` T-D3 (`session_date=None` → fallback)
  lẽ ra đỏ — chưa ai chạy lại sau D05 (sẽ dùng làm fail-before).

## S1 (duy nhất) — xóa import local thừa + verify + backfill ngày thiếu

- **SCOPE**: `packages/core/backend/src/signal_intelligence/tasks.py` (xóa 1 dòng
  `from datetime import datetime` trong nhánh if, dùng import module dòng 3);
  `tests/test_detect_historical.py` (T-D3: mock latest trả `date` thật + mock
  qs chain rỗng theo mẫu T-D1, assert `status == 'ok'`).
  Không đụng file khác (market.js/BE views/FE đã đúng).
- **Fail-before (round 2, sửa theo OB-1)**: T-D3 cũ mock latest→None nên return
  sớm `:94-96`, không chạm `:101` → XANH GIẢ. T-D3 mới: mock latest trả `date`
  thật + mock qs chain rỗng (mẫu T-D1) → code cũ nổ `UnboundLocalError`
  (đỏ đúng lý do), code mới trả `status='ok'`.
- **Pass-after**: toàn file `test_detect_historical` XANH trên code đã sửa
  (chạy bằng DB Postgres riêng trên VPS, DROP sau xong). T-D1/T-D2/T-D4 giữ
  nguyên (xanh cả trước/sau — không phải fail-before, ghi rõ).
- **S3 staging**: merge + deploy → beat 5m chạy lại → verify log không còn
  UnboundLocalError + `WhaleAlertCanonical` có dòng mới. Sau đó backfill các
  phiên thiếu 07→21/11 qua tham số `session_date` (D05) từng ngày, kiểm count.
- LIMIT: 3 vòng. Test DB riêng, DROP sau khi xong (L-B01). Không `pip install`.
- Rollback: revert 2 file (1 dòng code + T-D3).

## Non-goals

- Không sửa engine detect/ngưỡng; không đụng intraday ingest; không FE.
- Không merge/deploy khi chưa B8 PASS (chờ owner duyệt như mọi slice).

## Gates

`node packages/web/scripts/check-multi-agent.mjs` · BE test module D05 trên VPS
(DB riêng, `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`) · `node scripts/normalize-eol.mjs --fix`
khi hook chặn · `node scripts/check-lessons.mjs` nếu đụng LESSONS (không đụng).
CHƯA CHẠY → ghi rõ.

## Evidence gates (chạy thật 2026-11-22, VPS staging)

- **Fail-before** (test mới, code CHƯA sửa): `Ran 4 tests ... FAILED (errors=1)` — đúng
  `UnboundLocalError: cannot access local variable 'datetime'` tại
  `signal_intelligence/tasks.py:101`; T-D1/T-D2/T-D4 `ok`. Lệnh: copy test vào
  `vninvest-core-api`, `CORE_DATABASE_URL=postgresql://vninvest:<pw>@vninvest-core-db:5432/ag_stock_tpb_whale`,
  `python manage.py test signal_intelligence.tests.test_detect_historical -v 2`.
- **Pass-after** (code + test đã sửa): `Ran 4 tests in 0.112s — OK`, DB riêng `ag_stock_tpb_whale`.
- **Regression**: `python manage.py test signal_intelligence --keepdb` → `Ran 77 tests in 6.197s — OK`
  (DB `ag_stock_tpb_whale2`). `--keepdb` dùng vì teardown không drop được DB (2 session
  celery mở — lỗi môi trường, không phải code).
- **Dọn dẹp**: 4 DB tạm đã `DROP ... WITH (FORCE)`; file gốc trong container đã khôi phục
  từ `/tmp/tasks_orig.py` + `/tmp/tdh_orig.py`.
- **Gates local**: `check-multi-agent` → `0 lỗi, 0 trùng số migration — PASS`;
  `check-lessons` → `60/60 sạch`; `git diff --check` → 0.
- **Ghi nhận ngoài scope (KHÔNG sửa)**: log fail-before có
  `TypeError: _b02_mark_run_failed_on_crash() missing 1 required positional argument: 'exc'`
  (celery signal handler) — lỗi pre-existing, không chặn task; ticket riêng nếu cần.
- **S3 staging**: CHƯA CHẠY — chờ merge + deploy, sau đó verify log beat 5m và dòng mới.

## MANDATORY CHECKLIST

- [x] L-V02: fail-before đỏ trên code chưa sửa (T-D3), không suy đoán
- [x] L-V04: assert fail là `UnboundLocalError`, không phải lỗi setup (DB/env)
- [x] L-B01: test chạy trên Postgres DB riêng, DROP sau xong
- [x] L-T01: numstat + giữ LF; EOL hook chặn → fix đúng cách
- [x] Verdict B3/B4 + B8 thành văn bản trước khi qua bước tiếp (B3r1 NEED_REVISION
      → B3r2 PASS; B8 xem Entry 605)
