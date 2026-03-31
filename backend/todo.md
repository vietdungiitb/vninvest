# Backend Modularization for Stock Management

## Ngày: 2026-03-31

### Lý do
- Đáp ứng yêu cầu tách biệt rõ ràng giữa quản lý danh mục đầu tư và quản lý danh mục chứng khoán cả ở backend và frontend.
- Dễ bảo trì, mở rộng, phân quyền và phát triển các tính năng liên quan đến chứng khoán độc lập với danh mục đầu tư.

### Kế hoạch thực hiện
1. Tạo file `urls_stock.py` (hoặc tên tương tự) trong `backend/portfolio/` để định nghĩa các route liên quan đến quản lý danh mục chứng khoán (mã, nhóm, đồng bộ, v.v.).
2. Di chuyển các view quản lý nhóm chứng khoán, mã chứng khoán từ `urls.py` và `views.py` sang module mới nếu cần.
3. Thêm route `/api/stock-management/` trong `config/urls.py` để tách biệt hoàn toàn với các route danh mục đầu tư.
4. Đảm bảo các endpoint cũ vẫn hoạt động hoặc chuyển hướng hợp lý nếu cần.
5. Cập nhật tài liệu API nếu có.

### Ghi chú
- Sau khi hoàn thành, frontend sẽ gọi các endpoint mới dưới `/api/stock-management/` cho các chức năng liên quan đến chứng khoán.
- Đảm bảo không ảnh hưởng đến các chức năng portfolio hiện tại.

---
