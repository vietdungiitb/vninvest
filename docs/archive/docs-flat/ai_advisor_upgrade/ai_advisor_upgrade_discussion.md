# Tài liệu thảo luận: Nâng cấp AI Advisor Alert Panel

## 1. Mục tiêu
Hiện đại hóa bảng điều khiển AI Advisor, biến nó thành một "Trung tâm chỉ huy" thông minh, có khả năng chủ động đưa ra cảnh báo và giải thích logic đầu tư dựa trên dữ liệu đa chiều.

## 2. Cấu trúc Panel mới (AIAdvisorAlertPanel)
- **Thiết kế Tab kép (Dual-Tab)**:
    - **Tab 1: AI Alerts**: Danh sách tối đa 4 khuyến nghị tối ưu nhất.
    - **Tab 2: AI News**: Bản tin tóm tắt thị trường và tâm lý (Sentiment) do AI phân tích.
- **Tính năng tương tác**: Expand/Collapse, Smart Alert (Neon Pulse), Cảnh báo âm thanh.

## 3. Thang điểm khuyến nghị (Scoring System)
Hệ thống sử dụng mô hình chấm điểm tổng hợp để đưa ra quyết định (Ngưỡng kích hoạt: **±3.5 điểm**).

| Nhóm chỉ số | Trạng thái | Điểm số |
| :--- | :--- | :--- |
| **Kỹ thuật** | RSI < 35 (Quá bán) | **+3.0** |
| | RSI > 70 (Quá mua) | **-3.0** |
| | Giá thấp hơn MA20 > 5% | **+1.5** |
| | Giá cao hơn MA20 > 5% | **-1.5** |
| **Dòng tiền** | Mỗi lệnh Cá mập (Whale Flow) | **+2.0** |
| **Quản trị rủi ro**| Tỷ trọng mã > 20% danh mục | **-4.0** |

- **BUILD (Mua)**: Tổng điểm ≥ +3.5
- **TRIM (Bán)**: Tổng điểm ≤ -3.5
- **HOLD (Theo dõi)**: Điểm nằm trong khoảng (-3.5, +3.5)

## 4. Vai trò của AI trong hệ thống (Hybrid AI Model)
Mặc dù phép tính ở Frontend mang tính cơ học (để đảm bảo tốc độ real-time), vai trò cốt lõi của AI nằm ở:

1.  **AI trích xuất (Backend)**: Sử dụng Machine Learning để nhận diện dòng tiền Cá mập và phân tích Sentiment tin tức (biến dữ liệu phi cấu trúc thành điểm số).
2.  **AI tổng hợp (Generative AI)**: Sử dụng LLM để viết báo cáo giải thích (Explainability), biến các con số thành lời khuyên có giá trị tư vấn cao.
3.  **AI tự thích nghi (Future)**: Tự động điều chỉnh trọng số (Weights) dựa trên kết quả giao dịch thực tế trong quá khứ.

## 5. Phạm vi phân tích
- **Holdings**: Tối ưu hóa vị thế hiện có (Build/Trim).
- **Watchlist**: Săn tìm cơ hội mua mới (chỉ báo nhãn "Cơ hội mua" khi điểm số BUILD đạt ngưỡng).

Quy trình chấm điểm (Scoring) được thực hiện dựa trên một thang điểm tổng hợp từ 3 nhóm chỉ số chính. Hệ thống sẽ cộng/trừ điểm dựa trên các tín hiệu và chỉ đưa ra khuyến nghị khi Tổng điểm đạt ngưỡng ±3.5.

Dưới đây là bảng chi tiết thang điểm trong mã nguồn (useAIAdvisor.js):

1. Thang điểm chi tiết
Nhóm chỉ số	Trạng thái tín hiệu	Điểm số	Ý nghĩa
Kỹ thuật (RSI)	RSI < 35 (Quá bán)	+3.0	Vùng giá hấp dẫn
RSI > 70 (Quá mua)	-3.0	Rủi ro điều chỉnh cao
Độ lệch MA20	Giá thấp hơn MA20 > 5%	+1.5	Chiết khấu tốt so với trung bình
Giá cao hơn MA20 > 5%	-1.5	Giá đang tăng nóng (Extended)
Dòng tiền (Whale)	Có 1 lệnh Cá mập xuất hiện	+2.0	Dòng tiền lớn đang gom hàng
Quản trị rủi ro	Tỷ trọng mã > 20% danh mục	-4.0	Cảnh báo vi phạm ngưỡng an toàn
2. Cách AI quyết định khuyến nghị
Hệ thống sẽ cộng dồn các điểm trên lại để ra Tổng điểm (Total Score):

BUILD (Mua/Mua thêm): Khi Tổng điểm ≥ +3.5
Ví dụ: RSI thấp (+3) + Giá dưới MA20 (+1.5) = 4.5 -> BUILD.
Ví dụ: RSI trung bình (0) + Có 2 lệnh Cá mập (+4) = 4.0 -> BUILD.
TRIM (Bán/Chốt lời): Khi Tổng điểm ≤ -3.5
Ví dụ: Tỷ trọng quá cao (-4) + RSI trung bình (0) = -4.0 -> TRIM.
Ví dụ: RSI cao (-3) + Giá quá xa MA20 (-1.5) = -4.5 -> TRIM.
HOLD (Theo dõi): Khi Tổng điểm nằm trong khoảng từ -3.5 đến +3.5. AI sẽ giữ trạng thái trung tính và không hiển thị cảnh báo.
3. Tại sao chọn ngưỡng 3.5?
Việc chọn ngưỡng 3.5 (thay vì 1 hay 2) giúp loại bỏ các "tín hiệu giả".

