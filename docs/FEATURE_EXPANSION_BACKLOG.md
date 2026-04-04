# Feature Expansion Backlog (Canonical, aligned with current codebase)

> **Status**: ACTIVE BACKLOG  
> **Last aligned**: 2026-04-04  
> **Note**: Tài liệu này đã được chuẩn hóa theo trạng thái source hiện tại. Các mục đã triển khai được giữ lại dưới dạng historical record, không coi là pending backlog.

---

## 1) Mục tiêu backlog

- Duy trì một backlog mở rộng có thứ tự ưu tiên rõ ràng.
- Tách bạch giữa:
  - **Delivered** (đã có trong code)
  - **Hardening** (đã có foundation nhưng cần nâng chất lượng vận hành)
  - **Future** (chưa triển khai)
- Tránh lặp kế hoạch giữa các tài liệu roadmap/sprint/checklist.

---

## 2) Nguyên tắc ưu tiên

1. Ưu tiên hạng mục tận dụng trực tiếp nền realtime + analytics đã có.
2. Ưu tiên hardening vận hành trước khi mở rộng tính năng phụ thuộc bên ngoài.
3. Mọi hạng mục vào sprint phải có owner, DoD và KPI kiểm chứng được.

---

## 3) Delivered (Historical, không còn backlog pending)

### D-01 Shared frontend realtime layer
- Hook dùng chung `useRealtimeFeed` đã áp dụng cho Watchlist + Dashboard.

### D-02 Realtime portfolio value / unrealized P&L (foundation)
- Dashboard realtime panel đã có lớp hiển thị giá trị gần realtime và trạng thái stale.

### D-03 User-defined price alerts (vertical slice)
- Có model/API/UI cơ bản cho price alerts + cooldown.

### D-04 Scheduled sync watch assets (foundation)
- Có command/task nền tảng cho đồng bộ watch assets.

### D-05 Sprint 13 core outcomes (đã hiện diện)
- Portfolio analytics nâng cao.
- Allocation by sector.
- Stock detail workspace nâng cấp.
- Admin ops stats/dashboard foundation.

### D-06 Sprint 14 — Mission Control & AI Advisory (đã hiện diện)
- `WhaleConfigVersion` + maker-checker approve flow.
- HHI concentration score trong allocation API.
- Alpha/Beta so benchmark VN-Index.
- ScreenerRule CRUD + evaluator (POST `/screener/rules/{id}/run/`).
- Sector chart toggle trong `AllocationPieChart`.
- `stock_ai_advisory_session_api` với sync fallback khi không có Celery.

### D-07 Sprint 15 — Order Flow & Dark Money Detection (đã hiện diện)
- `backend/portfolio/order_flow.py`: `compute_cvd_series`, `compute_tick_rate`, `detect_absorption`, `detect_iceberg_clustering`, `detect_dark_flow`.
- `OrderFlowSignal` model + Celery task 30s + `dark_flow_alert` WS event.
- Frontend `OrderFlowPanel` trong StockDetail với CVD chart, tick-rate meter, absorption badge.
- `useRealtimeFeed` export `darkFlowAlerts`, `latestDarkFlowAlert`.

### D-08 Sprint 16 — Whale Volume Weighting & Order Flow Time Window (đã hiện diện)
- Aggregate feed trả field `volume` trong tất cả 4 builders (graceful fallback = 0).
- `WhaleAlertsHub` + `WhaleAdvisory`: tích lũy `totalVolume`, hiển thị "Whale Avg Price = totalValue/totalVolume".
- `getFrequencyLabel` dùng `totalValue` ngưỡng VNĐ (5B/2B/500M) thay vì count.
- Order flow `?window=5m|15m|30m|1h` param trong backend + window selector UI trong StockDetail.

> Nguồn tham chiếu trạng thái: `docs/ROADMAP_STATUS.md`, `docs/SPRINT_EXECUTION_LOG.md`, `docs/SPRINT13_ACCEPTANCE_CHECKLIST.md`, `docs/SPRINT16_ACCEPTANCE_CHECKLIST.md`.

---

