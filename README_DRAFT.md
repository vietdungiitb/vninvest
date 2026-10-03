# VNInvest — Professional Stock Tracking & Intelligent Robo-Advisor

[![Sprint Status](https://img.shields.io/badge/Sprint-17_Complete-success.svg)](docs/ROADMAP_STATUS.md)
[![License](https://img.shields.io/badge/Model-Open_Core-blue.svg)](docs/archive/docs-flat/core_strategy_master/OPEN_CORE_STRATEGY_MASTER_FINAL.md)
[![Tech Stack](https://img.shields.io/badge/Stack-Django_6.0.3_+_React-green.svg)](#tech-stack)

**VNInvest** là nền tảng theo dõi danh mục đầu tư và cố vấn tài chính thông minh dành riêng cho thị trường chứng khoán Việt Nam (HOSE, HNX, UPCOM). Hệ thống kết hợp khả năng xử lý dữ liệu thời gian thực (Real-time), phân tích định lượng chuyên sâu và trí tuệ nhân tạo để hỗ trợ nhà đầu tư ra quyết định chính xác.

---

## 🚀 Tầm nhìn & Chiến lược Open Core

Dự án đang chuyển mình sang mô hình **Open Core**, phân tách rõ ràng giữa các giá trị cộng đồng và các tính năng cao cấp:

*   **Community Lane**: Cung cấp công cụ tracking, biểu đồ và quản lý danh mục nền tảng, có thể tự vận hành (Self-hosted) nhằm xây dựng niềm tin và sự minh bạch.
*   **Pro/Enterprise Lane**: Tập trung vào các giá trị "Intelligence" như AI Advisory nâng cao, Whale & Dark-flow intelligence, và hạ tầng throughput cao cho người dùng chuyên nghiệp.

> [!NOTE]
> Để biết thêm chi tiết về lộ trình chuyển đổi, vui lòng tham khảo [Chiến lược Open Core (OC-14)](docs/archive/docs-flat/core_strategy_master/OPEN_CORE_STRATEGY_MASTER_FINAL.md).

---

## ✨ Tính năng cốt lõi

### 📊 Quản lý & Phân tích Danh mục
*   **Real-time NAV**: Theo dõi giá trị tài sản ròng và lãi/lỗ biến động tức thì.
*   **Advanced Analytics**: Các chỉ số định lượng chuyên sâu: Sharpe, Sortino, Max Drawdown, TWR, Volatility.
*   **Asset Allocation**: Trực quan hóa phân bổ theo ngành, vốn hóa và loại tài sản.

### ⚡ Real-time Radar & Market Intelligence
*   **Whale Alerts**: Phát hiện các lệnh giao dịch lớn (Smart Money) theo ngưỡng tùy chỉnh.
*   **Market Breadth**: Thống kê độ rộng thị trường, dòng tiền realtime qua WebSocket.
*   **Smart Watchlist**: Nhóm danh mục theo dõi cá nhân tích hợp cảnh báo giá tự động.

### 🤖 AI Robo-Advisor (Pro Feature)
*   **Contextual Insight**: Tổng hợp tin tức và biến động giá để đưa ra lời khuyên đầu tư.
*   **Portfolio Health Check**: Tự động đánh giá sức khỏe danh mục dựa trên hồ sơ rủi ro.

---

## 🛠 Tech Stack

Hệ thống được thiết kế với kiến trúc hiện đại, đảm bảo tính mở rộng và khả năng xử lý realtime:

-   **Backend**: Python 3.11+, Django 6.0.3 (ASGI), Django Channels.
-   **Frontend**: React, TailwindCSS, Recharts (Modern Bloomberg-style UI).
-   **Data Processing**: Celery, Redis Streams, Pandas.
-   **Real-time Engine**: Daphne ASGI, WebSocket gateway.
-   **Data Provider**: Tích hợp `vnbroker` cho dữ liệu thị trường Việt Nam.

---

## 🏁 Hướng dẫn cài đặt nhanh (Local Development)

### 0. Thiết lập môi trường an toàn (Khuyến nghị)
Sử dụng script bootstrap để tự động cấu hình các file `.env` và Secret Key:
```powershell
.\scripts\dev-setup.ps1
```

### 1. Khởi chạy Backend & Services
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_user              # Tạo tài khoản test; mật khẩu lấy từ biến môi trường
python manage.py seed_demo_data --reset # Nạp dữ liệu mẫu
python manage.py sync_stockprofile --mode all
python -m daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### 2. Khởi chạy Celery Workers (Xử lý Real-time)
Mở terminal mới:
```powershell
cd backend
celery -A config worker -l info --pool=solo
celery -A config beat -l info
```

### 3. Khởi chạy Frontend
Mở terminal mới:
```powershell
cd frontend
npm install
npm start   # Truy cập http://localhost:3000
```

---

## 🏗 Kiến trúc dữ liệu Real-time

Dữ liệu chảy qua hệ thống theo đường ống (Pipeline) tối ưu:
```text
vnbroker API → Celery Worker (5s) → Compute Engine (VWAP/Whale) → Redis Pub/Sub
  → Django Channels → WebSocket → Frontend Hook (useRealtimeFeed.js)
    → UI Update (Dashboard, Watchlist, StockDetail)
```

---

## 📏 Quy định phát triển (Internal Governance)

Để đảm bảo chất lượng mã nguồn bền vững, dự án áp dụng các quy tắc nghiêm ngặt:

1.  **Anti-Fat-File Policy**: Giới hạn kích thước file (Cảnh báo: 700 dòng, Chặn merge: 1000 dòng). Kiểm tra bằng: `scripts/quality/check_large_files.ps1`.
2.  **Audit Ledger**: Mọi thay đổi code quan trọng phải được ghi nhận vào [docs/CODE_CHANGE_AUDIT_LEDGER.md](docs/CODE_CHANGE_AUDIT_LEDGER.md).
3.  **Sync vninvest-core**: Quy trình đồng bộ hóa snapshots sang repository public được thực hiện qua: `scripts/ops/sync_vninvest_core.ps1`.

---

## 📚 Tài liệu tham khảo quan trọng

| Tài liệu | Nội dung |
| :--- | :--- |
| [ROADMAP_STATUS.md](docs/ROADMAP_STATUS.md) | Trạng thái dự án, kiến trúc tổng quát và API Contract. |
| [DATA_PIPELINE_PLAN.md](docs/archive/docs-flat/data_pipeline_pandas/DATA_PIPELINE_PANDAS_SQL_OPTIMIZATION_PLAN_20260418.md) | Kế hoạch tối ưu hóa hiệu năng xử lý dữ liệu. |
| [WEBSOCKET_CONTRACT.md](docs/WEBSOCKET_EVENT_CONTRACT.md) | Quy chuẩn giao tiếp qua WebSocket. |
| [WHALE_ALERTS_ROADMAP.md](docs/WHALE_ALERTS_DASHBOARD_ROADMAP.md) | Hiện trạng và định hướng tính năng phát hiện lệnh lớn. |

---

© 2026 VNInvest Team. Hệ thống hỗ trợ quyết định dựa trên dữ liệu.