Nếu chỉ có RSI chạm 70 (điểm -3), AI vẫn chưa báo bán ngay (vì chưa đủ -3.5).
AI chỉ báo bán khi RSI 70 kèm theo một yếu tố rủi ro khác (như giá quá xa MA20 hoặc tỷ trọng trong tài khoản của bạn đang quá lớn).
Điều này giúp các khuyến nghị của bạn trở nên chắc chắn và có tính xác thực cao hơn.

7:32 PM
lưu giải thích này vào file giúp tôi. Câu hổi đặt ra là vai trò AI ở đâu khi đây là cách tính hoàn toàn cơ học
Tôi đã cập nhật nội dung chi tiết về Thang điểm khuyến nghị và Phân tích vai trò của AI vào file 

ai_advisor_upgrade_discussion.md
.

Tóm lại, hệ thống của bạn đang vận hành theo mô hình Hybrid AI (AI Lai):

Máy học (ML) & NLP: Làm việc ở "hậu trường" (Backend) để định lượng các khái niệm trừu tượng như "Dòng tiền cá mập" hay "Tâm lý thị trường" thành các con số.
Luật định (Heuristics): Làm việc ở "tiền tuyến" (Frontend) để xử lý các con số đó với tốc độ ánh sáng, đảm bảo Dashboard luôn nhạy bén theo từng tích tắc của thị trường.
AI tạo sinh (GenAI): Làm nhiệm vụ "người phiên dịch", biến các kết quả tính toán khô khan thành những lời giải thích dễ hiểu và có chiều sâu chuyên gia cho bạn.
Mô hình này giúp Dashboard của bạn vừa có Trí tuệ (Intelligence) của AI, vừa có Tốc độ (Speed) của máy tính cơ học.
---
*Tài liệu này được cập nhật vào ngày 22/04/2026.*

---

## 6. Addendum: Global Screener Admin UI Supplementary Plan

Tôi đã đọc tài liệu bổ sung tại [GLOBAL_SCREENER_ADMIN_UI_SUPPLEMENTARY_PLAN_20260428.md](../global_screener_admin/GLOBAL_SCREENER_ADMIN_UI_SUPPLEMENTARY_PLAN_20260428.md) và có thể đưa nó vào kế hoạch slice UI admin như một nhánh triển khai độc lập, không xung đột với phần AI Advisor hiện có.

### Kế hoạch triển khai đề xuất
- Slice 1: Hotfix SSOT ở `backend/portfolio/services_global_screener.py` để snapshot global screener có whale/dark money flow.
- Slice 2: Tạo `backend/portfolio/views_screener_admin.py` với các API bảo vệ bằng `IsAdminUser`.
- Slice 3: Bổ sung client Axios cho các API admin screener.
- Slice 4: Tạo tab `Global Screener` trong `AdminOps.jsx` và component quản trị tương ứng.

### Điểm cần chốt nhẹ trước khi code
- Chỉ cần thống nhất một chuẩn route duy nhất cho admin screener, vì tài liệu audit đang dùng `/api/v1/admin/screener/config/` còn phần execution plan ghi dạng route backend tương đối `admin/screener/config/`.
- Ngoài điểm route prefix này, tôi chưa thấy yêu cầu nào khác cần làm rõ trước khi đội code bắt tay vào thực thi.

### Kết luận
- Sẵn sàng triển khai.
- Tôi sẽ coi supplementary plan này là baseline cho slice UI admin Global Screener.

### Ghi chú route backend
- Backend route tương đối được chốt là `admin/screener/config/`.
- Nếu cần API path đầy đủ, tầng `urls.py`/router sẽ ghép prefix chung của dự án vào phía trước.

---

## 7. Final Audit: Global Screener Admin UI

### Kết quả kiểm toán
- **Trạng thái:** PASS (Đạt)
- **API route:** `frontend/src/api/client.js` đã trỏ `getAdminScreenerConfig` về đúng endpoint `/portfolio/admin/screener/config/`.
- **Banner persistence:** Trong `GlobalScreenerAdminPanel.jsx`, các luồng `loadRules` và `handleResetRuleForm` đã được thêm tùy chọn `{ preserveMessage: true }`, nên banner trạng thái không bị reset ngay sau Save/Delete.
- **Validation:** Bộ test backend `portfolio.tests.test_admin_screener_admin` đã pass 8/8.

### Kiểm tra UI qua trình duyệt
- Đã thực hiện kiểm tra trên `http://localhost:3000/admin-ops`.
- **Save Configuration:** Banner `Đã lưu cấu hình Global Screener.` hiển thị và duy trì sau khi tải lại dữ liệu.
- **Save Rule:** Banner `Đã tạo luật Global Screener.` hiển thị và được giữ nguyên sau khi danh sách được refresh.
- **Delete Rule:** Banner `Đã xóa luật Global Screener.` hiển thị và giữ nguyên đúng yêu cầu sau khi xác nhận xóa.

### Kết luận nghiệm thu
- Slice này đã hoàn tất.
- Lỗi UI persistence và lệch endpoint đã được xử lý triệt để.
- Có thể đóng và nghiệm thu phần Global Screener Admin UI.
