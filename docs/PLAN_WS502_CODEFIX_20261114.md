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
    - S1: cache kết quả `_build_response` 300s trên Django cache (staging = Redis,
      test = LocMem): key `bulk_technicals:v1:<date>:<sha1(sorted symbols)>`.
      Dashboard refresh/revisit/tab-switch hết bão lặp lại; first-load vẫn nặng 1 lần.
    - S2: `RealtimeConsumer.connect` + `MarketTickerConsumer.connect`: auth
      `sync_to_async(resolve_user_from_ws_query, thread_sensitive=False)` — handshake
      auth không xếp hàng sau tickers polling trên shared thread (mirror #407).
- **Non-goals**: không FE stagger (giữ nguyên retry/timeout logic; đo lại sau — nếu
  first-load vẫn 502 mới làm), không đổi contract/envelope, không migration,
  không settings, không package.json, không compose.
- **AC (Given/When/Then)**:
  - AC1: Gọi POST bulk 2 lần giống hệt nhau → lần 2 ≈ 0 DB query (cache hit, TTL 300s),
    payload tương đương lần 1 (trừ `updated_at` ≤ TTL cũ — chấp nhận, ghi rõ).
  - AC2: Symbols khác nhau → cache miss, query bình thường, không lẫn key.
  - AC3 (live staging, WARM): pre-warm 1 bulk (chờ 200) rồi bão 10 bulk song song +
    WS handshake cùng lúc → 0 connection reset/`502` mới trong cửa sổ đo (baseline
    Entry 511: 4×502/26s trên cache lạnh).
  - AC4 (live staging, COLD — ghi nhận, KHÔNG gate): bão 10 bulk trên cache lạnh sau
    `cache.clear` của key đó → đo số 502/10 handshake, chỉ để biết mức cải thiện của S2
    đơn độc, không chặn merge.
- **Giới hạn đã biết (O2)**: TTL ngắn + không singleflight → revisit sau khi hết hạn hoặc
  N caller song song đúng lúc hết hạn vẫn miss đồng thời (thundering herd). Slice
  ws-502-codefix chấp nhận (giảm tần suất bão, không triệt tiêu); S3 dưới đây xử lý
  nốt duplicate concurrent.
- **S3 (FE, slice ws-502-dedupe, audit vòng 3 → sửa theo O-S3-1..3)**: live 16:00:55Z ghi
  nhận 50 symbols (= 1 chunk) mà **6 POST bulk song song cùng giây** (đều 200 ~216KB)
  → gọi trùng lặp (retry/remount/multi-component), không dedupe. Thêm in-flight
  promise map trong `market.js#getBulkTechnicalsBySymbols`:
  - Key = `normalized.join(',')` GIỮ NGUYÊN thứ tự, tính SAU normalize (`:322-324`)
    (O-S3-1, O-S3-2 — sorted key phá thứ tự response; BE cache đã sorted nên 2 thứ tự
    khác nhau vẫn share BE key khi warm).
  - Cleanup mirror pattern sẵn có `coreGet` (`transport.js:468-473`): cleanup là
    side-effect trong `.then`, LUÔN return promise gốc cho caller (O-S3-3).
  - Không đổi contract/shape/merge logic; dedupe mức request (live case 1 chunk).
  - Test: 2 calls đồng thời cùng symbols → `fetch` bulk đúng 1 lần, cả 2 resolve bằng
    nhau; symbols khác nhau → 2 lần; settle xong gọi lại → fetch tiếp; reject lan
    truyền cho cả 2 caller + map không leak (O-S3-3).
  - Ghi nhận: assertion cũ `coreApiAdapter.test.js:293` sai sẵn PRE-EXISTING (assert URL
    `?symbols=` thời GET, code đã POST) — `:290` vẫn đúng; không đổ cho S3.
- **S4 (infra nhẹ, KHÔNG chạm deny-list — slice ws-502-isolate, audit vòng 5→6)**: cô lập
  WS + thêm CPU staging (env VPS, không sửa file repo).
  - (a) `entrypoint.sh` nhánh `api)`: 2 daphne — `:8100` HTTP + `:8101` WS (cùng ASGI
    app, channel layer Redis share nên groups跨process OK; migrate/collectstatic vẫn
    chạy 1 lần trước khi fork). Supervise POSIX-sh (dash không có `wait -n`):
    ```sh
    daphne --bind 0.0.0.0 --port "${CORE_WS_PORT:-8101}" vninvest_core.asgi:application &
    WS_PID=$!
    daphne --bind 0.0.0.0 --port "${CORE_API_PORT:-8100}" vninvest_core.asgi:application &
    API_PID=$!
    _term() { kill -TERM "$WS_PID" "$API_PID" 2>/dev/null; wait 2>/dev/null; exit 0; }
    trap _term TERM INT
    while kill -0 "$WS_PID" 2>/dev/null && kill -0 "$API_PID" 2>/dev/null; do sleep 5; done
    kill -TERM "$WS_PID" "$API_PID" 2>/dev/null
    wait 2>/dev/null
    exit 1
    ```
    (`kill -0` nằm trong điều kiện `while/&&` nên `set -eu` không kill script; trap
    gọi `exit` nên không rò exit 143 — O-S4-1.)
  - (b) `nginx.conf`: thêm `set $core_ws_upstream core-api:8101;`, `location /ws/`
    proxy sang đó; mọi location khác giữ nguyên. Port 8101 nội bộ container network,
    không cần compose (`expose` chỉ là tài liệu).
  - (c) Tài nguyên (O-S4-2): `prod.yml:129-130` trần container `mem 256m / cpus 0.5`,
    staging không override → 16GB host VÔ NGHĨA trong container; S4(a) chỉ cô lập
    event loop chứ KHÔNG tăng throughput. Kèm theo: nâng `CORE_API_CPUS` (vd 2.0) +
    `CORE_API_MEM_LIMIT` trực tiếp trong `/opt/vninvest/compose.staging.env` TRÊN VPS
    (env file, không phải deny-list repo) rồi recreate core-api. Ghi `docker stats`
    trước/sau vào verify. Nâng thêm nữa cần Owner — escalate path, ngoài slice.
  - (d) TTL cache bulk 60→300s (1 hằng số + comment, cập nhật cả S1/AC1 — O-S4-3):
    tần suất bão lạnh giảm 5×. Staleness ≤5 phút cho technicals (giá live vẫn qua
    tickers riêng; R-b vòng 2 đã xác minh không consumer nào đọc freshness từ bulk).
  - Test: `bash -n entrypoint.sh` (runbook §12.2 cho phép local) + `nginx -t` qua
    deploy `--verify` + verify live: user reload → bulk POST ít + WS 502 ≈ 0 trong
    cửa sổ + `docker stats` ghi nhận.
  - Rollback: revert 1 commit (entrypoint + nginx + hằng số) + trả env VPS về cũ.
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
