# ĐỀ XUẤT TÍCH HỢP VNSTOCKCHARTS VÀO TRANG STOCK DETAILS MỚI
## KIẾN TRÚC SAAS NATIVE OPENAPI & HỆ THỐNG CHỈ BÁO DÒNG TIỀN THÔNG MINH (SMART MONEY FLOW)

---

## 1. Giới thiệu tổng quan & Lý do đề xuất

Dự án **VNInvest** đang chuyển mình mạnh mẽ sang kiến trúc **SaaS Native OpenAPI**, đòi hỏi các thành phần UI phải đạt được độ tin cậy cao, khả năng tùy biến sâu và tốc độ phản hồi tối ưu ở cấp độ quốc tế. 

Trong trang chi tiết cổ phiếu (`Stock Detail`) cũ, thành phần biểu đồ trung tâm sử dụng thư viện **Klinecharts**. Mặc dù đây là một thư viện canvas gọn nhẹ, nó gặp phải những giới hạn nghiêm trọng về khả năng tích hợp sâu các chỉ báo độc quyền của VNInvest:
1. **Đóng gói pipeline vẽ (Black-box rendering):** Rất khó khăn để inject trực tiếp các overlay phức tạp như **Whale Alert Markers (Shark Icons 🟢🦈/🔴🦈)**, **Whale Buy/Sell Bubbles**, hay **Heatmap Bands** theo thời gian thực vào đúng các tọa độ nến cụ thể mà không làm giảm hiệu năng hệ thống.
2. **Double-Compute & Sync Scale:** Việc đồng bộ hóa dữ liệu dòng tiền tích lũy (CVD) và Sức mạnh dòng tiền (Buy/Institutional Strength) trên cùng một trục X nhưng khác scale Y thường bị méo mó hoặc phải tính toán lặp lại (double-compute), gây tốn CPU của client.
3. **Hạn chế Theming & Customize:** Không hỗ trợ chuẩn CSS Variables khiến việc chuyển đổi Dark/Light mode không mượt mà và khó đồng bộ với hệ thống Design System chung của VNInvest.

### Giải pháp: VNStockCharts (vietdungiitb/vnstockchars)
**VNStockCharts** là thư viện biểu đồ kỹ thuật chuyên nghiệp được xây dựng trên nền tảng **React 19 + TypeScript strict + D3 v7 (Canvas/SVG hybrid)**. Thư viện này được thiết kế riêng biệt để giải quyết các bài toán charting phức tạp nhất của thị trường Việt Nam:
* **Kiến trúc Indicator Platform 5 tầng:** Sẵn sàng hỗ trợ từ các chỉ báo Well-known đến các chỉ báo độc quyền (VN-exclusive) và tiến tới bộ dựng chỉ báo trực quan bằng sơ đồ khối (Visual DAG Builder).
* **SSOT Canonical Store:** Mọi chỉ báo được tính toán đúng một lần qua `enrichData` và truy xuất qua `seriesValueResolver` giúp loại bỏ hoàn toàn việc tính trùng lặp.
* **Hybrid Rendering:** Trục tọa độ, lưới và legends được vẽ bằng SVG chính xác; chuỗi nến, khối lượng và các vùng mật độ dòng tiền được vẽ bằng Canvas hiệu năng cao (đáp ứng 60fps khi stream WebSocket thực tế).
* **Độc lập và Type-safe:** Viết bằng TypeScript nghiêm ngặt, cấu hình linh hoạt qua CSS Variables (`--gc-*`), hỗ trợ i18n đầy đủ.

Tài liệu này đề xuất giải pháp kiến trúc và lộ trình chi tiết sử dụng **VNStockCharts** làm thành phần cốt lõi của trang **Stock Details mới**, nâng tầm trải nghiệm phân tích kỹ thuật dòng tiền cá mập lên chuẩn mực quốc tế.

---

