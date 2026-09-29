# Đánh Giá Chuyên Sâu: Order Flow Radar & Dark Money Detection

> **Mục tiêu**: Phân tích và đánh giá chất lượng thiết kế kiến trúc chức năng dò tìm dòng tiền ngầm (Dark Money) ở cả hệ thống Backend và Frontend. Tài liệu này đóng vai trò cơ sở tham chiếu (Reference Material) khẳng định sự cấp thiết của kế hoạch Refactor trong các Sprint tiếp theo.

---

## 1. Phân Tích Kỹ Thuật Backend (`order_flow.py`)

Mã nguồn phát hiện dòng tiền ẩn ở backend thể hiện kỹ năng lập trình định lượng (Quantitative Finance) sắc bén kết hợp tốt tư duy hệ thống Event-Driven:

- **Tư duy thiết kế thuật toán tinh tế**: Hệ thống phân nhỏ các hàm tính toán theo các mô hình tài chính đúng chuẩn thay vì gộp chung một khối: `compute_cvd_series` (đo động lượng ròng Cumulative Volume Delta), `detect_absorption` (đo Lực hấp thụ / Bắt đáy), và `detect_iceberg_clustering` (Phát hiện lệnh chia nhỏ ở cùng một mức giá ẩn).
- **Cơ chế tổng hợp tín hiệu (Aggregated Signal)**: Phân hệ `detect_dark_flow` cực kỳ khéo léo khi tổng hợp các dấu hiệu rời rạc (Ví dụ: Tick rate cao bất thường + Lệnh nhỏ gom liên tục + Giá bị khóa phần trăm hẹp) nhằm tránh tỷ lệ False Positive, qua đó đưa ra kết luận mạch lạc là `twap_bot`, `iceberg` hay `absorption`. Chỉ báo "Confidence" kết hợp chặt chẽ theo số lượng mẫu (repeat_count) là cách tiếp cận cẩn trọng.
- **Tối ưu tần suất gọi DB (Anti-Thrashing Guard)**: Tính năng dùng `django.core.cache` với thời gian ngắn hạn (TTL = 10 giây) cho hàm tính tỷ lệ khớp lệnh (`compute_tick_rate`) giải quyết thành công tình trạng hàng ngàn lệnh SQL truy vấn vào bảng IntraDayTick khi lượng user tăng đột biến.
- **Thách thức Scalability**: Yếu điểm kiến trúc hiện tại nằm ở các vòng lặp thuần của Python (`for tick in ticks:...`). Tại khung Window size nhỏ (15-30 phút), Python giải quyết mượt mà; nhưng khi người dùng chuyển view trích xuất biểu đồ cả tuần hay tháng, vòng lặp In-memory này sẽ chốt cổ chai IO/CPU. **Việc chuyển xử lý Window xuống tầng Database Engine bằng Repository là hoàn toàn bắt buộc trong quy trình chuẩn bị Scalability**.

---

## 2. Phân Tích Kiến Trúc Frontend (`StockDetail.jsx` -> `OrderFlowPanel`)

Component phục vụ Trading Radar rất thực dụng, vận dụng tốt cơ chế Lifecycle React để phản hồi tốc độ cho người dùng:

- **Hợp nhất Liền Mạch Giữa API Fetch & Websocket Live**: Thay vì hiển thị dữ liệu tĩnh và chờ polling tốn khoảng chênh lệch 30 giây, Hook xử lý truyền giá trị `const liveSignal = latestRealtimeAlert || latestSignal` giúp giao diện bắn ra hiệu ứng cảnh báo ngay lập tức nếu WebSockets mở kênh có Dark Flow mới. Phương thức này giấu đi độ trễ của Network REST API một cách hoàn hảo.
- **Data Visualization & UX Layout**: Việc tích hợp Area Chart từ Rechart cho biểu đồ CVD đi kèm Gradient màu tương phản `#22d3ee` tạo cảm giác hiện đại như các sản phẩm Premium Terminal, giúp người xem hình dung nhanh được dòng tiền Rút hay Gom đọng lại thay vì đọc con số raw. Biểu tượng đo Gradient cho tỷ lệ Strength đem lại Feedback dễ dàng nhận diện.
- **Tương tác linh hoạt (Component Extensibility)**: Hệ thống Window Selector linh hoạt (5m, 15m, 30m, 1h) liên kết chặt chẽ vào param API giúp việc đổi bucket time mượt mà. Đạt tiêu chuẩn cho Dashboard chứng khoán.

---

## 3. Tổng Kết Khuyến Nghị

Đội lập trình phụ trách chức năng Dark Money Alert chứng tỏ được năng lực chuyển ngữ cực tốt từ lý thuyết tài chính vĩ mô sang thuật toán code cụ thể. Việc tích hợp hai đầu Backend-to-Frontend trơn tru tạo nên sản phẩm UI có độ mượt cực tốt.

Tuy nhiên để sẵn sàng chịu được sức ép của hệ số Big Data cho giai đoạn Bull-market (Lưu lượng Tick data tỷ đô một mã mỗi ngày), hệ thống bắt buộc triển khai nghiêm ngặt lộ trình Refactor:
1. Đưa các hàm thống kê Time-Series xuống thực hiện bằng **Window Functions** bằng ORM ở tầng Database. Đề nghị không tải Raw Data Ticks lên Python Memory.
2. Thiết lập cơ chế **Threshold Động (ADV Dynamic Threshold)** như đã lên kế hoạch để Radar tránh cảnh báo spam mã Penny và câm nín ở mã Bluechip VN30 khủng.