## 4) P0 — Hardening gần hạn (ưu tiên cao)

### P0-1 Realtime reliability hardening
- Mục tiêu:
  - Ổn định reconnect/backoff, stale state, fallback behavior trong điều kiện runtime thực.
- DoD:
  - Có checklist vận hành và baseline metric cho reconnect/fallback/stale.

### P0-2 Aggregate whale feed hardening
- Mục tiêu:
  - Củng cố endpoint aggregate feed (cursor behavior, sorting stability, filter semantics).
- DoD:
  - Contract ổn định, tài liệu rõ filter/sort/cursor, có test edge-case bổ sung.

### P0-3 Ops observability & alerting baseline
- Mục tiêu:
  - Chuẩn hóa metric/log tối thiểu cho realtime + admin ops.
- DoD:
  - Có danh sách signal cảnh báo chính và runbook phản ứng sự cố mức cơ bản.

### P0-4 Django Admin Google Mail OAuth2 token management [NEW]
- Nguon: De xuat van hanh mail account (2026-04-04)
- Muc tieu:
  - Quan tri tai khoan gui mail Google tren Django Admin bang OAuth2 token thay cho SMTP password.
  - Ho tro connect/callback/revoke/test mail trong admin.
  - Tich hop Gmail API vao `send_system_email` va giu SMTP legacy de fallback.
- Owner: BE + DevOps + QA
- DoD:
  - Co auth mode `google_oauth2` trong `SystemEmailAccount`.
  - Co flow OAuth2 admin chay end-to-end.
  - Co test matrix SMTP/OAuth2 va rollback plan.
  - Checklist Sprint 18 duoc sign-off.
- Tai lieu sprint: `docs/SPRINT18_DETAILED_PLAN.md`, `docs/SPRINT18_ACCEPTANCE_CHECKLIST.md`

---

## 5) P1 — Product expansion gần hạn

### P1-1 Analytics mở rộng chiều sâu
- Mục tiêu:
  - Hoàn thiện các chỉ số còn thiếu/đang deferred (ví dụ HHI, VaR nhẹ, stress view tối thiểu).
- DoD:
  - API + UI + test + mô tả business meaning rõ ràng.

### P1-2 Stock workspace nâng cấp kỹ thuật
- Mục tiêu:
  - Mở rộng chart/insight panel và khả năng đọc tín hiệu theo symbol.
- DoD:
  - Trải nghiệm click-through nhất quán từ watchlist/dashboard/alerts.

### P1-3 Admin operations hardening
- Mục tiêu:
  - Tăng tính vận hành: trạng thái worker/task, retry flow, hạn mức và lỗi 429/5xx UX.
- DoD:
  - Có dashboard trạng thái + hành động vận hành cốt lõi + error UX chuẩn.

### P1-9 AI Advisory Component Records + Multi-Tab Summary [NEW]
- Nguon: de xuat nang cap AI Advisory Session (2026-04-04)
- Muc tieu:
  - Chuyen AI Advisory sang mo hinh da-thanh-phan: moi goc nhin AI la mot component record rieng.
  - UI da tab tren StockDetail: moi tab hien timestamp tao, co include/exclude va nut xoa.
  - Executive Summary o ben duoi tong hop theo trong so tu cac component dang active.
- Owner: BE + FE
- DoD:
  - Co model component record + executive summary versioning.
  - Co API generate components, toggle include, soft delete, regenerate summary.
  - FE panel da tab hoat dong, summary hien so component duoc su dung.
  - Co cooldown/rate-limit cho regenerate.
- Tai lieu sprint: `docs/SPRINT17_DETAILED_PLAN.md`, `docs/SPRINT17_ACCEPTANCE_CHECKLIST.md`, `docs/TASKBOARD_SPRINT17.csv`

### ~~P1-4 Whale Volume Weighting & Avg Price~~ → **✅ DELIVERED Sprint 16**
- ~~Nguồn: Đề xuất phân tích dòng tiền nâng cao (2026-04-03)~~
- Xem: `docs/SPRINT16_DETAILED_PLAN.md`, `docs/SPRINT16_ACCEPTANCE_CHECKLIST.md`

