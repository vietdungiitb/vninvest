# Implementation Plan: Data Processing Optimization (SQL + Pandas Vectorization)

Dựa trên yêu cầu của bạn về việc sử dụng SQL và Pandas để tối ưu hiệu suất (đặc biệt trong các tác vụ), tôi đã xác định được các "điểm nóng" đang sử dụng vòng lặp Python truyền thống (row-by-row) và đề xuất chuyển đổi sang mô hình **Vectorized Processing**.

## Mục tiêu
- Loại bỏ các vòng lặp `for loop` trên QuerySet hoặc List trong Python.
- Giảm tải CPU cho backend server và giảm RAM footprint bằng cách không khởi tạo Django Model objects khi không cần thiết.
- Tận dụng sức mạnh tính toán C++ của Pandas cho các phép tính tài chính (VWAP, CVD, Tick Rate).

## Thành phần thay đổi

### 1. [OPTIMIZE] [order_flow.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/order_flow.py)
Thay thế toàn bộ logic tính toán CVD, Tick Rate và Size Distribution bằng Pandas.
- **Hiện tại**: Sử dụng Dictionary và vòng lặp `for` để phân loại lệnh (buckets).
- **Đề xuất**: 
    - Truy vấn SQL bằng `.values()` để lấy raw data.
    - Chuyển đổi sang `pd.DataFrame`.
    - Dùng `df.groupby()`, `df.resample()`, và `df.sum()` để tính toán đồng loạt.

### 2. [OPTIMIZE] [views_ai_advisory_session.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/views_ai_advisory_session.py)
Tối ưu hóa phép tính VWAP trong quá trình làm giàu dữ liệu cho AI.
- **Hiện tại**: `for tick in same_day_ticks.iterator()` tính tổng tích lũy.
- **Đề xuất**: Dùng `pd.DataFrame.from_records()` và thực hiện `(df['price'] * df['volume']).sum() / df['volume'].sum()`.

### 3. [CLEANUP] [compute.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/realtime/compute.py)
Loại bỏ phương thức `_native` (vòng lặp Python) và chuẩn hóa việc dùng Pandas cho toàn bộ pipeline Realtime.

---

## Các bước thực hiện

### Giai đoạn 1: Refactor Order Flow Engine
1. Chỉnh sửa `_fetch_ticks` để trả về DataFrame thay vì List of Dicts.
2. Viết lại `compute_cvd_series` dùng vectorized subtraction.
3. Viết lại `compute_tick_rate` dùng Pandas filtering (`df[df.value < threshold]`).

### Giai đoạn 2: Refactor AI Advisory Logic
1. Thay thế vòng lặp tính VWAP trong `_build_session_v2_benchmark_enrichment`.
2. Xác minh tính đồng nhất của kết quả sau khi chuyển đổi.

### Giai đoạn 3: Tài liệu hóa (Docs)
Viết hướng dẫn chuẩn code cho team: **"Khi nào dùng SQL, khi nào dùng Pandas"** vào thư mục `docs/`.

---

## Kế hoạch xác minh

### Kiểm thử hiệu năng (Benchmarking)
- So sánh thời gian xử lý khi quét 5.000 ticks giữa loop Python và Pandas vectorization.
- Theo dõi mức chiếm dụng RAM của Celery worker khi chạy tác vụ `detect_and_store_order_flow`.

### Kiểm thử tính đúng đắn
- Đảm bảo các chỉ số VWAP, CVD sau khi refactor khớp 100% với logic cũ.

---
**Bạn có đồng ý với hướng tiếp cận "SQL để lọc - Pandas để tính" này không? Nếu có, tôi sẽ bắt đầu thực hiện bản refactor cho Order Flow trước.**
