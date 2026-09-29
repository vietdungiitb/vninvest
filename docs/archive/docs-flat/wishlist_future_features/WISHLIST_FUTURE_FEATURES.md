# VNInvest — Wishlist Tính Năng Tương Lai

> Cập nhật: 2026-04-12 | Trạng thái: Đang thu thập ý tưởng

Tài liệu này ghi nhận các ý tưởng tính năng chưa được lên sprint, không theo thứ tự ưu tiên. Mỗi mục đánh dấu độ phức tạp ước tính (S/M/L/XL) và nhóm chức năng.

---

## 1. Trải Nghiệm Người Dùng (UX / Frontend)

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| U1 | **Dark mode toàn cục** | Toggle light/dark; lưu preference vào UserConfig; apply qua CSS variables | S |
| U2 | **Bố cục dashboard tuỳ chỉnh** | Kéo-thả widget (Holdings, Whale Feed, Chart, Advisory) theo sở thích cá nhân | L |
| U3 | **Onboarding wizard** | Hướng dẫn từng bước khi đăng ký: thêm cổ phiếu đầu tiên, cài alert, chọn AI model | M |
| U4 | **Keyboard shortcuts** | Tắt/mở modal, điều hướng giữa trang, tìm kiếm mã CK nhanh bằng phím tắt | S |
| U5 | **Mobile PWA đầy đủ** | Service Worker, offline cache trang chủ + watchlist, Add-to-homescreen, push notification | L |
| U6 | **Notification center** | Bell icon tổng hợp: whale alert, advisory ready, giá chạm ngưỡng, hết quota | M |
| U7 | **Màu sắc cột P&L tuỳ chỉnh** | Cho phép user chọn bộ màu xanh/đỏ hoặc theme màu dành cho người mù màu | S |
| U8 | **Widget nhúng** | Cho phép nhúng chart hoặc price widget vào blog/trang cá nhân bằng `<iframe>` | M |

---

## 2. Phân Tích & Dữ Liệu Kỹ Thuật

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| A1 | **Screener cổ phiếu** | Bộ lọc đa tiêu chí: P/E, P/B, vốn hoá, ngành, tín hiệu kỹ thuật (RSI/MACD/BB) | L |
| A2 | **So sánh cổ phiếu** | Chart overlay so sánh hiệu suất tương đối 2–5 mã trong cùng khung thời gian | M |
| A3 | **Phân tích tương quan** | Ma trận correlation giữa các cổ phiếu trong danh mục; heat-map trực quan | M |
| A4 | **Backtesting đơn giản** | Mô phỏng chiến lược mua/bán dựa trên tín hiệu whale/RVOL trên dữ liệu lịch sử | XL |
| A5 | **Radar chart sức mạnh CP** | Đánh giá tổng hợp: kỹ thuật / cơ bản / dòng tiền / tâm lý thị trường | M |
| A6 | **Phân tích ngành** | Bảng heat-map ngành (energy/finance/tech...) theo % thay đổi ngày/tuần/tháng | M |
| A7 | **Volume profile (theo giá)** | Histogram khối lượng giao dịch theo mức giá (TPO / VPVR) trên KlineChart | L |
| A8 | **Chỉ số cơ bản (Fundamental)** | EPS, ROE, ROA, Nợ/Vốn chủ lấy từ BCTC; hiển thị cạnh chart | M |
| A9 | **Calendar sự kiện** | Lịch chia cổ tức, ĐHCĐ, ngày giao dịch không hưởng quyền | M |

---