## 2. So sánh tính năng vượt trội: Cũ (Klinecharts) vs. Mới (VNStockCharts)

Dưới đây là bảng đối chiếu kỹ thuật chi tiết chỉ ra sự vượt trội của giải pháp đề xuất so với hệ thống cũ và các tiêu chuẩn quốc tế:

| Tiêu chí | Trang cũ (Klinecharts) | Trang mới (VNStockCharts) | Tiêu chuẩn quốc tế (TradingView / GoCharting) |
| :--- | :--- | :--- | :--- |
| **Công nghệ lõi** | Canvas-only (Black-box) | **Hybrid D3 v7 (SVG + Canvas)** | Canvas-only (Finnhub/TradingView core) |
| **Tùy biến Overlay** | Phức tạp, dễ crash khi zoom | **Tự do inject qua Canvas Overlay System** | Rất tốt nhưng qua ngôn ngữ Pine Script đóng kín |
| **Tính toán chỉ báo** | Tính ad-hoc ở từng pane | **SSOT Canonical (`enrichData`)* — Tính 1 lần** | Tính lặp lại khi render nhiều pane |
| **Whale Buy/Sell Bubbles** | Vẽ thô sơ qua tooltip | **Vẽ trực tiếp trên Price Pane theo tọa độ** | Không có (Không tích hợp sẵn dữ liệu Whale VN) |
| **Đồng bộ Pane & Trục X** | Trục X đồng bộ nhưng khó kéo giãn | **Dynamic Pane System + Drag Splitter mượt mà** | Xuất sắc, hỗ trợ kéo giãn đa chiều |
| **Đồng bộ Scale Y** | Dễ bị méo scale khi chung pane | **Hỗ trợ `splitScale: true` (2 Chart chồng nhau)** | Hỗ trợ scale độc lập Trái/Phải |
| **CSS Variables Theme** | Không hỗ trợ | **Hỗ trợ toàn diện (`--gc-*`), no re-render** | Cấu hình qua JSON config phức tạp |
| **Phân tích viewport** | Quét toàn bộ dataset | **Viewport-aware (chỉ lọc top 10% nến hiển thị)** | Có hỗ trợ trong các chỉ báo Volume Profile |
| **Bar Replay (Phát lại phiên)**| Không có | **BarReplayController domain class tách biệt** | Có (Tính năng trả phí cao cấp) |

---

## 3. Kiến trúc luồng dữ liệu (Data Flow) SaaS Native OpenAPI

Kiến trúc mới hoạt động trên nguyên tắc **Presentation độc lập với Data**. Biểu đồ đóng vai trò là **Render Plane**, giao tiếp với **SaaS Core API** và **Realtime Feed Plane** qua các hợp đồng OpenAPI chuẩn hóa.

```
                  [ BACKEND LAYER (Django SaaS Core) ]
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼ OpenAPI HTTP                                      ▼ WebSocket
  /core/v1/market/session-facts/                     ws/realtime/
  /api/portfolio/whale/analytics/{symbol}/           (events: whale_alert,
  (CVD, Whale score, Strength, OHLCV history)         whale_advisory)
         │                                                   │
         └─────────────────────────┬─────────────────────────┘
                                   │ coreApiAdapter / WS client
                                   ▼
                [ FRONTEND LAYER (React 19 Core App) ]
                                   │
                                   ▼
                    enrichData(rawOHLCV, rawSignals)
                                   │
                                   ▼ [SSOT Canonical Store]
                       EnrichedDatum[] Materialized
                                   │
                                   ▼
                     useDynamicPanes(totalHeight)
                                   │
                                   ▼ (heights, visibilities, splitScale)
                      DynamicChart (slots builder)
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼ (Pane 0 - Price)        ▼ (Pane 1 - CVD)          ▼ (Pane 2 - Strength)
  - Candle Series           - CVD Normalized Series   - Buy Strength Series
  - EMA / Bollinger Bands   - Baseline at 50          - Institutional Strength Series
  - Whale Bubbles Overlay   - CVD Color Gradients     - Sync X-Axis with Pane 0
  - Heatmap Bands Overlay
```

