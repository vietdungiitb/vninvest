# Probe CafeF lần 2 — 2026-11-27 (VẪN BLOCK từ VPS)

## Câu hỏi
CafeF còn block không? Có thể backfill 2011–2026 từ staging được chưa?

## Kết quả đo thật

### Từ VPS `14.225.255.47` (container `vninvest-core-api`)

```
SINGLE ALL 503 2446 b'<!'
SINGLE TPB 503 2446 b'<!'
BULK ERROR= RuntimeError CafeF bulk HOSE 2026 failed after 3 attempts
DB cafef_2026= 0
```

### Từ IP local (đối chứng)

```
LOCAL ALL 200 3735439 b'PK'
LOCAL TPB 200 12232 b'PK'
```

Lệnh tái hiện (endpoint `PriceHistoryExport.ashx`, `ExchangeType=HOSE`, `Symbol=ALL|TPB`, `StartDate=01/01/2026`, `EndDate=11/27/2026`, header `User-Agent` + `Referer`): chạy cùng một đoạn `requests.get` qua `docker exec -i .../python -` trên VPS và trực tiếp bằng `python -` ở local. `PK` = XLSX thật; `<!` = HTML lỗi 503.

## Kết luận

- **VPS vẫn bị chặn** — lần này ngay cả request đơn lẻ cũng 503 (trước đó lúc 2026-11-27 đầu ngày còn 200/3,7 MB rồi chuyển 503 khi bulk). ⇒ Không phải lúc nào cũng 200; IP đang trong cooldown/rate-limit.
- **Local vẫn 200**, đường dự phòng fetch-local còn dùng được.
- DB staging vẫn **0 dòng `cafef` cho 2026**. Gate `check_price_integrity` chạy 2026-11-27 trả `ok=true, cafef_rows=0` — nhất quán với kết quả probe này.
- `PRICE_ADJUSTED_DISPLAY=0` ⇒ consumer đọc raw close; **không blank chart** vì thiếu `adj_close`. Rủi ro vẫn là chuỗi adjusted stale cho sự kiện mới.

## Việc cần làm (không tự làm trong slice này)

1. Fetch từ **local IP** rồi đẩy dữ liệu theo lô vào `CafefDailyPrice` (đã từng fetch thật 88.879 dòng HOSE 2026), hoặc nhờ owner cho phép IP VPS.
2. Chạy `import_cafef_year_paced` từ Celery (backoff có sẵn), sau đó `rebase_symbol_from_cafef` tới khi `status='applied'`.
3. Verify `cafef_2026 > 0` trước khi bật lại `PRICE_ADJUSTED_DISPLAY=1`.
4. Không trộn dữ liệu VCI/KBS vào dòng `cafef`; nếu fallback thì gắn nhãn `vnbroker_fallback` (thiết kế tại `../price-rebase-s5/CAFEF_FALLBACK_ANALYSIS_20261127.md`).

**Không thay đổi dữ liệu/code runtime trong slice này** — chỉ đo và ghi evidence.