## 3. AI Advisory & Robo-Advisor

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| AI1 | **Advisory đa tài sản** | Mở rộng advisory sang ETF, trái phiếu, tiền gửi để tư vấn phân bổ toàn danh mục | L |
| AI2 | **Mục tiêu tài chính** | User nhập mục tiêu (VD: "tích luỹ 500M trong 3 năm"); AI gợi ý lộ trình phân bổ | L |
| AI3 | **Advisory kể chuyện (narrative)** | AI viết bản tin thị trường cá nhân hoá hàng ngày theo danh mục user | M |
| AI4 | **Sentiment analysis tin tức** | Phân tích tâm lý từ OpenNews/CafeF/VNDIRECT API; tích hợp vào advisory context | L |
| AI5 | **AI chat trực tiếp** | Hộp chat "Hỏi AI về VNM" kết hợp lịch sử advisory + dữ liệu realtime | XL |
| AI6 | **RAG trên báo cáo phân tích** | Index BCTC + báo cáo phân tích → AI trả lời câu hỏi có nguồn dẫn chứng | XL |
| AI7 | **Advisory theo profile rủi ro** | User chọn risk appetite (conservative/moderate/aggressive); advisory tự điều chỉnh tone | M |
| AI8 | **Auto-rebalance gợi ý** | Khi danh mục lệch target allocation, AI đề xuất lệnh mua/bán tái cân bằng | L |

---

## 4. Whale Alert & Dòng Tiền Tối

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| W1 | **Whale network graph** | Đồ thị mạng lưới: các mã CP có dòng tiền tương đồng cùng ngày/giờ | L |
| W2 | **Lịch sử điểm vào cá mập** | Chart đánh dấu các điểm có whale buy/sell signal quan trọng trên lịch sử giá | M |
| W3 | **Alert theo nhóm cá mập** | Theo dõi "basket" nhiều mã; cảnh báo khi nhiều mã cùng nhóm đồng thời có tín hiệu | M |
| W4 | **Dark money trend** | Dashboard đường cong tổng dark flow strength theo ngành/chỉ số VN-Index theo thời gian | M |
| W5 | **Whale leaderboard** | Bảng xếp hạng mã CP có tổng khối lượng whale cao nhất tuần/tháng | S |
| W6 | **Xác nhận sau tín hiệu** | Cơ chế backtesting nhẹ: sau N ngày check lại xem tín hiệu whale có đúng hướng không | L |

---

## 5. Danh Mục & Quản Lý Rủi Ro

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| P1 | **Multi-portfolio** | Tạo nhiều danh mục riêng biệt (VD: "Dài hạn", "Short-term", "Paper trading") | M |
| P2 | **Import giao dịch từ CTCK** | Upload CSV/Excel từ sàn SSI/VCSC/TCBS → tự động tạo holdings | M |
| P3 | **Tính thuế TNCN ước tính** | Tự động ước tính thuế chuyển nhượng 0.1% mỗi giao dịch thực hiện | S |
| P4 | **Phân tích attribution** | Đóng góp lợi nhuận theo từng mã và ngành vào total return danh mục | M |
| P5 | **Cảnh báo drawdown** | Thông báo khi danh mục vượt ngưỡng drawdown user cài (VD: -10%) | S |
| P6 | **Paper trading mode** | Giao dịch giả lập không dùng tiền thật; tracking lịch sử và P&L ảo | L |
| P7 | **Stoploss / Take-profit tự động** | User cài ngưỡng SL/TP cho từng mã; hệ thống cảnh báo khi chạm giá | M |
| P8 | **Benchmark so sánh** | So sánh hiệu suất danh mục với VN-Index, VN30, VNMID | M |

---

## 6. Cộng Đồng & Xã Hội (Social)

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| S1 | **Chia sẻ watchlist công khai** | User có thể public watchlist dưới dạng link read-only | S |
| S2 | **Copy trading đơn giản** | Follow một portfolio công khai; nhận alert khi người đó mua/bán | XL |
| S3 | **Bình luận trên chart** | Đánh dấu và ghi chú trên chart; chia sẻ annotation với cộng đồng | L |
| S4 | **Forum / thảo luận theo mã CP** | Thread bình luận nhẹ gắn theo mỗi mã CK; upvote/downvote | L |
| S5 | **Leaderboard P&L cộng đồng** | Bảng xếp hạng user (tuỳ chọn ẩn danh) theo % lợi nhuận trong tháng | M |

---

