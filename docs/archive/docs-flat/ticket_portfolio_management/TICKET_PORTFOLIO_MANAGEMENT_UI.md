# 🎟 TICKET PRIORITIES: Chức năng Quản lý Danh Mục & Tiểu Khoản (User CUD)

**Trạng thái:** Backlog Ưu Tiên (Priority Mới)
**Người tạo:** Hệ thống phân tích kỹ thuật (AI)
**Mô-đun ảnh hưởng:** Frontend Context, Transactions UI, Backend API Layer

---

## 1. Mô tả Vấn Đề (User Story)
- **Hành vi hiện tại**: Khi một người dùng phổ thông (End-user) mới đăng ký tài khoản thành công, hệ thống chưa tự sinh "Danh mục" (Portfolio) hay "Tiểu khoản" (Sub-Account) cho họ. Khi họ cố gắng vào màn hình `Transactions`, hệ thống báo lỗi không có tiểu khoản và yêu cầu tạo dữ liệu Demo.
- **Nỗi đau (Pain point)**: Trên giao diện UI Front-end hoàn toàn vắng bóng các nút bấm tạo, sửa tên hoặc xóa Danh Mục hay Tiểu Khoản. Chức năng này hiện bị ẩn đi và phụ thuộc hoàn toàn vào hệ thống Backend Seeding hoặc Admin Django.
- **Giải pháp**:
  > *Là một Nhà Đầu Tư, tôi cần cung cấp công cụ tự quản lý (Thêm/Sửa Tên/Xóa) nhiều Danh Mục và các Tiểu Khoản (ví dụ: Tài khoản lướt sóng VPS, TK Dài hạn SSI) ngay trên giao diện Front-end để phản ánh đúng hiện trạng thực tế sổ sách của tôi.*

---

## 2. Phạm vi Công Việc (Scope of Work)

### 2.1 Backend (API Check)
*Yêu cầu*: Đảm bảo API đã có điểm cuối (endpoints) cho tác vụ C/U/D hoặc bổ sung nếu đang thiếu.
- `POST /api/portfolio/`: Tạo danh mục mới (Mặc định gắn với `request.user`).
- `PUT/PATCH /api/portfolio/{id}/`: Đổi tên danh mục.
- `DELETE /api/portfolio/{id}/`: Xóa danh mục (cảnh báo xóa toàn bộ lịch sử tiểu khoản / giao dịch liên quan).
- Tương tự với các routes cho `SubAccounts`: `POST`, `PUT`, `DELETE`.

### 2.2 Frontend (Data Layer - `PortfolioContext.jsx`)
*Yêu cầu*: Củng cố Global Context để Frontend thao tác dễ dàng với API thay đổi.
- Bổ sung hàm: `createPortfolio(name)`, `updatePortfolio(id, data)`, `deletePortfolio(id)`.
- Bổ sung hàm: `createSubAccount(portfolioId, payload)`, `updateSubAccount`, `deleteSubAccount`.
- Đảm bảo cơ chế Trigger re-fetch `fetchPortfolios()` sau khi chỉnh sửa thành công để UI tự render lại đồng bộ.

### 2.3 Frontend (Thiết kế Giao Diện UI)
*Yêu cầu*: Nơi gắn tương tác phải hợp lý về mặt UX, tránh gây nhức mắt. Đề xuất:
- **Tình huống "Empty State"**: Nếu user chưa có Portfolio nào (lúc mới lập nick), ngay giữa màn hình `Transactions` hoặc `Dashboard` cần hiện nút Call-To-Action to bản: **"+ Tạo Danh mục đầu tư đầu tiên"**.
- **Quản lý danh mục (Settings)**: Có thể tích hợp dưới dạng Modal nhỏ gọi ra từ Navbar/Dropdown ở góc dưới "Quản lý Tài Khoản". 
- Hiển thị danh sách Portfolio/Sub-Account theo dạng Accordion/Tree, cho phép đổi tên hoặc nhấn nút [X] màu đỏ để xóa.

---

## 3. Tiêu Chí Nghiệm Thu (Definition of Done - DoD)
1. ✅ **Dev Test**: Tạo tài khoản (User mới nguyên) -> Đăng nhập -> Tạo thành công Danh Mục -> Tạo thành công Tiểu Khoản trực tiếp bằng nút bấm trên màn hình Web mà không cần đụng dòng code Backend nào.
2. ✅ **UX Guard**: Nếu người dùng ấn "Xóa" một danh mục đang có chứa >0 giao dịch, Web phải bật Pop-up Alert màu đỏ yêu cầu gõ lại chữ "XAC NHAN XOA" để tránh ấn nhầm gây mất trắng sổ sách.
3. ✅ **No-Code-Break**: Việc thêm nút không làm vỡ giao diện bảng Layout hiện tại của trang `Transactions.jsx`.

---

> *Bản ghi Ticket này lưu để Team Lead/Dev có cái nhìn tổng quan thiết kế, chuẩn bị cho Sprint Planing. Tuyệt đối KHÔNG tự tạo/sửa code cho logic này nếu chưa có lệnh điều phối tiếp theo.*