### Các nguyên tắc luồng dữ liệu bất biến:
1. **Không ghi trực tiếp vào DB từ client:** Biểu đồ chỉ đọc dữ liệu thông qua các Service/Adapter trung gian đã được cấp quyền qua PAT (Personal Access Token).
2. **Batch Update cho WebSocket:** Để tránh tình trạng "React render storm" khi nhận hàng nghìn tick giao dịch, biểu đồ sử dụng cơ chế **Buffer & Batching (250ms)** để gom dữ liệu trước khi đẩy vào `enrichData`.
3. **Facts-first selected session:** Khi người dùng click chọn một phiên (`selected session`) trên biểu đồ, toàn bộ các cấu phần phụ trợ như **Whale Advisory**, **Bubble Order Chart** và **OrderFlowRadarPanel** sẽ lập tức đồng bộ theo session đó thay vì quét lại toàn bộ lịch sử (Full-scan raw ticks).

---

## 4. Chi tiết giải pháp tích hợp các tính năng cốt lõi

### 4.1. Phân tích giá lịch sử (History Prices)
* **Thành phần sử dụng:** Cấu hình `<CandlestickSeries>` kết hợp với các overlay kỹ thuật tiêu chuẩn quốc tế như EMA, Bollinger Bands, SAR.
* **Tính toán tối ưu:** Dữ liệu lịch sử OHLCV được lấy từ API `/api/portfolio/whale/analytics/{symbol}/` được materialize và cached. Chỉ tính toán lại các đường trung bình (EMA/MA) khi tham số đầu vào trong hộp thoại cài đặt thay đổi.
* **Quy chuẩn hiển thị:** Đảm bảo hiển thị giá theo chuẩn bảng giá quốc tế (`en-US` format, 2 chữ số thập phân).

### 4.2. Dấu vết cá mập & Sự kiện mua/bán lớn (Whale Alerts & Bubbles)
* **Cơ chế Marker Viewport (Quy định cứng):** Nhãn cá mập (Shark Icons `🟢🦈` và `🔴🦈`) không hiển thị tràn lan mà chỉ áp dụng cho **top 10% nến có giá trị giao dịch đột biến nhất trong viewport hiện tại** của người dùng. Khi người dùng pan/zoom biểu đồ, danh sách này được tính toán lại động thông qua thuật toán lọc phân bố percentile.
* **Whale Bubbles Overlay:** Vẽ trực tiếp các vòng tròn bong bóng mua/bán (kích thước tương ứng với volume của lệnh cá mập) ngay trên trục giá của nến. Người dùng có thể click vào bong bóng để xem chi tiết volume, thời gian khớp và mức độ hấp thụ dòng tiền.

### 4.3. Cumulative Volume Delta (CVD) chuẩn hóa
* **Pane tách biệt:** Theo đúng quy định thiết kế trải nghiệm cao cấp, **CVD chuẩn hóa** được đưa vào một pane riêng (`CVD Pane`) nằm ngay phía dưới pane giá, không vẽ chung để tránh làm méo mó đồ thị giá.
* **Thuật toán chuẩn hóa:** CVD được chuẩn hóa về biên độ `-100` đến `+100` hoặc dạng phần trăm `0% - 100%`, giúp người dùng dễ dàng so sánh mức độ phân kỳ (Divergence) giữa giá và lực mua bán chủ động của dòng tiền lớn.
* **Baseline 50:** Pane có một đường đứt nét làm ranh giới 50 (hoặc 0) để xác định vị thế kiểm soát thuộc về Phe Mua hay Phe Bán.