### P1-5 Severity Tag hệ thống (Urgent/Warning/Info) [NEW]
- Nguồn: Đề xuất UX/UI nâng cao (2026-04-03)
- Mục tiêu:
  - AI Advisory hiển thị tag màu: 🔴 Urgent / 🟡 Warning / 🟢 Info dựa trên field `severity`.
  - Field `severity` đã có trong `AggregateFeedCard` — cần đồng bộ vào `WhaleAdvisory` model + AI task.
- Owner: BE + FE (nhỏ)
- DoD:
  - `WhaleAdvisory` model có field `severity` (choice: urgent/warning/info, default info).
  - OpenClaw task set severity dựa trên matched_value + threshold ratio.
  - `AdvisoryCell` hiển thị tag tương ứng.

### P1-6 Timeframe Filter cho Aggregate Feed [NEW]
- Nguồn: Đề xuất kỹ thuật (2026-04-03)
- Mục tiêu:
  - Cho phép lọc aggregate feed theo timeframe: 5p, 15p, 1h, Toàn phiên.
  - Dòng tiền 5 phút cuối phiên quan trọng hơn buổi sáng.
- Owner: BE + FE (trung bình)
- DoD:
  - BE: `getAggregateWhaleFeed` nhận param `?since=<iso_timestamp>` hoặc `?window=5m|15m|1h|session`.
  - FE: `WhaleAlertsHub` + `WhaleAdvisory` có dropdown timeframe, tự động refetch khi thay đổi.
  - Không ảnh hưởng cursor pagination hiện tại.

### ~~P1-8 Order Flow & Dark Money Detection — Sprint 15~~ → **✅ DELIVERED Sprint 15**
- ~~Nguồn: Phân tích Order Flow / Market Microstructure (2026-04-04)~~
- Xem: `docs/SPRINT15_DETAILED_PLAN.md`, `docs/SPRINT15_ACCEPTANCE_CHECKLIST.md`

### P1-7 Reversal Alert Detection [NEW]
- Nguồn: Đề xuất AI Advisory nâng cao (2026-04-03)
- Mục tiêu:
  - Celery task phát hiện dấu hiệu "rút củi đáy nồi": N lệnh BUY liên tiếp → đột ngột chuyển SELL với giá trị lớn.
  - Tạo advisory type `REVERSAL` với severity `urgent`.
- Owner: BE (Celery task)
- DoD:
  - Task `detect_whale_reversal` chạy sau mỗi batch ingest.
  - Logic: nếu symbol có ≥3 BUY trong 15p rồi xuất hiện SELL > threshold → tạo advisory.
  - Advisory type field thêm choice `REVERSAL`.
  - FE hiển thị badge "⚠ Đảo chiều" trong `AdvisoryCell`.

---

## 6) P2 — Nâng cấp nghiệp vụ trung hạn

### P2-1 Screener nâng cao
- RSI/MACD/MA cross/volume breakout và bộ lọc dựng sẵn.

### P2-2 Backtest strategy UI
- Chạy backtest và hiển thị report hiệu suất có giải thích.

### P2-3 Risk management pack
- Diversification/HHI nâng cao, VaR, stress scenarios.

### P2-4 Whale History Chart (Lịch sử dòng tiền) [NEW]
- Nguồn: Đề xuất Historical Data (2026-04-03)
- Mục tiêu:
  - Biểu đồ cột dòng tiền lớn theo ngày/tuần per symbol: gom ròng hay bán ròng.
  - Người dùng xem lại 30/60/90 ngày để đánh giá xu hướng tích lũy.
- Owner: BE + FE (trung bình)
- DoD:
  - BE: endpoint `/api/portfolio/whale-history/?symbol=XXX&days=30` aggregate từ `IntradayTick` DB.
  - FE: component `WhaleHistoryChart` dùng KlineCharts hoặc Recharts trong `WhaleAlertsDashboard`.
- Phụ thuộc: `IntradayTick` model có đủ dữ liệu lịch sử (cần verify retention policy).

