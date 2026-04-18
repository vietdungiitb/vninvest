# VNStock Core Compatibility Audit (2026-04-18)

## 1. Mục tiêu
Rà soát mức tương thích của dự án với vnstock private nhánh `core`, đồng thời bổ sung lớp adapter chuẩn hóa cho các hàm mới dùng trong AI Advisory.

## 2. Kết luận nhanh
- Trạng thái dependency: **PASS** (backend đang pin `vnstock ... @core`).
- Trạng thái API methods cần cho feature mới: **PASS** (ở mức class API).
- Trạng thái runtime upstream provider: **CÓ RỦI RO NHẸ** (đã ghi nhận một trường hợp `KeyError: data` khi khởi tạo `Vnstock(...).stock(..., source='AUTO')` phụ thuộc payload provider).

## 3. Các hạng mục đã chuẩn hóa trong adapter
Đã bổ sung tại `backend/portfolio/adapters/vnstock_adapter.py`:

1. `fetch_fundamental_snapshot_dataframe(...)`
- Gọi `stock.finance.fundamental_snapshot(...)`.
- Chuẩn hóa schema long-table:
  - `symbol`, `period`, `report_date`, `metric`, `value`, `unit`, `source`, `source_used`.
- `annual` được normalize về `year`.
- Nếu lỗi/không hỗ trợ, trả DataFrame rỗng nhưng giữ đúng schema.

2. `fetch_insider_deals_dataframe(...)`
- Gọi `stock.company.insider_deals(...)`.
- Khi `standardize=True`, chuẩn hóa schema:
  - `symbol`, `announce_date`, `deal_date`, `actor_name`, `actor_type`, `action`, `quantity`, `price`, `ratio`, `note`, `source`, `source_used`.
- Có fallback an toàn trả DataFrame rỗng schema chuẩn.

3. Nhóm so sánh ngành:
- `fetch_industry_peers_dataframe(...)`
- `fetch_industry_benchmark_dataframe(...)`
- `fetch_industry_rank_dataframe(...)`

Các hàm trên tự gắn `source`/`source_used`, normalize tham số `period`, và bọc lỗi qua flow adapter hiện có.

## 4. Regression tests đã thêm
Tạo file test mới:
- `backend/portfolio/tests/test_vnstock_adapter_standardized_methods.py`

Các kiểm tra chính:
1. Fundamental snapshot trả đúng schema canonical.
2. Insider deals trả đúng schema canonical và normalize action.
3. Industry methods luôn gắn `source` và `source_used`.

## 5. Điểm tương thích còn cần theo dõi
Một số đường gọi trong codebase vẫn dùng `from vnstock import Vnstock` trực tiếp (không qua adapter), ví dụ ở một số đoạn trong `services.py` và `admin.py`.

Tác động:
- Có thể khác behavior timeout/retry/source fallback so với adapter trung tâm.

Khuyến nghị tiếp theo:
1. Refactor dần các call trực tiếp này về adapter để đồng bộ runtime policy.
2. Đặt cảnh báo log nếu phát hiện provider AUTO trả payload thiếu key chuẩn, tránh fail cứng ở đường nóng.
3. Khi bắt đầu triển khai AI Advisory sources mới, chỉ gọi vnstock thông qua adapter functions chuẩn hóa đã thêm.

## 6. Kết luận triển khai
Dự án đã sẵn sàng bước vào coding feature AI Advisory runtime config với vnstock core, nhờ có lớp adapter chuẩn hóa cho 3 nhóm hàm mới và regression tests bảo vệ contract dữ liệu.
