# PLAN — Sửa `UnboundLocalError: datetime` làm chết whale-detect từ ~06/11

- **Date**: 2026-11-22 · **Lessons áp dụng**: [L-V02, L-V04, L-B01, L-T01, L-F07]
- **Trạng thái**: B1 xong → B2 (file này) → chờ B3 + B4.

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
- Rollback: revert 1 dòng.

## Non-goals

- Không sửa engine detect/ngưỡng; không đụng intraday ingest; không FE.
- Không merge/deploy khi chưa B8 PASS (chờ owner duyệt như mọi slice).

## Gates

`node packages/web/scripts/check-multi-agent.mjs` · BE test module D05 trên VPS
(DB riêng, `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`) · `node scripts/normalize-eol.mjs --fix`
khi hook chặn · `node scripts/check-lessons.mjs` nếu đụng LESSONS (không đụng).
CHƯA CHẠY → ghi rõ.

## MANDATORY CHECKLIST

- [ ] L-V02: fail-before đỏ trên code chưa sửa (T-D3), không suy đoán
- [ ] L-V04: assert fail là `UnboundLocalError`, không phải lỗi setup (DB/env)
- [ ] L-B01: test chạy trên Postgres DB riêng, DROP sau xong
- [ ] L-T01: numstat + giữ LF; EOL hook chặn → fix đúng cách
- [ ] Verdict B3/B4 + B8 thành văn bản trước khi qua bước tiếp
