# Kế hoạch chi tiết: Ổn định hóa Realtime Engine & Xử lý lỗi 504 Timeout (2026-04-17)

Tài liệu này cung cấp hướng dẫn kỹ thuật chi tiết để đội lập trình thực hiện tối ưu hóa ngay lập tức nhằm giải quyết tình trạng lỗi 504 Gateway Timeout và treo task trên hệ thống VNInvest.

---

## 🏗 Thành phần 1: Tối ưu hóa Database Fallback Layer

**File**: `backend/portfolio/market_data_service.py`
**Method**: `get_whale_feed_aggregate`

### 1.1 Thay đổi logic lọc dữ liệu (SQL-side filtering)
Hiện tại, logic lọc theo ngưỡng (`threshold`) của từng mã chứng khoán đang thực hiện trong vòng lặp Python (`queryset.iterator()`). Cần chuyển logic này vào câu lệnh SQL bằng `Q` objects.

**Mã nguồn cũ (Dòng ~1486 và ~1524):**
```python
# CŨ: Lọc theo min sau đó dùng loop Python
queryset = queryset.filter(matched_value__gte=min_threshold_vnd)
...
for row in queryset.iterator(chunk_size=1000):
    if float(getattr(row, 'matched_value', 0)) >= _resolve_threshold_for_symbol(row.symbol):
        rows.append(row)
```

**Mã nguồn đề xuất:**
```python
from django.db.models import Q

# Tạo filter động cho từng mã chứng khoán với ngưỡng tương ứng
symbol_threshold_filters = Q()
for sym in symbols:
    specific_threshold = _resolve_threshold_for_symbol(sym)
    symbol_threshold_filters |= Q(symbol=sym, matched_value__gte=specific_threshold)

# Áp dụng vào queryset
queryset = queryset.filter(symbol_threshold_filters)

# Sau khi filter ở DB, ta có thể giới hạn số lượng row ngay lập tức
page_rows = list(queryset[:limit + 1])
```

### 1.2 Hiệu quả mong đợi:
- Database chỉ trả về các bản ghi thực sự thỏa mãn điều kiện.
- Loại bỏ vòng lặp `iterator()` gây nghẽn tiến trình đồng bộ (blocking task), giúp Daphne có thể phản hồi nhanh hơn.

---

## 🏗 Thành phần 2: Tăng khả năng chịu lỗi của Stream Layer

**File**: `backend/portfolio/realtime/stream_reader.py`

### 2.1 Điều chỉnh ngưỡng Stale dữ liệu
Dữ liệu đang bị coi là "stale" (hết hạn) quá nhanh (120 giây), gây áp lực liên tục lên Database.

**Thay đổi:**
- Tăng `STREAM_STALE_AFTER_SECONDS` từ `120` lên `300` (5 phút).
- Điều này cho phép Collector có thời gian trễ nhẹ mà không làm sập toàn bộ hệ thống API.

---

## 🏗 Thành phần 3: Cải thiện tính minh bạch (Observability)

**File**: `backend/portfolio/market_views.py`
**View**: `WhaleFeedAggregateView`, `UnifiedAlertsView`

### 3.1 Thêm Header Debug
Thêm HTTP Header `X-Data-Source` và `X-Process-Time` vào response để frontend/ops có thể biết dữ liệu đến từ Redis hay DB và mất bao lâu.

---

## ✅ Kế hoạch kiểm thử (Testing)

1. **Unit Test**: Chạy `pytest backend/portfolio/tests/test_realtime_performance.py` (nếu có).
2. **Stress Test**: Giả lập Redis bị sập (flushall) và kiểm tra xem API `/api/realtime/whale-feed/aggregate/` có còn bị 504 khi truy cập với 20+ mã chứng khoán không.
3. **Log Monitor**: Kiểm tra log Daphne không còn xuất hiện `took too long to shut down and was killed`.

---
> [!IMPORTANT]
> Toàn bộ các thay đổi trên phải được thực hiện trên môi trường Staging trước khi đẩy lên Production. Tuyệt đối không thay đổi cấu trúc bảng `IntradayTick` trong giai đoạn này để tránh downtime do migration.