### 4.4. Sức mạnh dòng tiền (Buy Strength & Institutional Strength)
* **Pane Sức mạnh dòng tiền (Strength Pane):** Nằm ở pane dưới cùng, đồng bộ hoàn hảo trục X với Price Pane và CVD Pane.
* **Đa trục chuyên nghiệp (Split Scale):** Sử dụng cơ chế `splitScale: true` của VNStockCharts để vẽ hai đường **Buy Strength** (Sức mạnh mua nhỏ lẻ) và **Institutional Strength** (Sức mạnh tổ chức gom hàng) chồng lên nhau nhưng có scale độc lập, giúp trực quan hóa mối tương quan lực lượng giữa cá mập và đám đông.
* **Mã hóa màu sắc thông minh:** 
  * Đường Buy Strength: Xanh lục sáng (`#34d399`)
  * Đường Institutional Strength: Xanh lam cyan (`#38bdf8`)

### 4.5. Phân tích nhiệt dòng tiền (Heatmap Time-Buckets)
* **Heatmap Band Overlay:** Tích hợp trực tiếp các dải băng màu sắc (Heatmap) chạy dọc theo biểu đồ nến chính.
* **Nguyên lý màu sắc:** 
  * Dòng tiền gom hàng mạnh (Net Buy): Dải màu xanh lục mờ (`rgba(34, 197, 94, alpha)`)
  * Dòng tiền xả hàng mạnh (Net Sell): Dải màu đỏ hồng mờ (`rgba(244, 63, 94, alpha)`)
  * Cá mập hành động âm thầm (Whale Score cao nhưng Net Volume thấp): Dải màu hổ phách (`rgba(245, 158, 11, alpha)`)
* **Hiệu suất tối đa:** Các dải màu được tính toán theo `time bucket` phiên và vẽ bằng Canvas phối hợp hiệu ứng mờ (alpha channel) theo cường độ dòng tiền, đảm bảo không bị giật lag khi kéo giãn biểu đồ.

---

## 5. Tổ chức kiến trúc UI & Sắp đặt không gian

Đáp ứng các ràng buộc nghiệp vụ về trải nghiệm người dùng cao cấp, cấu trúc của trang **Stock Details** mới sẽ được sắp xếp theo một bố cục mạch lạc và khoa học:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [HEADER PANEL] Mã cổ phiếu · Giá realtime · % Thay đổi · Vốn hóa       │
│                [Bỏ theo dõi / Theo dõi] · [Tạo cảnh báo]               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [VNSTOCKCHARTS WORKSPACE - SURFACE TRUNG TÂM]                         │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ (Pane 0 - Price) Candlesticks + Heatmap + Whale Bubbles          │  │
│  │                                                                  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ (Pane 1 - CVD) CVD chuẩn hóa (Cyan Line)                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ (Pane 2 - Strength) Buy Strength vs Institutional Strength       │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ [ORDERFLOW RADAR PANEL]                                                │
│ Sức mạnh dòng tiền · Tốc độ khớp lệnh · Sự kiện hấp thụ khối lượng     │
│ ┌──────────────────────────────────────┐ ┌───────────────────────────┐ │
│ │ Biểu đồ vùng CVD 30 phút (Recharts)  │ │ Danh sách tín hiệu gần đây│ │
│ └──────────────────────────────────────┘ └───────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ [INFORMATION ARCHITECTURE DECK - TRIAD LAYOUT]                         │
│ ┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────┐ │
│ │ Khớp lệnh trong phiên    │ │ Tin tức & Khuyến nghị AI │ │ Hồ sơ DN │ │
│ └──────────────────────────┘ └──────────────────────────┘ └──────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Ràng buộc UI quan trọng:** Thành phần `OrderFlowRadarPanel` (vẽ CVD 30m bằng Recharts và hiển thị danh sách tín hiệu gần đây) bắt buộc phải được chuyển xuống ngay phía dưới biểu đồ **VNStockCharts** làm bảng bổ trợ chi tiết. Không được đặt song song làm loãng không gian biểu đồ chính.

