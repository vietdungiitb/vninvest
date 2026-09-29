# Kế hoạch Hoàn thiện Modern Dashboard (v6.2): AI & Polish

Đây là giai đoạn cuối cùng để biến Dashboard thành một "Trạm làm việc thông minh" thực thụ, tập trung vào khả năng phân tích của AI và trải nghiệm người dùng cao cấp.

## User Review Required

> [!NOTE]
> Tôi sẽ ra mắt 1 component mới gọi là `ModernPortfolioDigest` để thay thế cho `PortfolioDigestPanel` cũ trong giao diện Workstation. Component này sẽ có mật độ thông tin cao hơn và sử dụng phong cách Neon/Glassmorphism.

## Proposed Changes

### 1. Tab "AI Bot" - Trợ lý Phân tích Danh mục

#### [MODIFY] [ModularPositionDeck.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/ModularPositionDeck.jsx)
- Triển khai nội dung cho Tab `ai`.
- **Portfolio Health Score**: Hiển thị một vòng tròn chỉ số (ProgressBar) chấm điểm danh mục trên thang 100 dựa trên Sharpe Ratio và Alpha.
- **AI Narrative**: Hiển thị bản tóm tắt gợi ý từ AI về các mã cần lưu ý.

### 2. Modern AI Digest Sidebar

#### [NEW] [ModernPortfolioDigest.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/ModernPortfolioDigest.jsx)
- Thiết kế lại bản tin AI theo phong cách "Command Center".
- Rút gọn các tin tức thành các "Bullet points" có icon cảm xúc (Bullish/Bearish).
- Tối ưu hóa diện tích hiển thị để không cần scroll nhiều.

#### [MODIFY] [ModernSidebar.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/ModernSidebar.jsx)
- Thay thế `PortfolioDigestPanel` bằng `ModernPortfolioDigest`.
- Truyền dữ liệu digest từ `ModernDashboard` xuống.

### 3. Đồng bộ hóa Dữ liệu AI

#### [MODIFY] [ModernDashboard.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/pages/modern/ModernDashboard.jsx)
- Thêm fetch `getPortfolioNewsDigest` vào `fetchData`.
- Cung cấp dữ liệu này cho cả Sidebar và PositionDeck.

## Open Questions

- Bạn có muốn AI tự động "chấm điểm" (Rate) danh mục từ A+ đến F dựa trên các chỉ số không (được khuyến nghị), hay chỉ hiện điểm số 0-100?

## Verification Plan

### Automated Tests
- Kiểm tra tính toán Health Score không bị lỗi chia cho 0 khi portfolio mới.
- Kiểm tra hiển thị AI Digest khi chưa có dữ liệu (trạng thái empty).

### Manual Verification
- Chuyển sang Tab AI Bot và kiểm tra xem nội dung có khớp với bản tin AI gần nhất không.
- Kiểm tra Sidebar AI Digest mới có hiển thị đẹp hơn bản cũ không.
