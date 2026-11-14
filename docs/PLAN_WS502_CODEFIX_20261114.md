# PLAN — Fix WS 502 triệt để bằng code (không chạm infra): bulk technicals cache 60s + WS auth off shared thread

- **Date**: 2026-11-14. **Claim sau**: `ws-502-codefix`. **Lessons áp dụng**: [L-002 L-007 L-V01 L-V02 L-V03 L-V04 L-G02 L-T01 L-T02]
- **Root cause (đã có bằng chứng log, Entry 511)**: 1 process daphne; 10 bulk POST song song
  (200 symbols × 180 ngày, ORM 36k rows + Python math) bão GIL → event loop không kịp
  hoàn tất WS handshake → daphne reset → nginx 502. Fix #407 cứu bulk khỏi treo nhưng
  không giảm tải CPU.
- **Phương án chọn (tốt nhất trong các option không chạm infra/deny-list)**:
  - O1 multi-daphne / tách HTTP-WS: đúng nhưng chạm `docker-compose*.yml` (deny-list),
    cần coordinator + Owner infra — KHÔNG làm ở slice này.
  - O2 Celery hóa indicators: đúng nhưng lớn (task + cache + invalidation + contract) — để sau.
  - ✅ **O3 (slice này, BE-only, 2 thay đổi nhỏ)**:
    - S1: cache kết quả `_build_response` 60s trên Django cache (staging = Redis,
      test = LocMem): key `bulk_technicals:v1:<date>:<sha1(sorted symbols)>`.
      Dashboard refresh/revisit/tab-switch hết bão lặp lại; first-load vẫn nặng 1 lần.
    - S2: `RealtimeConsumer.connect` + `MarketTickerConsumer.connect`: auth
      `sync_to_async(resolve_user_from_ws_query, thread_sensitive=False)` — handshake
      auth không xếp hàng sau tickers polling trên shared thread (mirror #407).
- **Non-goals**: không FE stagger (giữ nguyên retry/timeout logic; đo lại sau — nếu
  first-load vẫn 502 mới làm), không đổi contract/envelope, không migration,
  không settings, không package.json, không compose.
- **AC (Given/When/Then)**:
  - AC1: Gọi POST bulk 2 lần giống hệt nhau → lần 2 ≈ 0 DB query (cache hit), payload
    tương đương lần 1 (trừ `updated_at` ≤ 60s cũ — chấp nhận, ghi rõ).
  - AC2: Symbols khác nhau → cache miss, query bình thường, không lẫn key.
  - AC3 (live staging, WARM): pre-warm 1 bulk (chờ 200) rồi bão 10 bulk song song +
    WS handshake cùng lúc → 0 connection reset/`502` mới trong cửa sổ đo (baseline
    Entry 511: 4×502/26s trên cache lạnh).
  - AC4 (live staging, COLD — ghi nhận, KHÔNG gate): bão 10 bulk trên cache lạnh sau
    `cache.clear` của key đó → đo số 502/10 handshake, chỉ để biết mức cải thiện của S2
    đơn độc, không chặn merge.
- **Giới hạn đã biết (O2)**: TTL 60s ngắn + không singleflight → revisit sau >60s hoặc
  N caller song song đúng lúc hết hạn vẫn miss đồng thời (thundering herd). Slice này
  chấp nhận (giảm tần suất bão, không triệt tiêu); singleflight/lock/TTL dài hơn để slice sau.
- **Fail-before**: test mới `test_bulk_technicals_cache.py` chạy trên code chưa sửa →
  lần 2 vẫn query DB (đỏ đúng lý do); S2 wiring không có unit test ý nghĩa →
  verify live AC3 (ghi rõ trong ledger, không báo PASS giả — L-007/L-G02).
- **Gates**: `check-multi-agent` PASS; `check-lessons` 60/60; targeted BE test trên VPS
  staging DB tạm (runbook §12, cấm local — L-007); `tsc` không đổi FE nhưng vẫn chạy
  nhanh xác nhận; deploy staging + verify live AC3.
- **Rollback**: revert 1 commit (2 file BE + 1 test). Cache key có `v1` để xoay khi đổi shape.
- **Implementation note (R1–R3)**: cache inner `results` (list dict, KHÔNG cache DRF
  `Response` — `envelope()` lại mỗi request); lookup đặt SAU scope check trong
  `get`/`post` (giữ nguyên thứ tự hiện tại); key dùng sorted symbols, khi hit ráp lại
  theo thứ tự symbols của request (map theo symbol, rẻ).