---

## 6. Kế hoạch triển khai & Tích hợp (Implementation & Migration)

Để đảm bảo quá trình chuyển đổi diễn ra trơn tru, không gây gián đoạn hệ thống và đạt tỷ lệ parity 100%, chúng tôi đề xuất quy trình triển khai qua 4 bước:

### Bước 1: Chuẩn bị Library & Integration Bridge
1. Khai báo thư viện `vnstockchars` thành một package nội bộ (Workspace package) trong `package.json` của VNInvest hoặc link trực tiếp mã nguồn của `vnstockchars/src/lib` vào thư mục `frontend/src/components/vnstockcharts/`.
2. Tạo file adapter `VNInvestSignalAdapter.js` để ánh xạ các cấu trúc dữ liệu từ SaaS OpenAPI (`/api/portfolio/whale/analytics/`) sang cấu trúc `RawOHLCV` và chỉ báo tùy chỉnh của VNStockCharts.

### Bước 2: Build Component `VNStockChartPanel.jsx` mới
1. Kế thừa các logic xử lý sự kiện zoom/pan và đồng bộ session từ `KLineChartPanel.jsx` cũ.
2. Cấu hình `useDynamicPanes` của VNStockCharts với 3 pane mặc định:
   * Pane 1 (Price): `<CandlestickSeries>` + `WhaleBubbleOverlay` + `HeatmapBandOverlay`.
   * Pane 2 (CVD): `<CVDNormalizedSeries>` với ranh giới nét đứt `Baseline 50`.
   * Pane 3 (Strength): `<StrengthSeries>` hỗ trợ `splitScale: true` vẽ chéo hai đường Buy và Institutional Strength.
3. Đảm bảo toàn bộ các nhãn, tooltip và text tiếng Việt có dấu qua hook `useI18n()`.

### Bước 3: Thay thế & Sắp đặt lại StockDetail.jsx
1. Import `VNStockChartPanel` mới thay cho `KLineChartPanel` cũ.
2. Di chuyển `OrderFlowRadarPanel` xuống dưới biểu đồ chính.
3. Liên kết state `selectedSession` của biểu đồ với đầu vào của cấu phần tư vấn AI Advisory và radar dòng tiền.

### Bước 4: Kiểm toán chất lượng & Chạy thử nghiệm (Self-Audit & Dry-Run)
1. Tiến hành chạy build frontend để đảm bảo không có lỗi biên dịch:
   ```powershell
   Push-Location ./frontend
   npm run build
   Pop-Location
   ```
2. Thực hiện kiểm tra parity dữ liệu trên môi trường phát triển cục bộ qua script `./start_dev.ps1`.
3. Kiểm tra tính tương thích Responsive trên thiết bị di động và các trình duyệt phổ biến.

---

## 7. Kết luận & Đề xuất hành động

Việc thay thế **Klinecharts** cũ bằng **VNStockCharts** là một bước đi chiến lược, biến trang Stock Detail của VNInvest trở thành một vũ khí phân tích dòng tiền cá mập mạnh mẽ tương đương các hệ thống chuẩn quốc tế, mang lại giá trị độc quyền duy nhất cho tập người dùng trả phí **Pro+** và **Enterprise**.

**Đề xuất hành động tiếp theo:**
1. **Phê duyệt đề xuất:** Thiết lập cuộc họp kỹ thuật ngắn để thống nhất kiến trúc luồng dữ liệu.
2. **Triển khai Phase 1:** Bắt đầu cấu hình Integration Bridge và xây dựng component biểu đồ mới song song với component cũ (không ghi đè ngay lập tức để giữ an toàn hệ thống).
3. **Tiến hành cutover:** Chuyển đổi route và kiểm toán chất lượng theo đúng bộ constitution chất lượng của dự án.

---
*Tài liệu được chuẩn bị bởi Antigravity AI Coding Assistant - Google DeepMind team.*