### P2-5 Trading Journal tự động [NEW]
- Nguồn: Đề xuất Historical Data (2026-04-03)
- Mục tiêu:
  - AI tự ghi lại mọi khuyến nghị đã cho + outcome (giá T+1, T+3, T+5 thực tế).
  - Tính win rate per symbol cho AI: "AI từng dự báo đúng X% với mã FPT".
- Owner: BE (Celery scheduler)
- DoD:
  - Model `AdvisoryOutcome` lưu: advisory_id, price_at_signal, price_t1/t3/t5, outcome (win/loss/neutral).
  - Celery beat task cập nhật outcome sau T+1/T+3/T+5 ngày giao dịch.
  - API `/api/portfolio/advisory-winrate/?symbol=XXX` trả win rate theo symbol.
  - FE hiển thị win rate badge trong `AdvisoryCell` nếu có đủ dữ liệu (≥5 lần).
- Rủi ro: Cần nguồn giá đóng cửa chính xác — đã có `DailyPrice` model.

### P2-6 Watchlist Sync Filter cho Advisory [NEW]
- Nguồn: Đề xuất UX (2026-04-03)
- Mục tiêu:
  - Người dùng chỉ nhận advisory cho mã trong watchlist/holdings của họ.
  - Giảm noise cho user theo dõi ít mã.
- Owner: BE + FE (nhỏ-trung bình)
- DoD:
  - BE: `getWhaleAdvisories` hỗ trợ param `?watchlist_only=true`.
  - FE: Toggle "Chỉ mã đang theo dõi" trong header `WhaleAdvisory.jsx`.

---

## 7) P3 — Phụ thuộc ngoài hệ thống

### P3-1 News/events feed theo symbol
### P3-2 Brokerage integration (Copy Trade / Quick Order)
- Liên kết TCBS/SSI API để đặt lệnh trực tiếp từ AI Advisory.
- Ưu tiên thấp do rủi ro pháp lý + phụ thuộc partner API.
### P3-3 Order book/depth nâng cao theo vendor data
### P3-4 Social/community features
### P3-5 Order Flow Analysis (Sweep/Iceberg/Put-through) [NEW]
- Phân loại lệnh: quét thị trường (sweep), tảng băng (iceberg), khớp nội khối (put-through).
- **Phụ thuộc cứng**: cần tick-by-tick data với timestamp microsecond — vnstock hiện không đủ.
- Chỉ khả thi khi có FireAnt API hoặc nguồn dữ liệu level-2 market.
### P3-6 Sentiment Gauge (Tâm lý đám đông) [NEW]
- Tổng hợp tâm lý từ diễn đàn (CafeF, vndirect forum) + tin tức tài chính.
- Phụ thuộc: web scraping + NLP model tiếng Việt (underthesea/PhoBERT).
- Chỉ đưa vào sprint khi có nguồn dữ liệu sạch và stable.

> Các mục P3 chỉ đưa vào sprint khi P0/P1 ổn định và đã có nguồn dữ liệu/đối tác rõ ràng.

---

## 8) Mapping backlog vào sprint (re-baseline)

- Sprint gần nhất đã chốt: tham chiếu `docs/ROADMAP_STATUS.md`.
- **Sprint 17 (planning hiện tại)**:
  - P1-9 AI Advisory Component Records + Multi-Tab Summary.
  - P1-5 Severity Tag (ghep cung domain AI advisory de tranh phan manh).
- Sprint sau Sprint 17:
  - P1-6 Timeframe Filter cho Aggregate Feed.
  - P1-7 Reversal Alert Detection.
  - P2-4 Whale History Chart (phu thuoc IntradayTick retention du 30+ ngay).

---

## 9) Tiêu chí đưa item backlog vào sprint

1. Có owner rõ (BE/FE/QA/DevOps).
2. Có estimate theo task cụ thể.
3. Có đầu vào dữ liệu rõ và rủi ro phụ thuộc.
4. Có KPI đo được trên local/staging.
5. Không phá vỡ API contract hiện tại.
6. Có cập nhật docs đồng bộ (roadmap + execution log + checklist).
