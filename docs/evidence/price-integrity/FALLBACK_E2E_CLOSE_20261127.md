# Fallback CafeF — E2E cuối cùng ĐÃ CHẠY THẬT (2026-11-27)

## Kết quả trên staging `dev@6dd274a97`

Lệnh: `rebase_symbol_from_cafef.run('AAH', exchange='HOSE', trigger='e2e_fallback', from_year=2026)`.

```
RESULT {'status': 'applied_fallback', 'symbol': 'AAH', 'provider': 'KBS', 'rows_updated': 222}
ROWS   [{'date': 2026-01-05, 'close': 3500.00, 'adj_close': 3500.00,
          'adj_factor': 1.0000000000, 'price_source': 'vnbroker_fallback'}, ...]
AUDIT  [{'status': 'applied_fallback', 'detail': 'cafef_empty;provider=KBS', 'rows_updated': 222}]
```

Gate sau ghi dữ liệu:

```
{"ok": true, "violations": [], "counts": {tat ca 0},
 "rows": 281444, "cafef_rows": 0, "since": "2026-01-01"}
price_integrity: ok
display=0   (KHONG doi)
```

## Bốn lần fail-before đã được sửa (mỗi lần có bằng chứng E2E/unit)

| Lần | Triệu chứng | Root cause | Fix |
|---|---|---|---|
| 1 | TPB `cafef_rows_present`, 0 UPDATE | Guard chống trộn basis đúng thiết kế | Giữ nguyên; chỉ fallback cho mã không có dòng `cafef` |
| 2 | `AttributeError: 'DailyPrice' object has no attribute 'get'` | Unit test dùng dict, E2E truyền ORM object | `_field()` chấp nhận cả hai |
| 3 | `insufficient_coverage` dù KBS trả 223/222 | `old_rows` lấy toàn lịch sử, fetch chỉ 2026 | Scope `date__gte=from_year`, guard cafef vẫn toàn chuỗi |
| 4 | `no_data`, fallback không chạy | CafeF trả 200 rỗng, không raise | Nhánh empty cũng gọi fallback |

## Hạn chế phải nói rõ

- Fallback là **provider-adjusted basis** (`adj_factor=1`, `close=adj_close`), **không phải CafeF SSOT**. Khi CafeF hết block, job chuẩn ghi đè lại.
- Mã **đã có dòng `cafef`** (1345/1834 mã) vẫn bị guard `cafef_rows_present` từ chối — cần slice "chuyển basis toàn chuỗi có kiểm soát (force)" nếu muốn fallback cho nhóm này. Không tự mở rộng.
- `PRICE_ADJUSTED_DISPLAY` vẫn `0`. FE đã có nhãn `provider_adjusted_fallback` nhưng chưa bật flag — việc bật là quyết định vận hành riêng.
- Backfill 2011–2026 bằng CafeF vẫn chưa xong (IP VPS bị 503).

## Bàn giao

Cơ chế dự phòng đã hoạt động đầu-cuối cho nhóm 537 mã không có dòng CafeF: tự động fallback sang KBS adjusted, ghi nhãn trung thực, audit đầy đủ, gate toàn vẹn vẫn xanh.