## 7. Vận Hành & Hạ Tầng

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| O1 | **Observability dashboard tích hợp** | Grafana/Prometheus embedded hoặc lightweight custom metrics UI trong AdminOps | L |
| O2 | **Distributed tracing** | OpenTelemetry traces cho Celery task → API → DB để debug latency | L |
| O3 | **Horizontal Celery scaling** | Auto-scale worker count theo queue depth trên Kubernetes/Nomad | XL |
| O4 | **Multi-region cache** | Redis Cluster hoặc Redis Sentinel cho HA; failover tự động | L |
| O5 | **API rate limiting per-tier** | Nginx/Django middleware throttling khác nhau cho Community/Pro/Enterprise | M |
| O6 | **Audit log tập trung** | Log mọi thay đổi dữ liệu nhạy cảm (settings, transactions) vào bảng AuditLog | M |
| O7 | **Automated DB backup** | Cronjob pg_dump hàng ngày; upload S3; test restore định kỳ | M |
| O8 | **Zero-downtime migration** | CI/CD pipeline chạy migration an toàn với expand/contract pattern | L |

---

## 8. Bảo Mật & Tuân Thủ

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| SEC1 | **2FA (TOTP)** | Xác thực 2 lớp bằng Google Authenticator / Authy | M |
| SEC2 | **Session quản lý thiết bị** | Xem danh sách thiết bị đang đăng nhập; revoke từng session | M |
| SEC3 | **IP allowlist cho admin** | Giới hạn truy cập /admin/ và AdminOps chỉ từ IP whitelist | S |
| SEC4 | **Mã hoá API key tại tầng DB** | Rotate encryption key cho `ai_api_key` mà không downtime | M |
| SEC5 | **Tuân thủ PDPA/GDPR cơ bản** | Export/delete dữ liệu cá nhân theo yêu cầu; chính sách lưu trữ | M |
| SEC6 | **Penetration testing checklist** | Tài liệu hoá surface attack, chạy OWASP ZAP định kỳ trong CI | M |

---

## 9. Tích Hợp Bên Ngoài

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| I1 | **Telegram / Zalo bot** | Push whale alert, advisory digest, giá chạm ngưỡng qua Telegram/Zalo OA | M |
| I2 | **Webhook ra ngoài** | User cài URL webhook; hệ thống POST event khi có alert (tích hợp Zapier/Make) | M |
| I3 | **Tích hợp CTCK order gateway** | Gửi lệnh thật qua API CTCK (SSI iBoard, TCBS...) từ giao diện VNInvest | XL |
| I4 | **Google Sheets sync** | Export danh mục + P&L tự động vào Google Sheets để phân tích ngoài | M |
| I5 | **TradingView chart embed** | Cho phép dùng TradingView widget thay cho chart nội bộ (tuỳ chọn) | S |
| I6 | **SSO (Google / Facebook)** | Đăng nhập bằng OAuth2 social accounts | M |
| I7 | **Tích hợp dữ liệu FiinPro/Vietstock** | Nguồn dữ liệu thay thế / bổ sung để tăng độ phủ và độ tin cậy | L |

---

## 10. Monetisation & Tăng Trưởng

| # | Tính năng | Mô tả | Độ phức tạp |
|---|---|---|---|
| M1 | **Subscription checkout tích hợp** | Luồng mua Pro/Enterprise qua Stripe/VNPay trực tiếp trong app | L |
| M2 | **Referral program** | Mã giới thiệu; tracking commission; tự động credit tháng Pro | M |
| M3 | **Trial Pro tự động** | 14 ngày dùng thử Pro sau đăng ký; xuống Community tự động khi hết | S |
| M4 | **Analytics sử dụng nội bộ** | Dashboard admin: DAU/MAU, feature adoption, churn, revenue MRR | L |
| M5 | **White-label cho đối tác** | Tách theme + logo cho CTCK hoặc quỹ đầu tư dùng riêng | XL |

---

## Ghi Chú

- Wishlist **không** là cam kết sprint. Các mục cần đánh giá kỹ trước khi lên kế hoạch.
- Độ phức tạp: **S** = 1–3 ngày, **M** = 1–2 tuần, **L** = 3–6 tuần, **XL** = nhiều sprint.
- Để đề xuất thêm, chỉnh sửa file này trực tiếp hoặc tạo issue trên GitHub.
- Thứ tự ưu tiên thực tế sẽ được chốt trong từng sprint planning session.
