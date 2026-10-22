# Competitive Benchmark — VNInvest vs. VN Retail Brokers / Global Platforms / Institutional Terminals

**Ngày:** 2026-10-21 · **Trạng thái:** Doc-only (chưa claim ledger, chưa commit) · **Nguồn:** web research trực tiếp 2026-10-21

---

## 0. Quy ước & phương pháp

| Mã | Ý nghĩa |
|---|---|
| **[V]** | **Xác minh từ trang chính thức** (product page / pricing page / docs chính thức của nhà cung cấp) |
| **[T]** | **Suy luận từ nguồn thứ ba** (review site, blog, press release của bên thứ ba) — cần kiểm chứng lại trước khi dùng cho quyết định |
| **[R]** | **Suy luận sản phẩm của tôi** (reasoning, không có nguồn) — đề xuất/giả thuyết, không phải sự thật đã kiểm chứng |
| **CHƯA XÁC MINH** | Chưa tìm được nguồn chính thức; **không suy diễn** |

**Quy ước cột "VNInvest" trong ma trận A:** dựa **duy nhất** trên context do owner cung cấp (không re-audit repo). Ký hiệu:
- `✓` = context nêu rõ có
- `✗` = context nêu rõ không có
- `?` = context **không nhắc** → chưa biết, cần verify trong code (KHÔNG coi là thiếu)

**Tỷ giả giả định để quy đổi USD↔VND:** `1 USD ≈ 26.000 đ` — **[R] giả định làm việc, CHƯA XÁC MINH từ nguồn chính thức**. Mọi con số USD trong báo cáo là số USD gốc từ nguồn, chỉ phần quy đổi là giả định.

---

## 0.1. Tóm tắt điều hành — 5 phát hiện quan trọng nhất

1. **Khoảng trống lớn nhất KHÔNG phải "thêm tính năng" — mà là "AI có mặt trong workflow".** Cả 4 lớp đối thủ đều đã ship AI assistant nhúng trong app: FireAnt Copilot/AI Answer **[V]**, TradingView AI Copilot **[V]**, moomoo AI Assistant **[V]**, Webull Vega **[T]**, Robinhood Cortex Assistant **[V]**, eToro Tori **[V]**, Mirae Mira-bot **[V]**, TCBS "AI phân tích" **[V]**. VNInvest có *AI advisory* (multi-provider LLM) nhưng context **không mô tả** một trợ lý hội thoại/ngữ cảnh. Đây là khoảng trống cấp sản phẩm số 1.
2. **Khoảng trống cấp 2 = natural-language → screener.** FireAnt "Lọc AI" (Chuyên Nghiệp/Cao Cấp) **[V]** và TradingView AI Screener (public beta, mọi gói trả phí, 100–500 request/tháng) **[V]**. Đây là feature có **paywall đã được chứng minh bằng hành vi mua** ở cả 1 lớp trong nước và 1 lớp quốc tế.
3. **B2B/white-label là khoảng trống "không có đối thủ trong nước".** Webull Institutional (Broker API, omnibus + omnibus-anonymized sub-accounts) **[V]**, Koyfin Teams/Advisor (custodian integration, client reports) **[V]**, TradingView Enterprise (100+ seats) **[V]**, eToro App Store + Builders' Portal API **[V]**. Trong VN: chỉ có **BSC Open API** (OAuth2.0, đối tác FireAnt/vStock/DATX) **[V]** và **FireAnt API** cho tổ chức **[V]** — chưa có "platform SaaS cho broker + advisor + quant" thực sự. VNInvest đã có multi-tenant + PAT + service account + partner API ⇒ **đây là lợi thế sẵn có, chưa được đóng gói thành sản phẩm bán được**.
4. **Đối thủ quốc tế đã đẩy AI execution xuống tầng retail** (Robinhood Agents, moomoo API Skills/MCP, eToro agent portfolios) **[V]**, còn đối thủ VN mới dừng ở "AI phân tích/chat". Nghĩa là cửa sổ cạnh tranh cho **AI-assisted order placement có guardrail** vẫn mở trong VN.
5. **Bảng giá VN có "sàn" rất thấp và "trần" rất cao, còn khoảng giữa trống.** FireAnt (data/analysis) 12 tháng: 1,43tr / 3,83tr / 5,75tr **[V]**; TradingView Essential→Ultimate: $12,95–$199,95/tháng **[V]**; Koyfin $39/$79/$209/$299 **[T]**; Bloomberg $31.980/năm **[T]**. VNInvest chưa có hệ giá công khai — cần đóng gói tier trong §D.

---

# PHẦN 1 — MA TRẬN TÍNH NĂNG THEO LỚP ĐỐI THỦ

## 1.1. Lớp 1 — Broker retail Việt Nam

### 1.1.1. VNDIRECT (DBOARD / DTRADE / DSTOCK / PROTRADE / MYDGO)

| Nhóm | Tính năng (chi tiết) | Nguồn |
|---|---|---|
| Market data | Bảng giá đa tài sản realtime; DTRADE có widget **Độ sâu thị trường** + Sổ lệnh + Biểu đồ; cột bảng giá tùy chỉnh; nhóm mã (VN30/HOSE/Phái sinh/Chứng quyền) | [DBOARD](https://www.vndirect.com.vn/dboard/) · [DTRADE FAQ](https://support.vndirect.com.vn/hc/vi/articles/63304006470681-FAQ-về-nền-tảng-giao-dịch-DTRADE) |
| Charting | Đồ thị ngay trên bảng giá, cập nhật theo phút; đồ thị phái sinh + VN30 realtime cùng lúc | [DPLATFORM](https://www.vndirect.com.vn/cong-giao-dich-dplatform) |
| Screening | **Bộ lọc cổ phiếu** tích hợp trên bảng giá; "Tiêu điểm thị trường" = Top theo giá trị GD, thỏa thuận đột biến, khối ngoại, tự doanh, cổ tức, quỹ mở nắm giữ, hiệu quả 3 ngày | [Tiêu điểm thị trường](https://www.vndirect.com.vn/xem-thong-tin-tieu-diem-thi-truong-chung-khoan-o-dau/) · [Tiêu chí chọn cổ phiếu](https://www.vndirect.com.vn/cac-yeu-to-de-lua-chon-co-phieu-tieu-diem/) |
| Alerts | Cảnh báo biến động giá **tự động** với đa dạng điều kiện; Market Watch toàn cảnh | [DGO](https://dautu.vndirect.com.vn/dgo/) |
| Fundamental | Tra cứu sức khỏe cổ phiếu "đa chiều"; **DRATING** — bộ chỉ số đánh giá sức khỏe tài chính doanh nghiệp "độc quyền" | [DSTOCK](https://dautu.vndirect.com.vn/dstock/) |
| Portfolio | MYDGO: quản lý tài sản đa kênh, **phân bổ tài sản + tài khoản chuyên biệt theo mục tiêu**; DGO Compass (vị thế đầu tư/thị trường/cơ hội từ onboarding) | [DGO](https://dautu.vndirect.com.vn/dgo/) |
| Execution | DTRADE widget kéo-thả, **liên kết màu** giữa các widget, đặt lệnh/hủy lệnh **1 chạm** (bỏ bước xác nhận), 6 template workspace, chụp ảnh workspace; DPLATFORM có **DMA** (giao dịch cộng đồng nhóm) | [DTRADE FAQ](https://support.vndirect.com.vn/hc/vi/articles/63304006470681-FAQ-về-nền-tảng-giao-dịch-DTRADE) · [DPLATFORM](https://www.vndirect.com.vn/cong-giao-dich-dplatform) |
| Paper trading | **PROTRADE Trial** — giao dịch phái sinh ảo, dữ liệu khớp với bảng giá thực tế | [DPLATFORM](https://www.vndirect.com.vn/cong-giao-dich-dplatform) · [DTA](https://www.vndirect.com.vn/dta/) |
| Social | **Stockbook** — cộng đồng chuyên gia & nhà đầu tư; **La Bàn giao dịch** (bản tin + nhận định chuyên gia) | [DTA](https://www.vndirect.com.vn/dta/) · [DGO](https://dautu.vndirect.com.vn/dgo/) |
| AI | "VNDSTOCK **Trí tuệ cổ phiếu**" — marketing copy trên DGO; "Tiêu điểm thị trường" được mô tả là *"cung cấp trí tuệ cổ phiếu"*. ⚠️ **Không tìm thấy tài liệu chính thức mô tả AI tổng quát/LLM** | [DGO](https://dautu.vndirect.com.vn/dgo/) · [Tiêu điểm](https://www.vndirect.com.vn/xem-thong-tin-tieu-diem-thi-truong-chung-khoan-o-dau/) |
| Risk | "Công cụ căn bán theo sức mua" — cảnh báo tỷ lệ cảnh báo / force sell; Margin T10/T15 lãi từ 0%, Deal Financing | [DGO](https://dautu.vndirect.com.vn/dgo/) · [DSTOCK](https://dautu.vndirect.com.vn/dstock/) |
| B2B / data | DPLATFORM cho tổ chức: nền tảng chuyên nghiệp + **giao dịch cộng đồng nhóm**; giao dịch ngân hàng trực tuyến 9 ngân hàng | [DPLATFORM](https://www.vndirect.com.vn/cong-giao-dich-dplatform) |
| Giá | DTA: cổ phiếu online **0,10%/GTGD**; phái sinh trả Sở 2.700/4.500đ/HĐTL; bù trừ 2.550đ; quản lý tài sản ký quỹ 0,0024% (min 100k/max 1,6tr); lưu ký miễn phí + phí VSDC | [Biểu phí DTA](https://www.vndirect.com.vn/bieu-phi-tai-khoan-da/) |
| Mobile | iOS/Android song song, OTP trong app, eKYC 5 phút, chat/gọi chuyên viên miễn phí; app mới dự kiến 2027 | [DBOARD](https://www.vndirect.com.vn/dboard/) · [DTRADE FAQ](https://support.vndirect.com.vn/hc/vi/articles/63304006470681-FAQ-về-nền-tảng-giao-dịch-DTRADE) |

### 1.1.2. SSI iBoard (Web + iBoard Pro)

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| Charting | **Tích hợp biểu đồ TradingView** ngay trong priceboard; có thể mở rộng chart; 4 theme (Light/Dark/Classic/Dark OLED) | [User Guide i-Board (PDF)](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) |
| Market data | Price depth (độ sâu), Time & Sale; tab hồ sơ: Profile / Shareholders / **Capital & Dividend** / News / **Entitlement** / Statistics / **Finance**; chọn index (VN30/HNX30/VNXALL…); tùy chỉnh cột **theo từng sàn** | [User Guide i-Board (PDF)](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) |
| Portfolio | Portfolio Full/Compact, lọc theo account/symbol, "Sell all" toàn bộ, sửa khối lượng/giá khi bán; đảo vị thế / đóng vị thế bằng lệnh điều kiện OCO (phái sinh) | [User Guide i-Board (PDF)](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) |
| Execution | 2 giao diện: **Normal** & **Quick (Speed) trade**; **Auto-price** (Buy = Best Ask + Toler, Sell = Best Bid − Toler); **bỏ qua bước xác nhận (1-click)**; sửa/hủy/hủy-nhiều lệnh | [Place orders iBoard Pro](https://www.ssi.com.vn/en/individual-customer/place-orders-on-equity-market-ib-app-pro) · [User Guide](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) |
| **Conditional orders** (mạnh nhất trong lớp VN) | **Up/Down**, **OCO** (take-profit + stop-loss kèm Toler), **Bull & Bear** (3 lệnh tổ hợp), **T.Up** (trailing buy), **T.Down** (trailing sell) — cho phái sinh | [User Guide i-Board (PDF)](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) |
| Watchlist | Watchlist riêng, pin mã lên đầu bảng giá, Top Stock, cảnh báo | [User Guide i-Board (PDF)](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) |
| Security | PIN, SMS OTP, Email OTP, Smart OTP, **Certificate Authentication (CA)**; quản lý thiết bị tin cậy | [User Guide i-Board (PDF)](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) |
| S-Products | Trái phiếu (SBond) — giao dịch theo kỳ hạn; S-Products (fixed income & khác) trên app | [User Guide i-Board (PDF)](https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf) · [App Store](https://apps.apple.com/us/app/ssi-iboard-pro/id6444309036) |
| Giá | Có chuyên viên: 0,25% (<100tr/ngày) · 0,30% (100–500tr) · 0,25% (≥500tr); phái sinh 3.000/2.000/1.000đ theo bậc; HNX 2.700/4.500đ; VSDC 2.550đ; 0,0024% tài sản ký quỹ; **công cụ giao dịch miễn phí phí nếu không dùng môi giới** | [Biểu giá SSI](https://www.ssi.com.vn/khach-hang-ca-nhan/bieu-phi/bieu-gia-dich-vu-giao-dich-chung-khoan) · [FAQ dịch vụ](https://www.ssi.com.vn/khach-hang-ca-nhan/dich-vu-giao-dich-faq) |
| Mobile | iBoard Pro iOS/Android, 166,1 MB, miễn phí, cập nhật UX ~2 tuần/lần (2.9.10) | [App Store](https://apps.apple.com/us/app/ssi-iboard-pro/id6444309036) |

### 1.1.3. FireAnt (media/data + FireAnt Trading)

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá & tier (chuẩn benchmark VN cho sub data/analysis)** | **Thiết Yếu** 1.429.000đ/12th · **Chuyên Nghiệp** 3.830.000đ/12th · **Cao Cấp** 5.750.000đ/12th (tương đương 3.969 / 10.639 / 15.972 đ/ngày); giảm 6% (6th), 16% (12th), 32% (24th); **không có chương trình dùng thử** | [Bảng giá FireAnt](https://company.fireant.vn/bang-gia) · [Help Center](https://help.fireant.vn/) |
| **AI (mạnh nhất lớp VN)** | **Lọc AI** (mô tả ý tưởng bằng ngôn ngữ tự nhiên → bộ điều kiện lọc); **FireAnt Copilot** (hỏi đáp cổ phiếu, tóm tắt dữ liệu, bối cảnh thị trường); **AI Answer** (hỏi đáp + phân tích có cấu trúc theo ngữ cảnh); **AI Report** (tạo báo cáo + slide phân tích từ dữ liệu FireAnt — *chỉ Cao Cấp*); **AI Video Slideshow** (tạo video tài chính — *chỉ Cao Cấp*); **Quant AI** (sinh mã AFL: bộ lọc, backtest, chỉ báo từ yêu cầu tiếng Việt) | [Bảng giá FireAnt](https://company.fireant.vn/bang-gia) |
| Screening | Bộ lọc tiêu chuẩn (định giá, tăng trưởng, hiệu quả, thanh khoản), **lọc nâng cao** (tự kết hợp nhiều nhóm điều kiện), lưu bộ lọc, RRG, Z-Score, F-Score, **Dupont** (chỉ Chuyên Nghiệp/Cao Cấp) | [Bảng giá FireAnt](https://company.fireant.vn/bang-gia) |
| Charting | Biểu đồ PTKT + **chỉ báo độc quyền FireAnt** (bộ tín hiệu mua/bán, trạng thái xu hướng), **sự kiện trên biểu đồ** (giao dịch cổ đông chính, báo cáo tài chính, cổ tức), **lưu/nạp Workspace**, nhiều tab phân tích; Intraday cổ phiếu 12 tháng, **Intraday phái sinh 1/3/12 tháng theo tier** | [Bảng giá](https://company.fireant.vn/bang-gia) · [Compare](https://corporate.fireant.vn/Home/Compare) |
| Fundamental | Báo cáo tài chính, chỉ số hoạt động, cơ cấu doanh thu, định giá, **trái phiếu**, **chi tiết cơ cấu dòng tiền**; >30 chỉ số tài chính (PE, EPS, ROA, ROE) trên biểu đồ | [Bảng giá](https://company.fireant.vn/bang-gia) · [Compare](https://corporate.fireant.vn/Home/Compare) |
| Alerts | "Cảnh báo tín hiệu" (đạt điều kiện mua/bán); Chuyên Nghiệp: cảnh báo tùy biến sâu theo tiêu chí kỹ thuật; Cao Cấp: thêm tiêu chí cơ bản | [Bảng giá](https://company.fireant.vn/bang-gia) |
| **Export / quant integration** | **FireAnt for Excel** (Excel Add-in: dữ liệu doanh nghiệp/tài chính/giao dịch/intraday — *chỉ Cao Cấp*); **FireAnt for AmiBroker/MetaKit (MetaKit 6)**: EOD/phút/tick realtime, dữ liệu dòng tiền (NN/TD/AC/CC), chỉ tiêu cơ bản, ngành ICB, chỉ số tự tạo, **Quant AI Studio sinh AFL từ tiếng Việt + chạy backtest ngay**, **giả định thị trường VN trong backtest** (phí 2 chiều, thuế bán 0,1%, lô 100, nắm giữ tối thiểu T+2,5, khớp giá mở cửa phiên kế tiếp), xuất CSV | [MetaKit 6](https://company.fireant.vn/services/individual/metakit) · [Hướng dẫn AFL](https://metakit.fireant.vn/help/v6/amibroker/du-lieu-trong-afl.html) |
| Trading (FireAnt Trading) | CK HOSE/HNX/UPCoM qua CK cấp phép; **hàng hóa phái sinh qua MXV**; **chứng chỉ quỹ qua FMarket**; 4 thẻ: Tổng hợp / **Sổ lệnh (độ sâu 5 mức)** / **Mức giá (volume profile giá)** / **Thống kê (mua ròng nước ngoài, biểu đồ 10 phiên)**; chi tiết lệnh có **tỷ lệ khớp** | [FireAnt Trading hướng dẫn](https://trading.fireant.vn/huong-dan/) |
| Broker integration | Mở tài khoản + nộp tiền + **đặt lệnh trực tiếp trên app FireAnt** (Shinhan Securities, 05/2025) | [Shinhan × FireAnt](https://shinhansec.com.vn/en/customer-support/event-promotion/114/shinhan-securities-vietnam-and-fireant-integrate-stock-account-opening-and-trading-directly-on-the-fireant-app.html) |
| B2B / API | **FireAnt API** — *"nhà cung cấp giải pháp thông tin, dữ liệu tài chính cho nhà đầu tư và tổ chức"*; đối tác: SSI, BSC, VCBS, CSI; tích hợp đồ thị TradingView trong phần biểu đồ PTKT | [api.fireant.vn](https://api.fireant.vn/) · [Đối tác](https://company.fireant.vn/partner) |
| Social | Hỗ trợ trực tiếp chuyên gia qua Zalo 083.844.1234; kho khóa học phân tích cơ bản (Thiết Yếu) → toàn bộ khóa (Chuyên Nghiệp+) | [Bảng giá](https://company.fireant.vn/bang-gia) · [Help Center](https://help.fireant.vn/) |
| Quy mô | >3 triệu nhà đầu tư VN | [m.fireant.vn](https://m.fireant.vn/) |

### 1.1.4. TCBS

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| Derivatives platform | **iFuture**: ~20 đồ thị realtime (chỉ số phái sinh + chỉ số kỹ thuật + cổ phiếu ảnh hưởng VN30) cùng màn hình; bộ lệnh **đóng vị thế, đảo vị thế, đóng tại điểm hòa vốn, liên hoàn lệnh**; cửa sổ đặt lệnh **nằm trên biểu đồ** | [iFuture](https://www.tcbs.com.vn/ca-nhan/chung-khoan-phai-sinh-ifuture/) |
| **Công cụ phái sinh chuyên biệt** | **Hedging** (bảo vệ danh mục cơ sở bằng phái sinh), **Synthetic Portfolio** (giả lập danh mục cổ phiếu bằng HĐTL), **Arbitrage** (chênh lệch VN30 vs HĐTL) | [iFuture](https://www.tcbs.com.vn/ca-nhan/chung-khoan-phai-sinh-ifuture/) |
| **AI** | **Công cụ AI PHÂN TÍCH** — *"AI của TCBS luôn đồng hành… phân tích cơ bản, phân tích kỹ thuật cho tới đề xuất chiến lược mua bán"* | [Mở tài khoản CK](https://www.tcbs.com.vn/mo-tai-khoan-giao-dich-co-phieu-tai-tcbs) |
| Backtest / Valuation | **Công cụ BACKTEST CHIẾN LƯỢC** (chiến lược có sẵn: bùng nổ khối lượng, RSI quá bán, giá giảm 15%, uptrend — hoặc tự xây); **Công cụ ĐỊNH GIÁ CỔ PHIẾU** (DCF, P/E, P/B, Graham) | [Mở tài khoản CK](https://www.tcbs.com.vn/mo-tai-khoan-giao-dich-co-phieu-tai-tcbs) |
| Social / copy | **iTrader** — sao chép lệnh của iTrader khác, nhận "Phí thông tin" + "Phí hiệu quả đầu tư" trả 15/ngày bằng iXu; whitelist HĐTL VN30 đáo hạn gần nhất | [iTrader](https://help.tcbs.com.vn/hoi-nhanh-dap-hay/icopy/icopy-phai-sinh/itrader/) |
| Margin | Margin T+ lãi từ 0%/năm; **Dynamic Margin** 0,5%/năm 30 ngày đầu; Marginsure giảm 3%/năm nếu giá đóng cửa < giá vốn; giải ngân 7,89%/năm 180 ngày | [Mở tài khoản CK](https://www.tcbs.com.vn/mo-tai-khoan-giao-dich-co-phieu-tai-tcbs) |
| Giá | **Zero Fee** (cổ phiếu cơ sở, phái sinh, chứng quyền, CCQ niêm yết — chỉ 0,03% trả Sở); phái sinh trả Sở 2.700/4.500đ; VSDC 2.550đ; tài sản ký quỹ 0,0024% (100k–1,6tr); nộp/rút ký quỹ 11.000đ | [Mở tài khoản CK](https://www.tcbs.com.vn/mo-tai-khoan-giao-dich-co-phieu-tai-tcbs) · [Biểu phí phái sinh](https://help.tcbs.com.vn/bieu-phi-giao-dich-chung-khoan-phai-sinh/) |

### 1.1.5. Vietcap

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| Trading app | **VCI Mobile S**: giao dịch realtime tần suất cao, **nhiều loại lệnh điều kiện**, xác thực OTP/Smart OTP, cho vay ký quỹ tự động, theo dõi danh mục + phân tích tài chính | [Google Play](https://play.google.com/store/apps/details?hl=vi&id=com.vcsc.vietcap) · [Vietcap EN](https://www.vietcap.com.vn/en) |
| Desktop | **V-Pro** — phần mềm desktop: quản lý nhiều màn hình/nhóm MH/màn hình ảo, bảng giá tổng hợp 3 sàn, **thống kê chứng khoán theo điều kiện**, thông tin ETF, đồ thị PTKT đa dạng, lệnh đặt trước/mua/bán/hủy/sửa, ứng trước tiền bán, đăng ký mua PHT | [Giới thiệu Vietcap Pro](https://www.vietcap.com.vn/huong-dan-chung/gioi-thieu-vietcap-pro) |
| Giá | Có chuyên viên: từ 0,15%/GTGD; **không chuyên viên: 0,1%/GTGD**; phái sinh 2.700/4.500đ + bù trừ 2.550đ + **phí Vietcap 1.000–5.000đ/HĐ theo bậc**; ký quỹ 0,0024%; ký quỹ 0,037%/ngày; lưu ký 0,3đ/cp-CCQ/tháng; SMS/ZNS 11.000đ/tháng | [Biểu phí dịch vụ](https://www.vietcap.com.vn/huong-dan-chung/bieu-phi-dich-vu) |
| AI | **CHƯA XÁC MINH** — không tìm thấy tài liệu chính thức mô tả tính năng AI của Vietcap | — |

### 1.1.6. Mirae Asset (VN)

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| Mobile | **M-STOCK** (thay My Asset từ 10/04/2026): quản trị danh mục thông minh, thông báo thông minh **cá nhân hóa bởi AI** theo hành vi & sở thích | [M-STOCK ra mắt](https://masvn.com/article/mo-ra-phong-cach-dau-tu-moi-m-stock-206547) · [Ngừng My Asset](https://masvn.com/article/thong-bao-ngung-hoat-dong-ung-dung-my-asset-tu-10042026-va-chuyen-doi-sang-m-stock-750683) |
| **AI** | **Mira-bot** — trợ lý AI 24/7: giải đáp thắc mắc, cung cấp thông tin thị trường, hướng dẫn dùng app; **AI News** — tổng hợp & phân tích tin tức realtime | [M-STOCK ra mắt](https://masvn.com/article/mo-ra-phong-cach-dau-tu-moi-m-stock-206547) |
| Social | **Chatroom** — kết nối trực tiếp đội ngũ chuyên viên tư vấn | [M-STOCK ra mắt](https://masvn.com/article/mo-ra-phong-cach-dau-tu-moi-m-stock-206547) |
| Platforms | M-STOCK (mobile), **MAStrade** (web), **HTS** (home trading, tuỳ biến từ phần mềm Mirae Asset Korea, cho nhà đầu tư giao dịch tần suất lớn); có hướng dẫn **Conditional Order trong MAStrade** | [e-trading](https://www.masvn.com/en/e-trading) |
| Giá | **Zero Fee** 01/04–30/06/2026 cho tài khoản mới X1/M1, kênh chủ động, **không chuyên viên** (3 tháng liên tục, không gồm phí Sở/VSDC) | [Chương trình ưu đãi](https://masvn.com/article/chuong-trinh-uu-dai-mien-phi-giao-dich-1043550) |

### 1.1.7. Nhóm "Open API cho broker VN" (mới, đáng chú ý)

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| Open API | **BSC Open API**: NĐT kết nối tra cứu + **thực hiện giao dịch** từ tài khoản BSC trên nền tảng của đối tác (**Fireant, vStock, DATX**); xác thực **OAuth 2.0**; đối tác cung cấp thông tin chứng khoán chuyên sâu (Stockbiz) | [BSC Open API](https://new.bsc.com.vn/san-pham-moi/open-api-gioi-thieu-san-pham) |

---

## 1.2. Lớp 2 — Nền tảng giao dịch quốc tế

### 1.2.1. TradingView (de facto chuẩn ngành cho analytics)

| Nhóm | Tính năng (số liệu từ trang pricing chính thức) | Nguồn |
|---|---|---|
| **Bảng giá tier** | Basic $0 (trọn đời, không cần thẻ) · Essential **$12,95/tháng** (trả năm) / $14,95 (tháng) · Plus **$29,95** / $34,95 · Premium **$59,95** / $69,95 · Ultimate **$199,95** / $239,95. Trial 30 ngày (Ultimate 14 ngày). **Chỉ Ultimate dành cho professional users**. **Enterprise: 100+ subscriptions → liên hệ sales** | [Pricing](https://www.tradingview.com/pricing/) · [ChartWatch](https://chartwatch.tv/tradingview-plans) |
| Charting | 400+ indicator built-in + **100.000+ indicator cộng đồng**; 110+ drawing tool; indicator-on-indicator; **Pine Script**; 21 loại chart; **Bar Replay** (giao dịch trong replay); Intraday Renko/Kagi/Line Break/Point&Figure; **interval theo giây & tick**; dividend-adjusted chart; **corporate actions tương tác**; lịch sử phút 180 ngày→All, giây All, tick 7 ngày | [Pricing](https://www.tradingview.com/pricing/) · [Features](https://www.tradingview.com/features/) |
| Orderflow | **Volume Profile indicators**, **Time Price Opportunities**, **Volume footprint**, Volume candles, TPO (Premium+) | [Pricing](https://www.tradingview.com/pricing/) |
| Screening | 6 screener (stock, bond, ETF, crypto coin, CEX, DEX); 150+ sàn / 50+ quốc gia; **500+ field**; **Pine Screener**; Bond Screener; auto-refresh 10s/1ph; screener **chart view** có SMA/EMA 50/200 (từ 2026-09-11) | [Features](https://www.tradingview.com/features/) · [Pricing](https://www.tradingview.com/pricing/) · [Screener chart view](https://www.tradingview.com/blog/en/screener-chart-view-indicators-60757/) |
| Heatmap | Heatmap theo sector, filter, custom heatmap chia sẻ, quick stats | [Features](https://www.tradingview.com/features/) |
| Portfolio | Số portfolio: 1/3/4/5/7; holdings 20/50/75/100/150; giao dịch 2.000/5.000; **kết nối broker qua Plaid: 3 tài khoản** (Essential+) | [Pricing](https://www.tradingview.com/pricing/) |
| Alerts | Price alerts 3/20/100/400/1.000; **technical alerts** 0/20/100/400/1.000; **watchlist alerts** 0/0/0/2/15; hết hạn 1–2 tháng (Premium/Ultimate **không hết hạn**); **webhook** (từ Essential **[T]**); multi-condition; alerts on financial metrics | [Pricing](https://www.tradingview.com/pricing/) · [MoneyFlock (T)](https://www.moneyflock.com/contents/articles/tradingview-pricing-2026-plans-costs-limits) |
| **AI Copilot** | **Add-on riêng $7,50/tháng [T]**, chỉ trên gói trả phí, web + desktop (**không có mobile**); giới hạn token/tháng, không rollover; làm được: setup chart bằng lời; vẽ hỗ trợ/kháng cự & pattern; TA đa khung; đọc cơ bản; tin + sentiment + macro; **sàng lọc NL**; **sinh Pine Script + tối ưu + đọc backtest**; **quản lý watchlist + tạo/sửa/xóa alert** | [Blog AI Copilot](https://www.tradingview.com/blog/en/ai-copilot-now-on-tradingview-61231/) · [Support](https://www.tradingview.com/support/solutions/43000795131-getting-started-with-ai-copilot/) · [Bullynx (T)](https://bullynx.com/blog/tradingview-ai-chart-copilot-review) |
| **AI Screener** | Public beta, **mọi gói trả phí**, quota **100/150/250/500** request/tháng, reset 1/ngày 00:00 UTC, prompt 6–164 ký tự, **chỉ Stock + Crypto Screener** (beta), template có sẵn không tính quota, **có "Explanation" minh bạch từng filter** | [Support AI Screener](https://www.tradingview.com/support/solutions/43000785770-how-to-use-the-ai-screener/) · [Blog](https://www.tradingview.com/blog/en/ai-screener-60101/) |
| Automation | Strategy backtesting (basic/advanced report metrics, deep backtesting, tick-level execution), **export trades CSV + report XLSX**, chart data export, Pine Screener | [Pricing](https://www.tradingview.com/pricing/) |
| Execution | **Trade through selected brokers**; **simulated (paper) trading**; chart trading; **DOM trading**; broker comparison tool | [Pricing](https://www.tradingview.com/pricing/) · [Features](https://www.tradingview.com/features/) |
| Social | Publish idea/script/video, comments, badge, signature, **community contests** (3/5/10/25), Minds | [Pricing](https://www.tradingview.com/pricing/) |
| Data | Fastest data flow, backup feed, financials, global economic data, news all sources, hotlists, **economic & earnings calendars**, **yield curves**; max data subscriptions 2/4/6 | [Pricing](https://www.tradingview.com/pricing/) |
| Mobile/desktop | Web + desktop + mobile, native push, widgets, multi-monitor, tab linking | [Pricing](https://www.tradingview.com/pricing/) |

### 1.2.2. Moomoo

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá (AI premium)** | **Moomoo Engine $3,99/tháng hoặc $39,90/năm** (auto-renew), **giảm còn $0,99/tháng khi tài sản > $1.000** tại thời điểm tính phí | [Moomoo Engine](https://www.moomoo.com/us/learn/what-is-moomoo-engine) |
| **AI suite** | **Moomoo AI Assistant** (hỏi về thị trường/cổ phiếu, **Reason mode**, **giữ ngữ cảnh theo trang hiện tại**, **link kết quả về nguồn dữ liệu gốc**); **AI Stock Analysis**; **AI Trend Projection** (tìm pattern tương tự trên **tối đa 100 cổ phiếu**); **AI Announcement Summary** (tóm tắt 1 trang từ **200+ nguồn**); **AI Fundamental Briefing** | [Moomoo AI](https://www.moomoo.com/us/learn/moomoo-ai-invest-forward-and-easier) · [AI trading](https://www.moomoo.com/au/feature/aitrading) · [Engine](https://www.moomoo.com/us/learn/what-is-moomoo-engine) |
| **AI execution (điểm mạnh)** | **SKILL** (prompt → chuỗi research→order, tương thích Claude Code, Cursor); **MCP** hosted HTTP, OAuth 2.1, **130+ tools**; **OpenAPI** (OpenD local gateway + SDK đa ngôn ngữ, REST, WebSocket; phủ HK/US/CN/SG/JP/MY); **Sandbox trading** (khớp theo engine thị trường thật, zero cost, **không cần tài khoản**); CLI (đang phát triển); **simulation mode mặc định**, live trade cần double confirmation | [AI trading](https://www.moomoo.com/au/feature/aitrading) |
| Options | **13 chiến lược** preset; Options Level 2; **Strategy Lab** (multi-leg visual); **P&L Simulator** (giá/time decay/vol); **Gamma Exposure**; Unusual Activity alerts; Options Screener (IV rank, volume, OI); **Algo Trading Studio (no-code)** | [Moomoo Engine](https://www.moomoo.com/us/learn/what-is-moomoo-engine) · [moomoo.com/us](https://www.moomoo.com/us/) |
| Market data | **Nasdaq TotalView depth**; Level 2 free (>$100 avg 30 ngày); 100+ indicators, 38 drawing tools, 190+ preset functions; multi-monitor 6; analyst ratings + price targets; institutional holdings; short sale volume | [Finder review (T)](https://www.finder.com/stock-trading/moomoo-review) |
| Paper trading | **Miễn phí**, $1M cho stock/options, **$10M cho futures**, web/desktop/mobile | [Paper trading](https://www.moomoo.com/us/papertrading) |
| Portfolio | Fractional shares, **Dividend Reinvestment Program (DRIP)**, cash sweep 3,6% APY, Rewards Club | [moomoo.com/us](https://www.moomoo.com/us/) |
| Backtest | Indicator backtesting (trong Technical Engine) | [Moomoo Engine](https://www.moomoo.com/us/learn/what-is-moomoo-engine) |

### 1.2.3. Webull

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá** | **Webull Premium $3,99/tháng hoặc $40/năm** (Level 2, margin thấp hơn, volume discount, **3,5% IRA match**); margin 8,74%→4,74% theo bậc (3,90% Premium); cash 3,6% APY; ACAT out $75; không phí năm / inactivity | [Gainsumo (T)](https://gainsumo.com/broker-reviews/webull/) |
| **AI** | **Vega** — phân tích portfolio vs mục tiêu, phát hiện lệch, **tóm tắt SEC filing bằng ngôn ngữ đơn giản**, giải thích biến động giá realtime, phát hiện outlier trong options chain, **đặt lệnh bằng giọng nói**. **~1,2 triệu người dùng/tuần**; theo lộ trình Webull 2025, **khoảng 1/8 người dùng hỏi Vega trước khi giao dịch** | [Gainsumo (T)](https://gainsumo.com/broker-reviews/webull/) · [Q4 2025 earnings](https://www.marketscreener.com/news/webull-reports-fourth-quarter-and-full-year-2025-financial-results-earnings-presentation-ce7e5fdadb8cff22) |
| AI trading | **AI Trading Strategies** trong paperTrade — dựng chiến lược bằng AI rồi test trên dữ liệu live | [paperTrade](https://www.webull.com/paper-trading) |
| Paper trading | **Miễn phí, $1.000.000** virtual cash; 24/5 (pre/post/overnight) + weekend cho crypto & event contracts; **Level 2**; **Turbo Trader / Ladder Trader** (giống hệt layout live); 60+ indicators, 17+ charting tools; **no PDT**; **multi-asset corporate actions** (cổ tức, exercise, expiration, recurring & reinvestment); **margin call & liquidation mô phỏng**; multi-leg options; **Portfolio Blueprint**; **Crypto Grid Trading**; order types Limit/Market/Stop/Stop-Limit/**OCO**/**Trailing Stop**; 1-tap switch live↔paper | [paperTrade](https://www.webull.com/paper-trading) |
| Trading | Stocks/ETFs, **OTC** (OTCQX/OTCQB/Pink), options multi-leg (index $0,55/hợp đồng), ADR, **Recurring Investment**, **24/5 + overnight**, futures, crypto 70+ coin, **prediction markets** (Kalshi), corporate bonds, Level 2/NBBO, Wefolio (basket 30 mã) | [Trading & Investing](https://www.webull.com/trading-investing) · [Gainsumo (T)](https://gainsumo.com/broker-reviews/webull/) |
| Fractional | Từ $1; Market/Limit; pre/post chỉ Limit; **không short**, **không sửa lệnh**; stock lending cho phép | [Fractional shares](https://www.webull.com/help/faq/10959-Trading-Fractional-Shares) |
| **B2B** | **Webull Institutional** (07/2026): brokerage infrastructure + clearing + custody + onboarding + **APIs** + AI + execution + **embeddable solutions**; module tài khoản: **fully-disclosed / omnibus / omnibus + anonymized sub-accounts**; phủ equities, options, futures, prediction markets, cash management, market data & analytics; high-touch account management | [PR Newswire](https://www.prnewswire.com/news-releases/webull-launches-institutional-platform-for-brokers-hedge-funds-advisors-fintechs-and-financial-institutions-302818682.html) |
| **API** | **Broker API**: mở tài khoản (form-based), funding (Plaid ACH + wire), journal nội bộ, đặt lệnh, **event stream gRPC server-streaming** (application/account/funding/journal/master-data/instrument/**trade**/**corporate action**/position/SOD); **OpenAPI**: Trading API, Market Data API (Level-2 depth), Connect API (OAuth), Broker API | [Broker API](https://developer.webull.com/apis/docs/broker-api/getting-started.md) · [Open API](https://www.webull.com/open-api) |
| Advisor | **Robo-advisor hợp tác BlackRock** (5 chiến lược, 30 portfolio); mở rộng sang IB / HNW / family office / advisor | [Q4 2025 earnings](https://www.marketscreener.com/news/webull-reports-fourth-quarter-and-full-year-2025-financial-results-earnings-presentation-ce7e5fdadb8cff22) |

### 1.2.4. Fidelity

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| Giá | $0 commission US stock/ETF; options **$0,65/hợp đồng**; margin 10,325% (số dư $250k–499k; base 10,825% từ 18/09/2026); trái phiếu $1 markup (Treasuries $0); **0 phí tài khoản** | [Why Fidelity](https://www.fidelity.com/why-fidelity/trading) · [Compare](https://www.fidelity.com/trading/compare-us) |
| Screening | **Stock Screener** (desktop + mobile) + **thematic screener**; bảng so sánh định giá 4 broker | [Why Fidelity](https://www.fidelity.com/why-fidelity/trading) · [Compare](https://www.fidelity.com/trading/compare-us) |
| Charting | **Fidelity Trader+** — real-time data, advanced charting, **custom alerts**, multi-monitor layouts, dynamic screeners; **Recognia®** technical patterns & events; **Social Sentiment Indicator**; **market snapshot & positions heatmap**; **Trefis®** valuation visualization; **portfolio-level backtesting** | [Advanced trading](https://www.fidelity.com/investing/advanced-trading) · [Compare](https://www.fidelity.com/trading/compare-us) |
| Alerts | **Real-time alerts with price movement probability** | [Compare](https://www.fidelity.com/trading/compare-us) |
| Options | **Option Trade Builder**; 4-level approval; phân tích payoff | [Compare](https://www.fidelity.com/trading/compare-us) |
| Portfolio/research | Digital notebook tự động insight sự kiện; **32 nhà cung cấp streaming news**; 150.000 bond/CD mới phát hành, 200.000 báo giá (có depth of book); quỹ index 0% expense ratio; 7.000+ mã fractional; **giao dịch quốc tế 25 nước / 16 tiền tệ** | [Compare](https://www.fidelity.com/trading/compare-us) · [Why Fidelity](https://www.fidelity.com/why-fidelity/trading) |
| AI | **CHƯA XÁC MINH** trên trang chính thức trong phạm vi tìm kiếm ("Equity Summary Score" là LSEG StarMine — bên thứ ba, không phải AI của Fidelity) | [digital.fidelity.com](https://digital.fidelity.com/prgw/digital/research/src) |

### 1.2.5. Robinhood

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá** | **Robinhood Gold $5/tháng hoặc $50/năm** | [Yes-No event](https://robinhood.com/us/en/newsroom/robinhood-presents-yes-no-event/) · [Q2 2026 earnings](https://static.seekingalpha.com/uploads/sa_presentations/792/131792/original.pdf) |
| **AI** | **Robinhood Cortex**: Stock Digests, Crypto Digests, **Portfolio Digests** (top return driver, top mover, sắp có earnings/split, **so sánh benchmark SPY/BTC**), **Cortex Assistant** (chat + hành động: *"tell it to buy and sell equities and crypto"* bằng plain English), Trade Builder (sắp), custom indicators & scanners (sắp) — **tất cả paywall Gold** | [Cortex Digests](https://robinhood.com/us/en/support/articles/cortex-digests/) · [Yes-No event](https://robinhood.com/us/en/newsroom/robinhood-presents-yes-no-event/) · [Q2 2026](https://static.seekingalpha.com/uploads/sa_presentations/792/131792/original.pdf) |
| **AI agent** | **Robinhood Agents** — tự xây AI agent trong app: phát triển chiến lược, chạy research, **giao dịch tự động**; **11 Agent Apps** từ đối tác | [HOOD Summit 2026](https://robinhood.com/us/en/support/articles/hood-summit-2026-product-announcements/) |
| Social | **Robinhood Social** — theo dõi nhà đầu tư, chia sẻ giao dịch gần đây, thảo luận xu hướng thị trường, mở cho mọi khách hàng đủ điều kiện | [HOOD Summit 2026](https://robinhood.com/us/en/support/articles/hood-summit-2026-product-announcements/) |
| Execution | **Take profit / stop loss orders**; perpetuals crypto 10x; 24/7 trading; extended options hours; **intraday buying power tới 4x** có control; earnings predictions; overnight index options | [HOOD Summit 2026](https://robinhood.com/us/en/support/articles/hood-summit-2026-product-announcements/) |
| Gold benefits | 3,35% APY cash (FDIC $2,5tr); **3% IRA match**; index options $0,35 vs $0,50; futures $0,50 vs $0,75; **$1.000 margin miễn phí**; **phí quản lý chiến lược trần $250/năm**; Gold Card 3% cashback; Banking 3,5% APY; mortgage ưu đãi 0,75% | [Q2 2026 earnings](https://static.seekingalpha.com/uploads/sa_presentations/792/131792/original.pdf) |
| Quy mô | **4,84 triệu Gold subscribers Q2/2026 ≈ 17% funded customers**; Gold subscriber có **~3,1× AUC**; doanh thu Gold định kỳ hóa ~$200M/năm | [Q2 2026 earnings](https://static.seekingalpha.com/uploads/sa_presentations/792/131792/original.pdf) |
| Cortex adoption | ~1 triệu khách hàng dùng Cortex (Q1/2026 call) **[T]** | [Motley Fool transcript](https://www.fool.com/earnings/call-transcripts/2026/04/28/robinhood-hood-q1-2026-earnings-transcript/) |

### 1.2.6. Interactive Brokers

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| Phạm vi | **175+ sàn, 40 quốc gia**; equities, options, futures, forex, bonds, funds | [TWS](https://www.interactivebrokers.com/en/trading/tws.php) |
| Order types | **Hơn 100 order types + algos**: AON, Adaptive, Arrival Price, **Closing Price**, Auction (COP), **Conditional** (điều kiện giá/thời gian/khối lượng/margin cushion/% thay đổi), LIT/MIT/trailing, **MidPrice**, **Minimize Impact**, Pegged-to-Midpoint, Hidden, Accumulate/Distribute, Dark Ice; TIF Day/GTC/GTD, IOC/FOK/AON | [Order types & algos](https://www.interactivebrokers.com/en/trading/ordertypes.php) · [Glossary](https://www.interactivebrokers.com/campus/glossary-terms/order-types-and-algos/) |
| Risk | **Real-time margin & P&L monitoring**; portfolio risk analysis; **scenario & stress testing**; **pre-trade risk controls** | [TWS](https://www.interactivebrokers.com/en/trading/tws.php) |
| **API** | **Web API** (REST + WebSocket; account opening/management/funding/banking/reporting; sub-account cho advisor; SSO/OAuth) · **FIX** (VPN/extranet/leased line/cross-connect) · **TWS API** (C++, C#, Java, Python, ActiveX, RTD, DDE — **mới open-source GPL 2026**) | [IBKR API](https://www.interactivebrokers.com/en/trading/ib-api.php) · [TWS API release notes](https://www.ibkrguides.com/releasenotes/prod-2026.htm) |
| Tính năng API mới 2026 | `conditionsIncludeOvernight`; **stage order qua API rồi submit trên mobile**; drop copy; odd-lot tick types; hedgeMaxSize; "Prepend $LEDGER-" để phân biệt giá trị theo tiền tệ | [TWS API release notes](https://www.ibkrguides.com/releasenotes/prod-2026.htm) |
| Research | Advanced market scanners, custom filters, technical indicators; truy cập miễn phí Estimize / Trading Central / Smart Insider / TipRanks | [TWS](https://www.interactivebrokers.com/en/trading/tws.php) |

### 1.2.7. eToro

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **AI (Tori)** | **Tori** — trợ lý/agent AI **powered by Grok 4.2**: nhớ portfolio + sở thích + hội thoại; **đọc sentiment thị trường realtime từ X**; **tạo & quản lý "Agent Portfolio"**; phân tích portfolio, chỉ ra rủi ro; không phải lời khuyên đầu tư | [Tori](https://www.etoro.com/trading/platforms/tori/) |
| App mới (07/2026) | App AI-first: **proactive insights** (Tori chủ động báo lý portfolio insight + market signal + lý do biến động giá); **Tori qua WhatsApp & Apple Watch**; **sub-account cho từng mục tiêu**; asset pages có chart & analytics pro; **etoro edge** (desktop app cho trader nặng); **agent-powered portfolios** — mỗi agent chạy 24/7 trong sub-account riêng, Tori quản lý; **etoro App Store** + **Builders' Portal** (API & tài liệu) | [Press release 07/2026](https://www.etoro.com/en-us/news-and-analysis/latest-news/press-release/etoro-launches-new-app-ai-first-smart-and-social/) |
| Portfolio | **65+ Smart Portfolios** (Target Model với Franklin Templeton — tự giảm rủi ro theo năm mục tiêu; **Alpha Portfolios dùng AI**; Top Trader; Partner Portfolios), **nhập từ $500**; demo account **$100.000**; recurring investment; fractional shares; stop loss/take profit; **24/5** 100+ US stocks; tokenised stocks; futures (SQF/CME); crypto-to-fiat; Subscription (3% stock-back với eToro Visa) | [Smart Portfolios](https://www.etoro.com/investing/portfolios/) · [Platforms](https://www.etoro.com/trading/platforms/) · [Super App](https://www.etoro.com/about/building-the-financial-super-app/) |
| Social | **Copy trading** — 40 triệu user, Popular Investors được trả tiền để bị copy; ProCharts so sánh instrument/timeframe | [Platforms](https://www.etoro.com/trading/platforms/) |
| Quy mô | 40 triệu user đăng ký, 75 quốc gia, 10.000+ assets | [Press release](https://www.etoro.com/en-us/news-and-analysis/latest-news/press-release/etoro-launches-new-app-ai-first-smart-and-social/) |

---

## 1.3. Lớp 3 — Terminal tổ chức

### 1.3.1. Bloomberg Terminal

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá** | **$31.980/năm** (1 seat) · **$28.320/năm/seat** (≥2 seats) · hợp đồng **2 năm** (~$63.960 / $56.640) · tăng 6,5% từ 01/2025 · **đã báo tăng tiếp từ 01/2027 [T]** · phí sàn & dữ liệu bên thứ ba **tính ngoài** · B-PIPE/Data License = sản phẩm riêng · 1 license = 1 user | [BlueGamma (T)](https://www.bluegamma.io/post/bloomberg-terminal-pricing) · [Investopedia (T)](https://www.investopedia.com/terms/b/bloomberg_terminal.asp) |
| **AI** | **ASKB by Bloomberg AI** (agentic AI cho Terminal); **Document Search & Analysis** trên **200 triệu+ tài liệu**; **AI Document Insights** (04/2025, trích xuất có trích dẫn từ 10-K/10-Q/transcript); **AI Summary** cho Company News (11/2025); **natural-language command line** (gõ *"What were Apple's latest earnings?"*); **BloombergGPT** 50B tham số / 363B token | [ASKB](https://professional.bloomberg.com/products/bloomberg-terminal/ai/askb/) · [Meet ASKB](https://professional.content.cirrus.bloomberg.com/professional2023/insights/press-announcement/meet-askb-a-first-look-at-the-future-of-the-bloomberg-terminal-in-the-age-of-agentic-ai/) · [AI guide (T)](https://artificial-intelligence-wiki.com/industry-ai/financial-services-ai-applications/bloomberg-terminal-ai/) |
| M&A / screening | **MA function**, **MARB** (merger-arb spread), **EQS** (Equity Screening), **CACS** (corporate actions: spinoff, divestiture) | [CT Acquisitions (T)](https://ctacquisitions.com/refinitiv-vs-bloomberg-vs-factset-vs-capital-iq/) |
| Data / Excel | **BQL**, **BDH/BDP/BDS** (Excel), DCF & accretion/dilution modeling | [CT Acquisitions (T)](https://ctacquisitions.com/refinitiv-vs-bloomberg-vs-factset-vs-capital-iq/) |

### 1.3.2. FactSet Workstation

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá** | **Không công bố bảng giá (quote-only)** — số liệu từ nguồn thứ ba: entry ~$4.000 · Workstation tiêu chuẩn ~$12.000 · full stack **$22.000–$30.000** · median hợp đồng ký **$20.523–$25.160/năm** · real-time exchange data **+30–60%** · hợp đồng năm, không theo tháng · Treasury award ~$23.600/seat · DOJ award ~$10.600/seat | [Investables.ai (T)](https://investables.ai/blog/how-much-does-factset-cost) · [Market Ontology (T)](https://marketontology.com/factset-pricing-explained) |
| **AI** | **FactSet Intelligence** — modular AI stack: **AI-powered search**, **conversational chat**, **automated portfolio commentary**, **transcript analysis**, **agentic research workflows**; grounded trên dữ liệu FactSet, có governance | [Workstation](https://www.factset.com/marketplace/catalog/product/factset-workstation) |
| Data | **800+ nguồn dữ liệu** (300+ feeds/products), Excel add-in, lịch sử sâu, 1.100+ dataset cho backtest | [Workstation](https://www.factset.com/marketplace/catalog/product/factset-workstation) · [Market Intelligence Tools (T)](https://marketintelligencetools.com/reviews/factset/) |
| Quant | **4 optimizer + 120+ risk model**; stress test; predictive model thích ứng điều kiện thị trường | [Workstation](https://www.factset.com/marketplace/catalog/product/factset-workstation) |
| Workflow | Screening (equities/M&A/PE/VC), research management (ghi chú nội bộ tìm kiếm được), performance attribution, risk/scenario analysis, báo cáo holdings/exposure/attribution theo lịch | [Workstation](https://www.factset.com/marketplace/catalog/product/factset-workstation) · [MIT (T)](https://marketintelligencetools.com/reviews/factset/) |

### 1.3.3. Sierra Chart

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá** | Package 3 Base Standard **$26/tháng** · 5 Base Advanced **$36** · 10 Integrated Standard **$36** · 11 Integrated Advanced **$46** · 12 Advanced + **Market-by-Order $56**. Giảm 15% (3th), 25% (6th), 35% (12th). Trial 21 ngày [T]. Hỗ trợ ngoài gói: **$65/giờ** | [Packages](https://www.sierrachart.com/index.php?l=doc%2FPackages.php&language=en) · [Review (T)](https://tradingview-alternatives.com/sierra-chart-review/) |
| Charting / orderflow | **ChartDOM** (trading DOM tích hợp chart), **TPO Chart Study**, **Numbers Bars**, **Market Depth Historical Graph**, **Volume Profile**, MBO; custom studies (ACSIL) + **Excel-compatible Spreadsheets** để dựng hệ thống tự động | [Features](https://www.sierrachart.com/index.php?page=doc%2FFeatures.php) · [Packages](https://www.sierrachart.com/index.php?l=doc%2FPackages.php&language=en) |
| Execution | **Teton** order routing trực tiếp sàn (<500µs), **server-side OCO + bracket** (quản lý cả khi mất mạng), **0 phí/giao dịch**, redundancy 4 kết nối + 3 ISP, market depth/MBO **1400 levels** cho CME & EUREX, tự động thanh lý vị thế khi chạm giới hạn lỗ trong ngày, lịch sử fill 2 năm | [Teton](https://www.sierrachart.com/index.php?page=doc%2FSierraChartDirectOrderRoutingService.php) |
| Protocol | FIX + **DTC** (tương thích mọi data/trading service dùng DTC) | [sierrachart.com](https://www.sierrachart.com/) |

### 1.3.4. Koyfin

| Nhóm | Tính năng | Nguồn |
|---|---|---|
| **Giá** | Free $0 · **Plus $39/tháng** · **Premium $79/tháng** · **Advisor Core $209/tháng** · **Advisor Pro $299/tháng** · **Teams** (≥3 user, giá sales) · giảm 30% khi trả năm · 30-day money-back · hãy tư vấn <$100M AUM được giảm 50%. So sánh tự quảng bá: $299/tháng vs Bloomberg $5.000–$30.000/seat/năm | [Pricing](https://www.koyfin.com/pricing/) · [Plans comparison](https://www.koyfin.com/pricing/plans-comparison/) · [LLM info](https://www.koyfin.com/llm-info/) · [Aicentral (T)](https://www.aicentralresources.com/tool/koyfin) |
| Screening | **5.900+ filter** trên **100.000+ chứng khoán toàn cầu**; screener cổ phiếu/ETF/mutual fund/SMA; lưu template không giới hạn (Plus+) | [Pricing](https://www.koyfin.com/pricing/) · [Functionality](https://www.koyfin.com/help/topic/functionality/) |
| Charting & dashboard | Advanced charting (giá, cơ bản, định giá, vĩ mô), **custom dashboards** kéo-thả, dashboard groups liên kết màu, relative performance A/B, **300+ financial data point templates**, custom formulas (10 ở Plus, không giới hạn ở Premium), custom data series, 7 màu flag | [Features](https://www.koyfin.com/features/) · [Functionality](https://www.koyfin.com/help/topic/functionality/) |
| Portfolio | Nhiều tài khoản, **lot-level P/L**, holdings matrix, hypothetical performance, model performance history, X-ray look-through, short positions (Premium) | [Plans comparison](https://www.koyfin.com/pricing/plans-comparison/) · [LLM info](https://www.koyfin.com/llm-info/) |
| **B2B / Advisor** | **Model portfolios** (chia sẻ được), **client portfolios**, **client proposals & reports** (10/tháng ở Core, **200/tháng ở Pro**), so sánh tới 5 portfolio, **custom report pages** có branding, **custodian integrations** (Schwab, Fidelity, Altruist, TradePMR, IB, Orion, Black Diamond, Addepar), **PDF broker statement upload**, **PMS integrations**, US SMAs, **attribution**, mutual fund data | [Plans comparison](https://www.koyfin.com/pricing/plans-comparison/) · [LLM info](https://www.koyfin.com/llm-info/) |
| AI | **CHƯA XÁC MINH** — trang chính thức không có mục AI riêng; chỉ có mô tả "AI-driven recommendations" qua nguồn thứ ba **[T]** | [Aicentral (T)](https://www.aicentralresources.com/tool/koyfin) |
| Quy mô | >50.000 cố vấn tài chính + >500.000 nhà đầu tư | [LLM info](https://www.koyfin.com/llm-info/) |
| Teams | Kết hợp plan khác nhau, **centralized billing & administration**, custom onboarding, admin purchasing, SSO **[T]** | [TrustRadius (T)](https://www.trustradius.com/compare-products/factset-vs-koyfin) |

---

## 1.4. Lớp 4 — Tổng hợp "AI trong tài chính" + paywall

| Sản phẩm AI | Lớp | Chức năng AI cụ thể | **Paywall / ngưỡng giá** | Nguồn |
|---|---|---|---|---|
| **AI Copilot** (TradingView) | QT | Setup chart bằng lời; vẽ hỗ trợ/kháng cự, pattern, order block, FVG, BOS/CHoCH; TA đa khung + divergence; đọc cơ bản; tin + sentiment + macro; **sàng lọc NL**; **sinh Pine Script + tối ưu + đọc backtest**; **quản lý watchlist/alert** | **Add-on $7,50/tháng [T]**, cần gói trả phí; **không có mobile**; giới hạn token/tháng, không rollover | [Blog](https://www.tradingview.com/blog/en/ai-copilot-now-on-tradingview-61231/) · [Support](https://www.tradingview.com/support/solutions/43000795131-getting-started-with-ai-copilot/) · [Bullynx (T)](https://bullynx.com/blog/tradingview-ai-chart-copilot-review) |
| **AI Screener** (TradingView) | QT | Prompt → filter + column set + sort tự động, có **Explanation** minh bạch | **Mọi gói trả phí**; quota **100/150/250/500**/tháng; public beta; **chỉ Stock + Crypto** | [Support](https://www.tradingview.com/support/solutions/43000785770-how-to-use-the-ai-screener/) |
| **Moomoo Engine** | QT | 7 tool Fundamental (AI Briefing, Earnings Hub, Forecasts, Institutional Research, Valuation Models, Revenue Analytics, Smart Money Tracker) + 7 tool Options (Strategy Lab, P&L Simulator, Gamma Exposure, Unusual Activity, Screener, Algo Studio) + Technical (TotalView, indicator backtest) | **$3,99/tháng ($39,90/năm), giảm $0,99 nếu tài sản >$1.000** | [Engine](https://www.moomoo.com/us/learn/what-is-moomoo-engine) |
| **Moomoo AI Assistant** | QT | Chat đa ngữ cảnh, Reason mode, link nguồn dữ liệu, AI Stock Analysis, AI Trend Projection (100 mã), AI Announcement Summary (200+ nguồn) | Miễn phí / kèm Engine | [Moomoo AI](https://www.moomoo.com/us/learn/moomoo-ai-invest-forward-and-easier) |
| **Moomoo SKILL / MCP / OpenAPI** | QT | Agent ngoài đặt lệnh qua MCP (130+ tools, OAuth 2.1) hoặc OpenD/SDK; **sandbox trading**; CLI | Theo tier tài khoản; **simulation mặc định, live cần double-confirm** | [AI trading](https://www.moomoo.com/au/feature/aitrading) |
| **Vega** (Webull) | QT | Portfolio-vs-goal analysis, tóm tắt filing, giải thích biến động realtime, outlier options chain, **voice trading** | **Free cho user** → thu hút sang phí giao dịch; ~1,2M user/tuần | [Gainsumo (T)](https://gainsumo.com/broker-reviews/webull/) |
| **Cortex** (Robinhood) | QT | Stock/Crypto/Portfolio Digests, Assistant, Trade Builder, custom indicators & scanners | **Gold $5/tháng** hoặc $50/năm; Digests **chỉ Gold**, **không gồm options & futures** | [Cortex Digests](https://robinhood.com/us/en/support/articles/cortex-digests/) · [Q2 2026](https://static.seekingalpha.com/uploads/sa_presentations/792/131792/original.pdf) |
| **Robinhood Agents** | QT | Xây AI agent: chiến lược, research, **giao dịch tự động**; 11 Agent Apps | Rolling out; nằm trong hệ Gold/Legend | [Summit 2026](https://robinhood.com/us/en/support/articles/hood-summit-2026-product-announcements/) |
| **Tori** (eToro) | QT | Chat nhớ context, sentiment X (Grok 4.2), **tạo & quản lý Agent Portfolio** | Theo plan; agent portfolio tự trade 24/7 trong sub-account | [Tori](https://www.etoro.com/trading/platforms/tori/) |
| **Alpha Portfolios** (eToro) | QT | Danh mục AI tự điều chỉnh theo thị trường | Nhập từ $500; phí quản lý theo gói | [Smart Portfolios](https://www.etoro.com/investing/portfolios/) |
| **FireAnt Copilot / AI Answer / AI Report / AI Video / Lọc AI / Quant AI** | **VN** | Chat về cổ phiếu, tóm tắt dữ liệu, bối cảnh thị trường; NL→bộ lọc; sinh báo cáo + slide + video; sinh mã AFL | **Chuyên Nghiệp + Cao Cấp**; AI Report & AI Video **chỉ Cao Cấp** (5,75tr/12th) | [Bảng giá](https://company.fireant.vn/bang-gia) |
| **TCBS AI phân tích** | **VN** | Phân tích cơ bản + kỹ thuật + **đề xuất chiến lược mua bán** | Nằm trong "bộ công cụ phân tích đầu tư toàn diện" mà trang ưu đãi TCBS ghi **miễn phí** (kèm Zero Fee) | [Mở tài khoản CK](https://www.tcbs.com.vn/mo-tai-khoan-giao-dich-co-phieu-tai-tcbs) |
| **Mira-bot + AI News** (Mirae) | **VN** | Trợ lý 24/7, tổng hợp tin tức realtime, thông báo cá nhân hóa theo hành vi | Trong app M-STOCK | [M-STOCK](https://masvn.com/article/mo-ra-phong-cach-dau-tu-moi-m-stock-206547) |
| **ASKB + Document Search/Insights + NL terminal** (Bloomberg) | TCT | Agentic AI trên 200M+ tài liệu, NL command line | **Bao gồm trong $31.980/năm** (không tính riêng) | [ASKB](https://professional.bloomberg.com/products/bloomberg-terminal/ai/askb/) · [AI guide (T)](https://artificial-intelligence-wiki.com/industry-ai/financial-services-ai-applications/bloomberg-terminal-ai/) |
| **FactSet Intelligence** | TCT | AI search, conversational chat, auto portfolio commentary, transcript analysis, agentic research | **Bao gồm trong seat** ($12k–$30k) | [Workstation](https://www.factset.com/marketplace/catalog/product/factset-workstation) |

---

# PHẦN 2 — A. CAPABILITY UNIVERSE

**Ký hiệu:** `✓` có · `~` có ở mức hạn chế/tương đương · `✗` không có · `?` **chưa biết (context VNInvest không nhắc → cần verify trong code, KHÔNG coi là thiếu)**

**Cột đại diện:**
- **VN** = lớp broker/media VN, đại diện mạnh nhất về tính năng: FireAnt, TCBS, Mirae, SSI, VNDIRECT
- **QT** = lớp quốc tế: TradingView, moomoo, Webull, Robinhood, eToro, IBKR, Fidelity
- **TCT** = lớp tổ chức: Bloomberg, FactSet, Sierra Chart, Koyfin

## D1. Market Data & Quotes
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Realtime OHLCV 3 sàn HOSE/HNX/UPCom | ✓ | ✓ | ✓ | ✓ |
| Intraday (tick/phút) sâu | ✓ | ✓ | ✓ | ✓ |
| Độ sâu thị trường / price ladder | ✓ | ✓ | ✓ | ~ (whale/order-flow signals) |
| Level 2 / MBO / orderbook nhiều cấp | ✗ | ✓ | ✓ | ✗ |
| Volume profile / footprint / TPO | ✗ | ✓ | ✓ | ✗ |
| TBT (time & sales) | ✓ | ✓ | ✓ | ? |
| Dòng tiền: nước ngoài / tự doanh / cung cầu | ✓ | ✗ | ✗ | ✓ |
| Corporate actions (cổ tức, chia tách, quyền) | ✓ | ✓ | ✓ | ? |
| Tín dụng doanh nghiệp / trái phiếu | ✓ | ✓ | ✓ | ? |
| Lịch kinh tế & lịch báo cáo | ~ | ✓ | ✓ | ✗ |
| Dữ liệu tài chính cơ bản chuẩn hoá (nhiều năm) | ✓ | ✓ | ✓ | ? |
| Chỉ số ngành / phân ngành ICB | ✓ | ✓ | ✓ | ? |
| Heatmap | ✗ | ✓ | ✓ | ✗ |
| Yield curve / FX / hàng hóa | ~ | ✓ | ✓ | ✗ |
| Dữ liệu đa sàn quốc tế | ✗ | ✓ | ✓ | ✗ |

## D2. Charting & Technical Analysis
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Chart realtime cơ bản | ✓ | ✓ | ✓ | ✓ (widget) |
| Indicator built-in số lượng lớn (>100) | ~ (30–50) | ✓ (400+ + 100K cộng đồng) | ✓ | ? |
| Indicator cộng đồng / marketplace | ✗ | ✓ | ✓ | ? |
| Ngôn ngữ script lập trình (Pine / ACSIL / AFL) | ✗ | ✓ | ✓ | ✗ |
| Bar Replay | ✗ | ✓ | ✓ | ✗ |
| Đa khung thời gian tùy chỉnh (giây/tick) | ✗ | ✓ | ✓ | ✗ |
| Sự kiện trên biểu đồ (cổ đông chính, BCTC, cổ tức) | ✓ | ✓ | ✓ | ✗ |
| Auto chart pattern | ✗ | ✓ | ✓ | ✗ |
| Layout/workspace lưu & chia sẻ | ✓ | ✓ | ✓ | ? |
| Bảng giá tùy chỉnh theo sàn/cột | ✓ | ✓ | ✓ | ? |
| Đồ thị đa sàn / multi-monitor | ~ | ✓ | ✓ | ✗ |

## D3. Screening & Discovery
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Screener cơ bản (nhiều tiêu chí) | ✓ | ✓ | ✓ | ✓ |
| Screener nâng cao (RRG, Z/F-Score, Dupont) | ✓ | ✓ | ✓ | ? |
| **Screener bằng ngôn ngữ tự nhiên** | ✓ (FireAnt Lọc AI) | ✓ (TV AI Screener) | ✗ | ✗ |
| Lưu & chia sẻ bộ lọc | ✓ | ✓ | ✓ | ? |
| Screener theo ngành/chỉ số | ✓ | ✓ | ✓ | ? |
| Pine Screener (script trong screener) | ✗ | ✓ | ✓ | ✗ |
| Bond / ETF / Mutual-fund screener | ✗ | ✓ | ✓ | ✗ |
| Top movers / market highlights | ✓ | ✓ | ✓ | ? |
| Định giá cổ phiếu (DCF/P-E/P-B/Graham) | ✓ | ✓ | ✓ | ? |

## D4. Portfolio & Wealth Analytics
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Holdings + P/L | ✓ | ✓ | ✓ | ✓ (+ ledger) |
| Benchmarking (VN-Index / VN30) | ~ | ✓ | ✓ | ? |
| Phân bổ tài sản / target allocation | ✓ (MYDGO) | ✓ (eToro target model, sub-account) | ✓ (Koyfin model portfolio) | ✗ |
| Rebalancing tự động | ✗ | ~ | ✗ | ✗ |
| Cổ tức + DRIP | ✓ | ✓ | ✓ | ? |
| Tax-aware (thuế TNCN 0,1%) | ~ (phí/thuế hiển thị) | ✓ | ✓ | ? |
| Risk metrics (beta, vol, drawdown, VaR) | ~ | ✓ | ✓ | ? |
| Stress / scenario analysis | ✗ | ✓ | ✓ | ✗ |
| Portfolio backtesting (mức danh mục) | ✗ | ✓ (Fidelity) | ✓ | ✗ |
| X-ray / holdings matrix / overlap | ✗ | ✗ | ✓ (Koyfin) | ✗ |
| Sub-account / goal-based account | ✓ | ✓ (eToro) | ✓ | ✗ |
| Lot-level P/L | ✗ | ✓ | ✓ | ✓ (ledger) |

## D5. Order Execution & Broker Connectivity
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Đặt lệnh cổ phiếu cơ sở (LO/MP/Stop) | ✓ | ✓ | ✓ | ✓ (DNSE) |
| **Nhiều broker lane / routing** | ~ (FireAnt Trading nhiều CK) | ✓ (TradingView chọn broker; Webull Institutional) | ✓ | ✓ (3 lane) |
| Lệnh điều kiện (OCO/Up-Down/Trailing/BullBear) | ✓ (SSI mạnh) | ✓ | ✓ | ✗ |
| Paper trading / simulated account | ✓ (VNDIRECT ProTrade Trial) | ✓ (TV, moomoo, Webull) | ✓ (Sierra simulated) | ✗ |
| Fractional shares | ✗ (lô 100) | ✓ | ✓ | ✗ (không áp dụng) |
| Options | ✗ | ✓ | ✓ | ✗ |
| Futures / phái sinh | ✓ | ✓ | ✓ | ✗ |
| Margin / bán khống | ✓ | ✓ | ✓ | ✗ |
| Short selling | ✗ (VN chưa cho lõi bán) | ✓ | ✓ | ✗ |
| Pre-trade risk control / cảnh báo margin | ✓ (VNDIRECT) | ✓ (IBKR) | ✓ | ? |
| API đặt lệnh programmatic | ~ (BSC Open API) | ✓ | ✓ | ✓ (partner API) |
| Sàn đa thị trường quốc tế | ✗ | ✓ | ✓ | ✗ |

## D6. AI & Intelligence
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| **AI chat/assistant nhúng trong app** | ✓ (FireAnt Copilot, Mira-bot) | ✓ (TV Copilot, moomoo, Vega, Cortex, Tori) | ✓ (Bloomberg, FactSet) | ✗ (chỉ có advisory) |
| AI tóm tắt tin tức / announcement | ✓ (AI News, AI Answer) | ✓ (Cortex Digests, AI Announcement Summary) | ✓ | ✗ |
| AI portfolio digest ("vì sao danh mục tăng/giảm") | ✗ | ✓ (Cortex Portfolio Digests) | ✓ (FactSet auto portfolio commentary) | ✗ |
| AI chọn cổ phiếu / stock picks | ✗ (TCBS "đề xuất chiến lược") | ~ (Vega outliers; Robinhood custom scanners sắp) | ✗ | ✗ |
| **AI sinh code/strategy từ mô tả tự nhiên** | ✓ (FireAnt Quant AI sinh AFL) | ✓ (TV AI Copilot sinh Pine) | ✗ | ✗ |
| AI đọc & phân tích tài liệu (BCTC/10-K) | ✗ | ~ (Vega tóm tắt filing) | ✓ (Bloomberg 200M docs) | ✗ |
| AI trade execution / agent | ✗ | ✓ (Robinhood Agents, moomoo Skills/MCP, eToro agent portfolio) | ✗ | ✗ |
| AI trend projection (pattern similarity) | ✗ | ✓ (moomoo, 100 mã) | ✗ | ✗ |
| AI tạo báo cáo/slide/video | ✓ (FireAnt AI Report + Video) | ✗ | ✗ | ✗ |
| Multi-provider LLM (BYOK) | ✗ | ✗ | ✗ | ✓ |
| AI có giải thích/minh bạch (Explanation) | ✗ | ✓ (TV AI Screener) | ✗ | ? |
| AI giám sát audit được (audit trail) | ✗ | ✗ | ✓ (research mgmt FactSet) | ✓ (SOC/AI audit) |

## D7. Automation, Alerts & Backtesting
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Cảnh báo giá cơ bản | ✓ | ✓ | ✓ | ✓ |
| Cảnh báo nâng cao theo tiêu chí phân tích | ✓ | ✓ | ✓ | ? |
| Cảnh báo đa điều kiện | ✗ | ✓ | ✓ | ? |
| Cảnh báo qua webhook | ✗ | ✓ (từ Essential) | ✓ | ✓ |
| Kênh cảnh báo ngoài app (email/Slack/Discord/Telegram/WhatsApp) | ~ (SMS/ZNS ở VN) | ✓ | ✓ | ? |
| **Cảnh báo qua Zalo** | ✗ | ✗ | ✗ | ✗ |
| Screener có lịch (scheduled) | ~ | ✓ | ✓ | ✓ |
| Backtest cơ bản | ✓ (TCBS, FireAnt) | ✓ | ✓ | ✓ |
| Backtest với giả định thị trường VN (phí 2 chiều, lô 100, T+2,5) | ✓ (FireAnt MetaKit) | ✗ | ✗ | ? |
| Backtest sâu (tick-level) / deep backtesting | ✗ | ✓ | ✓ | ✗ |
| Strategy builder no-code | ✗ | ✓ (moomoo Algo Studio, Webull AI strategies) | ✗ | ✗ |
| Paper trading | ✓ | ✓ | ✓ | ✗ |

## D8. Social, Community & Content
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Cộng đồng nhà đầu tư (diễn đàn/feed) | ✓ (Stockbook, Chatroom, Copy trader) | ✓ (TradingView ideas, Robinhood Social) | ✗ | ✗ |
| Chia sẻ watchlist | ✗ | ✓ (TradingView, Koyfin) | ✓ | ✗ |
| Copy trading | ✓ (iTrader TCBS) | ✓ (eToro, moomoo CopyTrader) | ✗ | ✗ |
| AI-generated content cho cộng đồng | ✗ | ✗ | ✗ | ✗ |

## D9. Data Access, Export & Third-party Integrations
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Export CSV | ✓ | ✓ | ✓ | ? |
| Export XLSX / Excel add-in | ✓ (FireAnt for Excel) | ✓ (TV report XLSX) | ✓ (FactSet/Bloomberg Excel) | ✗ |
| API market data (read) | ✓ (FireAnt API) | ✓ | ✓ | ✓ (partner API) |
| API trading (order) | ✓ (BSC Open API) | ✓ | ✓ | ✓ |
| SDK/connector cho quant (AmiBroker/MetaStock/Python) | ✓ (FireAnt MetaKit) | ✓ (IBKR TWS API) | ✓ (FactSet API) | ✗ |
| Tích hợp custodian / broker (đọc tài khoản) | ✗ | ✓ (TradingView Plaid, Koyfin custodian) | ✓ | ✗ |
| Nhập PDF statement | ✗ | ✗ | ✓ (Koyfin) | ✗ |
| DMS / research notes tìm kiếm được | ✗ | ✗ | ✓ (FactSet) | ✗ |
| Widget nhúng bên thứ ba / white-label | ~ (advertising widget của VNInvest) | ✓ (TradingView widget, Webull embeddable, eToro App Store) | ✓ | ✓ (advertising widget) |

## D10. B2B / SaaS / Multi-tenant & Admin
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Multi-tenant SaaS | ✗ | ✓ | ✓ | ✓ |
| Service account / sub-account architecture | ✗ | ✓ (Webull omnibus/anonymized) | ✓ | ✓ |
| PAT / API key cá nhân hóa | ✗ | ✓ | ✓ | ✓ |
| SSO (SAML) | ~ | ✓ | ✓ | ✓ |
| Audit log / compliance trail | ✗ | ✗ | ✓ | ✓ (SOC) |
| Tenant-scoped admin console | ✗ | ✓ | ✓ | ✓ (SOC) |
| Client reporting / proposals (cho advisor) | ✗ | ✓ (Koyfin Advisor) | ✓ | ✗ |
| Model portfolio | ~ | ✓ | ✓ | ✗ |
| Seat-based billing + centralized billing | ✗ | ✓ (TradingView Enterprise, Koyfin Teams) | ✓ | ✓ |
| Onboarding tổ chức / delegated trading | ✓ (VNDIRECT DMA, BSC Open API) | ✓ | ✓ | ✓ |
| Support ticket system cho tenant | ✗ | ✗ | ✗ | ✓ |

## D11. Monetization, Billing & Entitlements
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Bảng giá công khai nhiều tier | ✓ (FireAnt) | ✓ | ✗ (quote-only) | ✗ (theo context) |
| Free tier có giới hạn | ✓ | ✓ | ✗ | ? |
| Paywall theo tính năng AI | ✓ (FireAnt) | ✓ (Robinhood Gold, TV Copilot add-on) | ✗ (bundle) | ✗ |
| Trả tiền theo năm có giảm giá | ✓ (FireAnt −16% 12th, −32% 24th) | ✓ (TV, Koyfin) | ✗ | ? |
| Bán theo seat | ✗ | ✓ | ✓ | ? |
| Platform fee + seat cho enterprise | ✗ | ✓ | ✓ | ? |
| Thanh toán VN (VNPay, QR, chuyển khoản) | ✓ | ✗ | ✗ | ✓ (VNPay + Stripe) |
| Hóa đơn VAT điện tử | ✓ (FireAnt) | ✗ | ✗ | ? |
| Self-serve checkout | ✓ (FireAnt: QR/thẻ/App Store) | ✓ | ✗ | ✓ (VNPay/Stripe) |

## D12. Mobile / Desktop / PWA Delivery
| Capability | VN | QT | TCT | VNInvest |
|---|---|---|---|---|
| Mobile app native (iOS/Android) | ✓ (tất cả) | ✓ | ✓ | ? |
| Web app responsive | ✓ | ✓ | ✓ | ✓ |
| Desktop app chuyên dụng | ✓ (V-Pro, VNDSTOCK) | ✓ (TV, Sierra, etoro edge) | ✓ | ? |
| PWA / web-only là chính | ~ | ~ | ~ | ✓ (web app) |
| Widget OS (iOS/Android home screen) | ✗ | ✓ | ✗ | ? |
| Tích hợp thiết bị đeo / watch | ✗ | ✓ (Apple Watch eToro) | ✗ | ✗ |
| Push notification native | ✓ | ✓ | ✓ | ✓ |

---

# PHẦN 3 — B. WHITE-SPACE ANALYSIS

## B.1. Quy tắc xếp hạng
- **Điều kiện vào white-space:** xuất hiện ở **≥2 lớp đối thủ** (không tính lớp mà VNInvest đã có) **VÀ** context VNInvest không nêu có.
- **Xếp hạng doanh thu** = **[R] suy luận của tôi**, dựa trên: (1) bằng chứng đối thủ đã **thu tiền** cho feature này (paywall thật), (2) khả năng trả tiền trong bối cảnh VN (thu nhập, văn hóa tài chính), (3) chi phí kỹ thuật tương đối, (4) khả năng dùng làm đòn bẩy bán cho B2B.
- **Không có dòng nào trong bảng này khẳng định VNInvest "không có"** với mọi chi tiết — chỉ dựa trên context đã cung cấp. Cột "Cần verify trong code" là bắt buộc trước khi lên kế hoạch.

## B.2. Bảng xếp hạng

| # | Năng lực | Lớp đối thủ có (≥2) | Bằng chứng đối thủ **đã thu tiền** cho nó | Suy luận doanh thu **[R]** | Độ khó kỹ thuật **[R]** | Ưu tiên |
|---|---|---|---|---|---|---|
| **1** | **AI assistant nhúng trong app** (chat đa ngữ cảnh, grounded vào dữ liệu của chính sàn) | VN (FireAnt Copilot/AI Answer, Mira-bot) + QT (TV Copilot, moomoo Assistant, Vega, Cortex Assistant, Tori) + TCT (Bloomberg ASKB, FactSet Intelligence) | FireAnt: Copilot chỉ Chuyên Nghiệp+ (3,83tr/12th); TV Copilot add-on **$7,50/tháng**; Robinhood Cortex **chỉ Gold $5/tháng**; Bloomberg/FactSet: bundle trong seat $12k–$32k | **Rất cao** — là tầng "must-have" của 2026; là điều kiện để user không chuyển sang FireAnt/TradingView. Chi phí = token LLM (VNInvest đã có multi-provider LLM ⇒ chi phí biên thấp) | Thấp–TB (đã có hạ tầng LLM + dữ liệu) | **P0** |
| **2** | **Screener bằng ngôn ngữ tự nhiên** | VN (FireAnt Lọc AI) + QT (TV AI Screener) | FireAnt Lọc AI: Chuyên Nghiệp+; TV AI Screener: **mọi gói trả phí, quota 100–500 req/tháng** (giá trị dùng thử cao) | **Cao** — feature có paywall rõ + dùng hàng ngày + chi phí thấp (parse prompt → filter DSL) | Thấp (nếu có filter DSL sẵn) | **P0** |
| **3** | **Paper trading + backtest với giả định thị trường VN thật** | VN (VNDIRECT ProTrade Trial, FireAnt MetaKit backtest) + QT (TV, moomoo, Webull) + TCT (Sierra simulated, FactSet 1.100+ dataset) | VNDIRECT ProTrade Trial miễn phí (hút funnel); FireAnt MetaKit (Chuyên Nghiệp+); TV paper trading mọi gói trả phí | **Cao** — VNInvest **đã có backtest**; thêm "giả định VN" (lô 100, T+2,5, phí 2 chiều, thuế 0,1%) là **chi phí thấp, giá trị cao**, và là điểm khác biệt duy nhất so với TradingView | Thấp (chỉ cần engine giả định đúng) | **P0** |
| **4** | **Client/advisor workspace** (client portfolios, model portfolio, báo cáo, proposal, attribution, import statement PDF) | QT (Koyfin Advisor Core/Pro) + TCT (Bloomberg, FactSet) + QT (Robinhood TradePMR/RIA, Webull advisor) | **Koyfin Advisor Pro $299/tháng** (≈7,8tr/tháng) — đây là mức **cao nhất** trong nhóm data/analytics retail; Webull Institutional bán cho IB/advisor/fintech | **Rất cao (B2B)** — VNInvest **đã có multi-tenant, SOC, SSO, audit** ⇒ bán được "B2B cho cố vấn tài chính VN" với ưu thế hạ tầng. Không đối thủ VN nào có | TB–Cao | **P0 (B2B)** |
| **5** | **Conditional orders** (OCO, Up/Down, Trailing, Bull&Bear) | VN (SSI iBoard) + QT (Robinhood TP/SL, Webull OCO/Trailing) + TCT (IBKR LIT/MIT/conditional, Sierra server-side OCO/bracket) | Không có paywall riêng (tính năng cốt lõi của broker) — nhưng là **điều kiện giữ chân trader**; VNDIRECT đã có "bộ lệnh chuyên sâu" + "căn bán theo sức mua" | **Cao** — VNInvest có 3 broker lane nhưng chưa có lệnh điều kiện ⇒ mất khả năng "đặt lệnh rồi đóng app" | TB | **P1** |
| **6** | **Orderflow / DOM trên biểu đồ** (volume profile, footprint, TPO, MBO) | QT (TV Volume Profile/footprint/TPO, Webull Level 2, moomoo TotalView) + TCT (Sierra TPO/Numbers Bars/MBO 1400 levels) | TV: Volume Profile **từ Plus ($29,95)**, footprint **từ Premium ($59,95)**, TPO **từ Premium**; Sierra: MBO **+$20/tháng** (package 12) | **TB–Cao** ở phân khúc pro; VN equity **không có L2 như Mỹ** (cấu trúc thị trường khác) ⇒ giá trị đến từ **foreign/proprietary flow depth** chứ không phải MBO | TB | **P1** |
| **7** | **Target allocation / rebalancing / sub-account theo mục tiêu** | VN (VNDIRECT MYDGO) + QT (eToro Target Model + sub-account/goal) + TCT (Koyfin model portfolio) | MYDGO gắn với gói VNDCARE; eToro Smart Portfolio nhập từ $500; Koyfin model portfolios ở Advisor tier ($209+) | **Cao (retention)** — đây là cơ chế **giữ user ở lại** và mở đường AUM/fee-based; VNInvest có **ledger** ⇒ nền để làm lot-level target allocation | TB | **P1** |
| **8** | **Heatmap** (theo ngành/sector, tổng quan thị trường 1 màn hình) | QT (TradingView heatmap) + TCT (Fidelity market snapshot & positions heatmap) | Fidelity: heatmap **miễn phí** cho mọi khách; TV heatmap: điểm vào của plan Essential+ | **TB** — khá rẻ để build, nhưng khó monetize riêng ⇒ nên đóng gói vào tier Pro/Business | Thấp | **P1** |
| **9** | **Công cụ export/integration cho quant** (Excel add-in, Python SDK, AmiBroker/MetaStock connector) | VN (FireAnt for Excel + MetaKit) + QT (IBKR TWS API, Webull OpenAPI) + TCT (FactSet/Bloomberg Excel + API) | FireAnt for Excel: **chỉ Cao Cấp 5,75tr/12th**; FireAnt API cho tổ chức; MetaKit là lý do người dùng chịu trả phí | **Cao (B2B + data licensing)** — là cửa vào để bán "VN market data API" cho quỹ đầu tư & quant trong nước; VNInvest đã có `defaultCoreApiAdapter` + partner API ⇒ nền có sẵn | TB | **P1** |
| **10** | **AI tạo báo cáo / slide / video từ dữ liệu** | VN (FireAnt AI Report, AI Video Slideshow — *chỉ Cao Cấp*) | **FireAnt Cao Cấp 5,75tr/12th** là tier đắt nhất của nhóm VN — AI Report & AI Video chỉ ở tier này ⇒ **tính năng này chính là lý do nâng tier** | **TB–Cao** — dễ demo, dễ bán cho môi giới/analyst nội bộ (content marketing) | TB (cần pipeline render slide/video) | **P2** |
| **11** | **Watchlist chia sẻ / cộng đồng nhóm** | VN (Stockbook, Chatroom, iTrader copy) + QT (TradingView ideas, Robinhood Social, Koyfin shareable watchlists) | Không có paywall riêng — nhưng là **cơ chế viral**; TradingView có community contests theo plan | **TB** — rủi ro pháp lý/đạo đức khi mở cộng đồng "đầu cơ" ở VN; nên giới hạn ở **chia sẻ watchlist/nhóm phân tích**, không mở bình luận công khai | Thấp | **P2** |
| **12** | **Dòng AI "proactive"** (chủ động đẩy insight thay vì chờ hỏi) | QT (eToro proactive insights, Cortex Portfolio Digests, moomoo AI Announcement Summary) + VN (Mirae AI News, thông báo cá nhân hóa AI) | eToro: Tori chủ động báo lý; Cortex Portfolio Digests **chỉ Gold**, refresh nhiều lần/ngày | **Cao (retention)** — khác biệt giữa "AI có" và "AI hữu ích"; VNInvest có SOC + audit + scheduler ⇒ hạ tầng đẩy định kỳ đã có | TB | **P1** |
| **13** | **Cảnh báo qua Zalo / kênh VN-native** | ✗ ở mọi lớp (eToro dùng WhatsApp/Apple Watch; TradingView dùng webhook) | — | **TB** — VN-specific moat: 90%+ NĐT dùng Zalo **[R]**; đối thủ quốc tế không có kênh này; chi phí thấp | Thấp | **P2** |
| **14** | **Robo-advisor / model portfolio cho NĐT** | QT (Webull×BlackRock 5 chiến lược/30 portfolio, eToro Alpha AI) + TCT (Koyfin model portfolio) + VN (MYDGO) | Webull robo-advisor sau khi hợp tác BlackRock; eToro Alpha Portfolios dùng AI | **TB–Cao** — cần compliance quản lý đầu tư; chưa nên làm 90 ngày | Cao | **P3** |
| **15** | **Agent AI tự đặt lệnh** (agentic trading) | QT (Robinhood Agents, moomoo Skills/MCP + sandbox, eToro agent portfolio) + TCT ✗ + VN ✗ | moomoo: **simulation mặc định**, live cần double-confirm; Robinhood Agents rolling out | **TB** — khác biệt lớn nhưng rủi ro pháp lý/compliance cao; **cửa sổ VN còn mở** nhưng chưa phải ưu tiên 90 ngày | Cao | **P3** |
| **16** | **Fractional shares / recurring investment** | QT (Webull, Fidelity, moomoo, eToro) | Webull $1 tối thiểu; Fidelity $1; eToro recurring investment | **Thấp — khả năng triển khai ~0** — thị trường VN yêu cầu **lô chẳng 100 cổ phiếu** (FireAnt MetaKit: `RoundLotSize = 100`) ⇒ fractional không khả thi | — | **Không làm** |
| **17** | **Options / crypto / prediction markets** | QT (Webull, Robinhood, moomoo, eToro) | $0 contract fees (Webull) | **Thấp ở VN** — phái sinh đã có, nhưng options/crypto/prediction cần giấy phép khác; **không nằm trong sản phẩm VNInvest** | — | **Không làm** |

## B.3. Tóm tắt theo nhóm ưu tiên

- **P0 (0–90 ngày, tác động doanh thu cao & chi phí thấp):** AI assistant nhúng app · NL-screener · Paper trading + backtest giả định VN · Advisor/B2B workspace (dùng hạ tầng multi-tenant sẵn có).
- **P1 (90–180 ngày):** Conditional orders · Orderflow/DOM tier cho pro · Target allocation & sub-account · Heatmap · Export/SDK cho quant · AI proactive push.
- **P2 (6–12 tháng):** AI report/slide/video · Chia sẻ watchlist/nhóm · Zalo notifications.
- **P3 (12 tháng+):** Robo-advisor · Agent AI tự đặt lệnh.
- **Không làm:** fractional shares, options/crypto/prediction (không phù hợp cấu trúc thị trường + giấy phép).

---

# PHẦN 4 — C. DIFFERENTIATION (VNInvest có thể tốt hơn đối thủ)

| Lợi thế | Bằng chứng đối thủ **không** có | Cơ sở ở VNInvest | Mức độ khác biệt **[R]** | Cách bán |
|---|---|---|---|---|
| **Dữ liệu dòng tiền VN chuẩn hoá** (nước ngoài / tự doanh / chủ động / cung cầu) **đi kèm tín hiệu, không chỉ là feed** | TradingView, moomoo, Webull, IBKR, Bloomberg, FactSet, Koyfin: **không có dữ liệu dòng tiền VN**. FireAnt **có** dữ liệu này nhưng bán dưới dạng **feed MetaKit cho AmiBroker** (người dùng tự viết AFL) — chưa phải *signal* | Whale/order-flow signals + AI advisory đã có trong context | **Cao** — đây là thứ khó copy nhất: cần dữ liệu dòng tiền + mô hình + niềm tin | Định vị "thị trường VN, không phải global generic" |
| **AI advisory đa-mô hình, có audit & kiểm soát chi phí** (multi-provider LLM, SOC, AI audit log) | Đối thủ VN ship AI **đóng hộp** (FireAnt Copilot, Mira-bot) — không cho user chọn model, không cho tenant kiểm soát. Đối thủ quốc tế để LLM chạy ngoài (moomoo Skills, eToro Grok 4.2) | Multi-provider LLM + SOC + audit log + budget control | **Cao** ở B2B/enterprise; **TB** ở retail (user VN muốn "AI của tôi, giá rẻ") | Bán cho broker/đối tác: *"AI layer bạn tự vận hành, không phụ thuộc model của chúng tôi"* |
| **Multi-tenant SaaS + partner API + SOC cho thị trường VN** | Webull Institutional (Mỹ, có broker/clearing), Koyfin Teams (Mỹ, advisor), TradingView Enterprise (global). **Trong VN: không có đối thủ trực tiếp** — chỉ BSC Open API (broker→app) và FireAnt API (data) | Tenants, PAT, service accounts, partner API, SOC, SSO, billing VNPay/Stripe | **Rất cao — first-mover** | Landing page riêng cho broker/advisor/quant; demo tenant |
| **3 broker lane thật (DNSE/SSI/TCBS)** trên 1 tài khoản SaaS | TradingView: *"trade through selected brokers"* nhưng là broker Mỹ. FireAnt Trading: nhiều CK VN nhưng là **app của FireAnt**. BSC Open API: 1 CK (BSC) + app đối tác | 3 lane + SOC | **Cao** ở use-case "đa môi giới" | Định vị cho người dùng nhiều tài khoản |
| **Realtime WebSocket/SSE + screener scheduling + webhooks** | TradingView webhook **chỉ từ Essential $12,95/tháng** — đây là tính năng trả phí, không phải free. VN: chưa đối thủ nào có webhooks | Đã có | **TB** — parity kỹ thuật, nhưng nên **đóng gói vào tier trả phí** thay vì cho free | Monetize thành feature của Business tier |
| **Advertising widget** | Đối thủ trả phí **loại bỏ quảng cáo** (TV "No ads" là điều kiện của mọi gói trả phí) | Đã có | **TB (2 mặt)** — là nguồn doanh thu cho free tier, nhưng **phải tách khỏi tier trả phí** để không mâu thuẫn với tiêu chuẩn "No ads" | Free tier có ads, paid tier không — đúng chuẩn ngành |
| **Ledger + lot-level P/L** | Koyfin có lot-level P/L nhưng là **theo dõi**; Webull/Wefolio chỉ tạo basket. VNInvest có **ledger** ⇒ nền cho lot-level cost basis, target allocation, tax-aware | Đã có | **TB–Cao** | Bật "Tax-aware P/L theo luật TNCN 0,1%" — chưa đối thủ VN nào làm |
| **Backtest cho thị trường VN** | TradingView backtest dùng giả định **mặc định** (lô 1, không thuế) ⇒ sai với VN. FireAnt MetaKit mới có giả định đúng nhưng phải cài plugin | Đã có backtest; chưa biết có giả định VN | **Cao nếu làm được** | Checklist: lô 100, T+2,5, phí 2 chiều, thuế bán 0,1%, khớp giá mở cửa phiên kế tiếp |
| **Hỗ trợ tiếng Việt đầu-cuối** | TradingView AI Copilot khuyến nghị **tiếng Anh**; FireAnt Quant AI nhận tiếng Việt nhưng chỉ để sinh AFL | Toàn bộ stack VN | **TB** | Marketing: *"AI hiểu báo cáo tài chính tiếng Việt"* |

## C.1. Những thứ VNInvest **không** nên tự khoe (thiếu so với chuẩn ngành)
| Mục | Chuẩn ngành | Trạng thái VNInvest (theo context) |
|---|---|---|
| Số lượng indicator & biểu đồ nâng cao | TradingView 400+ built-in + 100K cộng đồng; Sierra TPO/Numbers Bars/MBO | **?** — cần đếm thật; nếu <50 thì thua xa TradingView về "độ sâu" |
| Backtest tick-level / deep backtesting | TV deep backtesting; FactSet 1.100+ dataset | ? |
| Paper trading | 4 lớp có | ✗ |
| Options/futures/margin/short | 3 lớp có | ✗ (phù hợp bản chất sàn) |
| Social/community | 3 lớp có | ✗ (quyết định cố ý, chấp nhận) |

---

# PHẦN 5 — D. MONETIZATION BLUEPRINT

## D.1. Bảng giá đối thủ — dữ liệu gốc để benchmark

| Sản phẩm | Bảng giá chính thức | Tương đương VND/tháng (26.000đ/USD) **[R]** | Nguồn |
|---|---|---|---|
| **FireAnt Thiết Yếu** (12 tháng) | 1.429.000đ/năm | 119.000đ/tháng | [Bảng giá](https://company.fireant.vn/bang-gia) |
| **FireAnt Chuyên Nghiệp** (12 tháng) | 3.830.000đ/năm | 319.000đ/tháng | [Bảng giá](https://company.fireant.vn/bang-gia) |
| **FireAnt Cao Cấp** (12 tháng) | 5.750.000đ/năm | 479.000đ/tháng | [Bảng giá](https://company.fireant.vn/bang-gia) |
| **TradingView Essential** | $12,95/tháng (năm) / $14,95 (tháng) | 337.000đ | [Pricing](https://www.tradingview.com/pricing/) |
| **TradingView Plus** | $29,95 / $34,95 | 779.000đ | [Pricing](https://www.tradingview.com/pricing/) |
| **TradingView Premium** | $59,95 / $69,95 | 1.559.000đ | [Pricing](https://www.tradingview.com/pricing/) |
| **TradingView Ultimate** (chỉ professional) | $199,95 / $239,95 | 5.199.000đ | [Pricing](https://www.tradingview.com/pricing/) |
| **TradingView AI Copilot add-on** | $7,50/tháng | 195.000đ | [Bullynx (T)](https://bullynx.com/blog/tradingview-ai-chart-copilot-review) |
| **Koyfin Plus** | $39/tháng | 1.014.000đ | [Pricing](https://www.koyfin.com/pricing/) |
| **Koyfin Premium** | $79/tháng | 2.054.000đ | [Pricing](https://www.koyfin.com/pricing/) |
| **Koyfin Advisor Core** | $209/tháng | 5.434.000đ | [Pricing](https://www.koyfin.com/pricing/) |
| **Koyfin Advisor Pro** | $299/tháng | 7.774.000đ | [Pricing](https://www.koyfin.com/pricing/) |
| **Moomoo Engine** | $3,99/tháng ($39,90/năm); $0,99 nếu tài sản >$1.000 | 104.000đ (26.000đ nếu đủ điều kiện) | [Engine](https://www.moomoo.com/us/learn/what-is-moomoo-engine) |
| **Webull Premium** | $3,99/tháng hoặc $40/năm | 104.000đ | [Gainsumo (T)](https://gainsumo.com/broker-reviews/webull/) |
| **Robinhood Gold** | $5/tháng hoặc $50/năm | 130.000đ | [Yes-No](https://robinhood.com/us/en/newsroom/robinhood-presents-yes-no-event/) |
| **Sierra Chart Integrated Advanced MBO** | $56/tháng (năm $436,80) | 1.456.000đ | [Packages](https://www.sierrachart.com/index.php?l=doc%2FPackages.php&language=en) |
| **Bloomberg Terminal** | $31.980/năm/seat | 2.665.000đ/tháng | [BlueGamma (T)](https://www.bluegamma.io/post/bloomberg-terminal-pricing) |
| **FactSet Workstation** (chỉ báo giá) | ~$12.000/năm (standard) → $22k–30k (full) | 1.000.000đ/tháng → 1.83–2.5tr | [Investables (T)](https://investables.ai/blog/how-much-does-factset-cost) |

**Điểm định vị giá (suy luận [R]):**
- **Sàn VN**: 119.000–479.000đ/tháng (FireAnt) — người dùng VN quen trả 1–5 triệu/năm cho phân tích.
- **Trần quốc tế retail**: 1–2tr/tháng (TradingView Plus/Premium).
- **Trần quốc tế pro/B2B**: 5,4–7,8tr/tháng/seat (Koyfin Advisor), 2,6tr/tháng/seat (Bloomberg).
- ⇒ VNInvest nên có **3 mốc**: ~150k (retail entry), ~1–2tr (pro), ~5–8tr/seat (business).

## D.2. Cấu trúc tier đề xuất cho VNInvest (6 bậc: 0–5)

> **[R] Toàn bộ phần này là đề xuất sản phẩm của tôi**, dựa trên benchmark giá ở D.1 và danh sách khoảng trống ở Phần B. Giá chưa được kiểm chứng với khách hàng.

### Tier 0 — **Miễn phí** ("Xem & Thử")
- **Giá:** 0đ. Có quảng cáo (advertising widget — đã có).
- **Bao gồm:** watchlist (giới hạn ~30 mã), biểu đồ realtime **delayed/EOD**, screener cơ bản (≤10 tiêu chí), portfolio thủ công nhập tay, cảnh báo giá cơ bản (giới hạn 3–5 mã), **AI advisory giới hạn** (ví dụ 3 lượt/tháng, **không có AI chat**), tài liệu học.
- **Không có:** AI chat, paper trading, order placement, export, webhook, backtest, SOC.
- **Mục tiêu:** acquisition + quảng cáo. Đối chiếu: TradingView Basic (1 chart, 2 indicator, 3 alert, 30 mã/watchlist) — **rộng hơn** TradingView về watchlist để tạo thói quen VN.

### Tier 1 — **Cơ bản** ("Theo dõi & Lọc")
- **Giá đề xuất:** **149.000đ/tháng** hoặc **1.490.000đ/năm** (≈ $5,7/tháng; $57/năm) — *thấp hơn FireAnt Thiết Yếu* (119k/tháng khi trả năm… đương đương) nhưng có thêm **AI chat ở mức giới hạn** để tạo khác biệt.
- **Bao gồm:** realtime market data (HOSE/HNX/UPCom), screener đầy đủ + **lịch quét định kỳ**, watchlist không giới hạn, portfolio + ledger đầy đủ, cảnh báo (email + push + **Zalo**), **AI assistant (chat) giới hạn ~100 lượt/tháng**, backtest cơ bản, export CSV.
- **Đối chiếu:** moomoo Engine $3,99 ≈ 104k/tháng, Webull Premium 104k/tháng, Robinhood Gold 130k/tháng ⇒ **149k là cạnh tranh và có thể bán được**.

### Tier 2 — **Pro** ("Nhà giao dịch & Nhà phân tích")
- **Giá đề xuất:** **499.000đ/tháng** hoặc **4.490.000đ/năm** (≈ $19/tháng; $173/năm).
- **Bao gồm (mọi thứ Tier 1) +:** **AI advisory đầy đủ (multi-provider)**, **NL-screener**, **paper trading** + backtest **với giả định thị trường VN**, **conditional orders** (OCO/Trailing/Up-Down) trên DNSE lane, **whale/order-flow signals đầy đủ**, heatmap, corporate actions trên biểu đồ, **webhooks**, multi-tab chart, nhiều workspace lưu, export XLSX, **Zalo/Telegram/Slack notification**, priority support.
- **Đối chiếu:** TradingView Plus $29,95 ≈ 779k/tháng — VNInvest Pro **rẻ hơn 36%** nhưng kém về charting depth ⇒ **phải bù bằng AI + dữ liệu VN**. FireAnt Chuyên Nghiệp 319k/tháng ⇒ Pro ở giữa, hợp lý.

### Tier 3 — **AI Add-on** (mua thêm, theo TradingView Copilot pattern)
- **Giá đề xuất:** **199.000đ/tháng** (≈ $7,7 — bám sát TradingView AI Copilot $7,50) hoặc **gộp vào Pro**.
- **Bao gồm:** AI chat không giới hạn, AI report/slide, AI NL-screener không giới hạn, ưu tiên model (BYOK cho doanh nghiệp).
- **Cơ chế:** dùng cho khách đã ở Tier 1/2 muốn nâng AI mà không nâng cả tier ⇒ **đường nâng cấp doanh thu cao nhất** (TradingView chứng minh mô hình này).

### Tier 4 — **Business / Tenant** (bán cho công ty: broker, cố vấn, quỹ, media)
- **Giá đề xuất:** **platform fee 3.000.000–8.000.000đ/tháng/tenant** (theo số user & module) **+ seat 1.290.000–1.990.000đ/tháng/người**.
- **Bao gồm:** toàn bộ Pro + **tenant admin console** (user, role, quota, SSO/SAML, audit log, SOC dashboard) + **partner API** (read + order + webhook) + **white-label widget** (dùng advertising widget hiện có thành widget nhúng cho đối tác) + **client/advisor workspace** (client portfolios, model portfolios, báo cáo định kỳ, import statement) + **AI budget control theo tenant** (multi-provider + cost cap) + SLA + onboarding.
- **Đối chiếu:** Koyfin Advisor Core $209 ≈ 5,43tr/tháng (seat) — **VNInvest Business rẻ hơn 60%+** nhưng kém về custodian integrations; bù bằng **SOC + audit + multi-tenant + API** mà Koyfin không có.

### Tier 5 — **Enterprise** (B2B2B: broker dùng làm nền tảng, hoặc white-label cho đối tác)
- **Giá đề xuất:** **15.000.000–60.000.000đ/tháng/tenant** (platform) + seat riêng + **phí dữ liệu theo volume** (giống Bloomberg tách phí data + phí sàn, hoặc Webull "Overage" theo volume).
- **Bao gồm:** toàn bộ Business + **API giao dịch thương mại** (nhiều broker lane) + **data licensing** + **SOC/audit đạt yêu cầu đối tác** + SLA 99,9% + hỗ trợ triển khai + tùy biến.
- **Đối chiếu:** TradingView Enterprise (100+ seats, liên hệ sales) — cùng mô hình; Bloomberg $31.980/năm/seat là trần tham chiếu cho giá trị dữ liệu.

### D.3. Ma trận entitlement đề xuất (mẫu)
| Nhóm tính năng | Free | Cơ bản | Pro | AI add-on | Business | Enterprise |
|---|---|---|---|---|---|---|
| Realtime market data | delayed | ✓ | ✓ | ✓ | ✓ | ✓ |
| Watchlist / screener cơ bản | ✓ (giới hạn) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Screener nâng cao + lịch quét | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **NL-screener** | ✗ | ✗ | ✓ (giới hạn) | ✓ (không giới hạn) | ✓ | ✓ |
| **AI chat** | ✗ (chỉ advisory 3 lượt) | ✓ (100 lượt) | ✓ (500 lượt) | ✓ (∞) | ✓ (∞ + quota) | ✓ (∞ + quota) |
| Portfolio + ledger | nhập tay | ✓ | ✓ | ✓ | ✓ | ✓ |
| Backtest | ✗ | cơ bản | ✓ (giả định VN) | ✓ | ✓ | ✓ |
| **Paper trading** | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| **Conditional orders** | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Whale/order-flow signals | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Order placement (DNSE/SSI/TCBS) | ✗ | ✗ | ✓ (DNSE) | ✓ | ✓ | ✓ |
| Webhooks / API read | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Export XLSX / SDK | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Tenant admin + SSO + SOC + audit | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Client/advisor workspace | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| White-label / partner API | ✗ | ✗ | ✗ | ✗ | add-on | ✓ |
| Quảng cáo | có | ✗ | ✗ | ✗ | ✗ | ✗ |

## D.4. Nguồn doanh thu ngoài subscription **[R]**
| Nguồn | Mô hình | Đối chiếu | Ghi chú |
|---|---|---|---|
| **Affiliate / referral broker** | hoa hồng mở tài khoản + khối lượng giao dịch | FireAnt × Shinhan (free trading fee vĩnh viễn + trả phí FireAnt Pro) **[V]** | Cần rà soát pháp lý UBCKNN về referral fee — **CHƯA XÁC MINH** |
| **Data licensing** | thuê dữ liệu VN cho quant/tổ chức | FireAnt API; FactSet/Bloomberg phí data riêng **[V]** | Cần xác minh giấy phép cung cấp dữ liệu hàng hóa/thị trường |
| **Paper trading / sandbox B2B** | phí theo tenant | moomoo Sandbox Trading, Webull Institutional **[V]** | |
| **Ads** | free tier | — | Đã có advertising widget |
| **Model portfolio / robo-lite** | phí quản lý | eToro, Webull×BlackRock, Koyfin **[V]** | Cần compliance |
| **AI usage overage** | trả theo token | Bloomberg/TradingView bundle, FactSet quote-only | Hợp với SOC có budget control |

---

# PHẦN 6 — E. ROADMAP 90 NGÀY vs 12 THÁNG

## E.1. 90 ngày (Q4/2026 – Q1/2027) — theme: **"Đóng AI gap + mở đường B2B"**

| Theme | Hạng mục | Lý do (đối chiếu) | Ưu tiên |
|---|---|---|---|
| **T1. AI trong workflow** | (a) **AI chat nhúng** vào portfolio/screener/mã cổ phiếu, grounded vào dữ liệu VN của chính VNInvest, có trích dẫn nguồn (giống moomoo link data source) | FireAnt Copilot [V], TV Copilot [V], Robinhood Cortex [V] — cả 3 lớp đều có | P0 |
| | (b) **NL-screener**: prompt tiếng Việt → bộ lọc + cột + thứ tự, **có "Explanation"** minh bạch từng filter (như TV) | FireAnt Lọc AI [V], TV AI Screener [V] | P0 |
| | (c) **AI proactive digest**: mỗi sáng gửi "hôm qua danh mục của bạn tăng/giảm vì…" (VN-Index/VN30 benchmark) | Cortex Portfolio Digests [V], eToro proactive [V] | P0 |
| **T2. Đúng "chất VN"** | (d) **Backtest & paper trading với giả định VN**: lô 100, T+2,5, phí 2 chiều, thuế bán 0,1%, khớp giá mở cửa phiên kế tiếp | FireAnt MetaKit [V] (chi tiết chính xác đã đọc), TCBS Backtest [V] | P0 |
| | (e) **Cảnh báo qua Zalo** (Zalo OA) + Telegram/Slack/Discord | eToro dùng WhatsApp [V]; moomoo/SimianX dùng Discord/Telegram [T] — **chưa đối thủ nào có Zalo** | P1 |
| | (f) **Tax-aware P/L theo thuế TNCN 0,1%** + lot-level cost basis (đã có ledger) | Fidelity portfolio-level backtesting [V], Robinhood tax-aware [V] | P1 |
| **T3. Charting & discovery parity** | (g) **Heatmap** theo ngành + tổng quan thị trường 1 màn hình | TV [V], Fidelity [V] | P1 |
| | (h) **Corporate actions trên biểu đồ** (cổ tức, chia tách, quyền, ngày đáo hạn) | FireAnt [V], TV [V], SSI iBoard (tab Entitlement) [V] | P1 |
| | (i) **Đếm & đếm lại thư viện indicator**; nếu <50 thì lập kế hoạch bổ sung; nếu không, **dùng widget `vninvestcharts-widget` ^1.2.5** và công bố bộ indicator của VN | TV 400+ built-in + 100K cộng đồng [V] | P0 (**verify trước**) |
| **T4. Mở B2B** | (j) **Landing page + demo tenant** cho broker/cố vấn; **tenant admin console v2** (user, role, quota, SSO, audit export) | Webull Institutional [V], Koyfin Teams [V], TradingView Enterprise [V] | P0 |
| | (k) **Bảng giá công khai** đúng cấu trúc D.2 + cổng thanh toán (VNPay/Stripe đã có) | FireAnt bảng giá công khai [V], TV bảng giá công khai [V] | P0 |
| | (l) **Xác minh `?` trong ma trận A** (indicator count, backtest assumptions, corporate actions, TBT, dividend, risk metrics, export CSV) — quyết định tier thật | Bắt buộc trước khi công bố giá | **P0 (tiền đề)** |

**Định nghĩa "Done" cho 90 ngày [R]:** AI chat chạy được trên dữ liệu VN thật với trích dẫn; NL-screener sinh đúng filter có Explanation; backtest khớp giả định FireAnt (verify bằng 1 case số liệu thật); ≥1 khách hàng B2B ký trial Business tier; bảng giá publish.

## E.2. 12 tháng (Q4/2026 – Q3/2027) — theme: **"Terminal VN + Nền tảng cho đối tác"**

| Theme | Hạng mục | Đối chiếu | Ưu tiên |
|---|---|---|---|
| **T5. Advisor/B2B workspace** | Client portfolios, **model portfolios**, báo cáo định kỳ (PDF/Excel) có branding, import statement, **attribution**, so sánh tới 5 portfolio | Koyfin Advisor Core/Pro $209/$299 [V] — mức giá cao nhất trong nhóm | **P0** |
| **T6. Execution depth** | **Conditional orders** (OCO, Up/Down, Trailing, Bull&Bear) trên DNSE; mở rộng lane **SSI + TCBS**; **1-click order** có guardrail; idempotency cho API order | SSI iBoard [V] (đã có, chứng tỏ khả thi ở VN) | P1 |
| **T7. Quant/data export** | **Excel add-in** (market + portfolio) + **Python SDK** + connector cho AmiBroker/MetaStock (nếu thị trường đủ lớn) | FireAnt for Excel + MetaKit [V] | P1 |
| **T8. Orderflow tier (pro)** | Volume profile, footprint, TPO, market depth cho 3 sàn; **foreign/proprietary flow depth** là điểm khác biệt VN | TV orderflow (Plus/Premium) [V], Sierra [V] | P1 |
| **T9. Wealth features** | Target allocation + **auto-rebalance** theo mục tiêu; **sub-account theo mục tiêu** (như eToro "sub-account cho từng mục tiêu"); DRIP; dividend calendar | VNDIRECT MYDGO [V], eToro [V], Koyfin model portfolio [V] | P1 |
| **T10. AI content & automation** | **AI report / slide** cho môi giới & content creator; AI tạo kế hoạch giao dịch có entry/stop/target/size (như TV AI Copilot) | FireAnt AI Report/Video [V] (chỉ tier cao nhất) | P2 |
| **T11. White-label / partner ecosystem** | **Widget nhúng theo thương hiệu đối tác** (từ advertising widget sẵn có) + **App/Plugin marketplace** (tương tự eToro App Store / Builders' Portal) | eToro [V], TradingView Enterprise [V], Webull Institutional embeddable [V] | P2 |
| **T12. Agent AI (sandbox-first)** | MCP/REST tool cho AI agent bên ngoài (theo mô hình moomoo Skills/MCP), **mặc định paper trading**, yêu cầu xác nhận 2 lớp cho live | moomoo [V], Robinhood Agents [V] | P3 |
| **T13. Compliance & trust** | Audit log đầy đủ (đã có SOC) → **đóng gói thành tính năng bán cho broker**: "AI audit trail cho giao dịch & tư vấn" | Không đối thủ nào ở VN có; Bloomberg/FactSet chỉ có research mgmt | P1 (**differentiator thật**) |

## E.3. Rủi ro & giả định cần owner chốt **[R]**
1. **Ai là khách hàng trả tiền chính?** Retail NĐT hay Business/tenant? Hai mô hình giá khác nhau 10×; chọn sai sẽ giết tốc độ.
2. **VNInvest có được phép định giá "AI khuyến nghị"** (crossing từ công cụ sang tư vấn đầu tư)? Cần rà soát với UBCKNN — **CHƯA XÁC MINH**.
3. **Có được bán lại dữ liệu thị trường VN cho bên thứ ba không?** Đây là nguồn doanh thu B2B lớn nhưng có rủi ro pháp lý về bản quyền dữ liệu VSDC/HOSE — **CHƯA XÁC MINH**.
4. **Ai trả phí giao dịch DNSE?** Context nói có DNSE live order placement nhưng **không nói rõ** VNInvest có thu commission hay chỉ là công cụ. Ảnh hưởng trực tiếp mô hình doanh thu.
5. **Đối thủ trực tiếp cho tier data/analysis VN là FireAnt, không phải TradingView.** Bất kỳ roadmap nào không so với FireAnt là so sai.

---

# PHẦN 7 — PHỤ LỤC

## 7.1. Danh sách nguồn chính (URL đầy đủ)
### Lớp VN
- VNDIRECT DBOARD — https://www.vndirect.com.vn/dboard/
- VNDIRECT DPLATFORM — https://www.vndirect.com.vn/cong-giao-dich-dplatform
- VNDIRECT DTRADE FAQ — https://support.vndirect.com.vn/hc/vi/articles/63304006470681-FAQ-về-nền-tảng-giao-dịch-DTRADE
- VNDIRECT DTA — https://www.vndirect.com.vn/dta/
- VNDIRECT Biểu phí DTA — https://www.vndirect.com.vn/bieu-phi-tai-khoan-da/
- VNDIRECT DSTOCK — https://dautu.vndirect.com.vn/dstock/
- VNDIRECT DGO — https://dautu.vndirect.com.vn/dgo/
- VNDIRECT Tiêu điểm thị trường — https://www.vndirect.com.vn/xem-thong-tin-tieu-diem-thi-truong-chung-khoan-o-dau/
- VNDIRECT Tiêu chí chọn cổ phiếu — https://www.vndirect.com.vn/cac-yeu-to-de-lua-chon-co-phieu-tieu-diem/
- SSI User Guide i-Board (PDF) — https://www.ssi.com.vn/upload/files/Userguide%20I-Board.pdf
- SSI Place orders iBoard Pro — https://www.ssi.com.vn/en/individual-customer/place-orders-on-equity-market-ib-app-pro
- SSI Biểu giá — https://www.ssi.com.vn/khach-hang-ca-nhan/bieu-phi/bieu-gia-dich-vu-giao-dich-chung-khoan
- SSI FAQ dịch vụ — https://www.ssi.com.vn/khach-hang-ca-nhan/dich-vu-giao-dich-faq
- SSI iBoard Pro App Store — https://apps.apple.com/us/app/ssi-iboard-pro/id6444309036
- FireAnt Bảng giá — https://company.fireant.vn/bang-gia
- FireAnt Help Center — https://help.fireant.vn/
- FireAnt Compare (free tiers) — https://corporate.fireant.vn/Home/Compare
- FireAnt Trading hướng dẫn — https://trading.fireant.vn/huong-dan/
- FireAnt MetaKit 6 — https://company.fireant.vn/services/individual/metakit
- FireAnt MetaKit AFL guide — https://metakit.fireant.vn/help/v6/amibroker/du-lieu-trong-afl.html
- FireAnt API — https://api.fireant.vn/
- FireAnt Đối tác — https://company.fireant.vn/partner
- FireAnt Mobile (3tr+ user) — https://m.fireant.vn/
- Shinhan × FireAnt — https://shinhansec.com.vn/en/customer-support/event-promotion/114/shinhan-securities-vietnam-and-fireant-integrate-stock-account-opening-and-trading-directly-on-the-fireant-app.html
- TCBS iFuture — https://www.tcbs.com.vn/ca-nhan/chung-khoan-phai-sinh-ifuture/
- TCBS Mở tài khoản (AI/Backtest/Định giá/Margin) — https://www.tcbs.com.vn/mo-tai-khoan-giao-dich-co-phieu-tai-tcbs
- TCBS Biểu phí phái sinh — https://help.tcbs.com.vn/bieu-phi-giao-dich-chung-khoan-phai-sinh/
- TCBS iTrader — https://help.tcbs.com.vn/hoi-nhanh-dap-hay/icopy/icopy-phai-sinh/itrader/
- Vietcap Biểu phí — https://www.vietcap.com.vn/huong-dan-chung/bieu-phi-dich-vu
- Vietcap Pro — https://www.vietcap.com.vn/huong-dan-chung/gioi-thieu-vietcap-pro
- Vietcap VCI Mobile S — https://www.vietcap.com.vn/huong-dan-chung/gioi-thieu-vci-mobile-s
- Vietcap Google Play — https://play.google.com/store/apps/details?hl=vi&id=com.vcsc.vietcap
- Mirae M-STOCK ra mắt — https://masvn.com/article/mo-ra-phong-cach-dau-tu-moi-m-stock-206547
- Mirae e-trading — https://www.masvn.com/en/e-trading
- Mirae Ngừng My Asset — https://masvn.com/article/thong-bao-ngung-hoat-dong-ung-dung-my-asset-tu-10042026-va-chuyen-doi-sang-m-stock-750683
- Mirae Zero Fee — https://masvn.com/article/chuong-trinh-uu-dai-mien-phi-giao-dich-1043550
- BSC Open API — https://new.bsc.com.vn/san-pham-moi/open-api-gioi-thieu-san-pham

### Lớp quốc tế
- TradingView Pricing — https://www.tradingview.com/pricing/
- TradingView Features — https://www.tradingview.com/features/
- TradingView AI Copilot blog — https://www.tradingview.com/blog/en/ai-copilot-now-on-tradingview-61231/
- TradingView AI Copilot support — https://www.tradingview.com/support/solutions/43000795131-getting-started-with-ai-copilot/
- TradingView AI Copilot usage limit — https://www.tradingview.com/support/solutions/43000795141-ai-copilot-usage-limit/
- TradingView AI Screener support — https://www.tradingview.com/support/solutions/43000785770-how-to-use-the-ai-screener/
- TradingView AI Screener blog — https://www.tradingview.com/blog/en/ai-screener-60101/
- TradingView Pine Screener — https://www.tradingview.com/support/solutions/43000742436-tradingview-pine-screener-key-features-and-requirements/
- TradingView Screener chart view — https://www.tradingview.com/blog/en/screener-chart-view-indicators-60757/
- moomoo Engine — https://www.moomoo.com/us/learn/what-is-moomoo-engine
- moomoo AI — https://www.moomoo.com/us/learn/moomoo-ai-invest-forward-and-easier
- moomoo AI trading (SKILL/MCP/OpenAPI) — https://www.moomoo.com/au/feature/aitrading
- moomoo Paper trading — https://www.moomoo.com/us/papertrading
- moomoo Best AI tools — https://www.moomoo.com/us/learn/best-ai-stock-trading-tools
- moomoo US home — https://www.moomoo.com/us/
- Webull Trading & Investing — https://www.webull.com/trading-investing
- Webull paperTrade — https://www.webull.com/paper-trading
- Webull Fractional shares — https://www.webull.com/help/faq/10959-Trading-Fractional-Shares
- Webull Open API — https://www.webull.com/open-api
- Webull Broker API — https://developer.webull.com/apis/docs/broker-api/getting-started.md
- Webull Institutional (PR Newswire) — https://www.prnewswire.com/news-releases/webull-launches-institutional-platform-for-brokers-hedge-funds-advisors-fintechs-and-financial-institutions-302818682.html
- Webull Q4 2025 earnings — https://www.marketscreener.com/news/webull-reports-fourth-quarter-and-full-year-2025-financial-results-earnings-presentation-ce7e5fdadb8cff22
- Fidelity Why Fidelity — https://www.fidelity.com/why-fidelity/trading
- Fidelity Advanced trading — https://www.fidelity.com/investing/advanced-trading
- Fidelity Compare — https://www.fidelity.com/trading/compare-us
- Fidelity Fractional — https://www.fidelity.com/trading/fractional-shares
- Robinhood Summit 2026 — https://robinhood.com/us/en/support/articles/hood-summit-2026-product-announcements/
- Robinhood Cortex Digests — https://robinhood.com/us/en/support/articles/cortex-digests/
- Robinhood Yes-No event — https://robinhood.com/us/en/newsroom/robinhood-presents-yes-no-event/
- IBKR TWS — https://www.interactivebrokers.com/en/trading/tws.php
- IBKR API — https://www.interactivebrokers.com/en/trading/ib-api.php
- IBKR Order types — https://www.interactivebrokers.com/en/trading/ordertypes.php
- IBKR release notes 2026 — https://www.ibkrguides.com/releasenotes/prod-2026.htm
- eToro Platforms — https://www.etoro.com/trading/platforms/
- eToro Tori — https://www.etoro.com/trading/platforms/tori/
- eToro Press release 07/2026 — https://www.etoro.com/en-us/news-and-analysis/latest-news/press-release/etoro-launches-new-app-ai-first-smart-and-social/
- eToro Smart Portfolios — https://www.etoro.com/investing/portfolios/
- eToro Super App — https://www.etoro.com/about/building-the-financial-super-app/

### Lớp tổ chức
- Bloomberg ASKB — https://professional.bloomberg.com/products/bloomberg-terminal/ai/askb/
- Bloomberg Meet ASKB — https://professional.content.cirrus.bloomberg.com/professional2023/insights/press-announcement/meet-askb-a-first-look-at-the-future-of-the-bloomberg-terminal-in-the-age-of-agentic-ai/
- FactSet Workstation — https://www.factset.com/marketplace/catalog/product/factset-workstation
- FactSet Pricing — https://www.factset.com/factset-pricing
- Sierra Chart Packages — https://www.sierrachart.com/index.php?l=doc%2FPackages.php&language=en
- Sierra Chart Features — https://www.sierrachart.com/index.php?page=doc%2FFeatures.php
- Sierra Chart Teton — https://www.sierrachart.com/index.php?page=doc%2FSierraChartDirectOrderRoutingService.php
- Sierra Chart home — https://www.sierrachart.com/
- Koyfin Pricing — https://www.koyfin.com/pricing/
- Koyfin Plans comparison — https://www.koyfin.com/pricing/plans-comparison/
- Koyfin Features — https://www.koyfin.com/features/
- Koyfin Functionality — https://www.koyfin.com/help/topic/functionality/
- Koyfin LLM info — https://www.koyfin.com/llm-info/

### Nguồn thứ ba (đánh dấu [T])
- TradingView add-on price — https://bullynx.com/blog/tradingview-ai-chart-copilot-review
- TradingView plans 2026 — https://chartwatch.tv/tradingview-plans
- TradingView pricing 2026 — https://www.moneyflock.com/contents/articles/tradingview-pricing-2026-plans-costs-limits
- Bloomberg pricing — https://www.bluegamma.io/post/bloomberg-terminal-pricing
- Bloomberg cost (Investopedia) — https://www.investopedia.com/terms/b/bloomberg_terminal.asp
- Bloomberg/FactSet/Refinitiv/CIQ matrix — https://ctacquisitions.com/refinitiv-vs-bloomberg-vs-factset-vs-capital-iq/
- Bloomberg AI guide — https://artificial-intelligence-wiki.com/industry-ai/financial-services-ai-applications/bloomberg-terminal-ai/
- FactSet pricing — https://investables.ai/blog/how-much-does-factset-cost
- FactSet pricing (Market Ontology) — https://marketontology.com/factset-pricing-explained
- FactSet review (MIT) — https://marketintelligencetools.com/reviews/factset/
- Sierra Chart review — https://tradingview-alternatives.com/sierra-chart-review/
- Koyfin review (Aicentral) — https://www.aicentralresources.com/tool/koyfin
- Koyfin vs FactSet (TrustRadius) — https://www.trustradius.com/compare-products/factset-vs-koyfin
- moomoo review (Finder) — https://www.finder.com/stock-trading/moomoo-review
- Webull review (Gainsumo) — https://gainsumo.com/broker-reviews/webull/
- Robinhood Q1 2026 transcript — https://www.fool.com/earnings/call-transcripts/2026/04/28/robinhood-hood-q1-2026-earnings-transcript/

## 7.2. Caveat quan trọng
- Báo cáo này **không audit repo VNInvest**; cột "VNInvest" trong ma trận A dựa trên context do owner cung cấp. Các ô `?` **phải verify trong code** trước khi dùng để ra quyết định.
- Giá của Bloomberg, FactSet, Sierra Chart, Koyfin, Webull Premium, TradingView AI Copilot add-on là **số từ nguồn thứ ba** (Bloomberg/FactSet không công bố bảng giá). Phải xác minh khi đàm phán thật.
- Tỷ giả 26.000đ/USD là **giả định làm việc**.
- Các đánh giá "xếp hạng doanh thu", "độ khó kỹ thuật", "cấu trúc tier" và "roadmap" là **suy luận sản phẩm [R]**, cần Owner xác nhận trước khi cam kết.
- **Chưa commit.** Theo `AGENTS.md` + `docs/AGENT_PROTOCOL.md`, file mới trong `docs/` cần: khai claim trong `docs/CLAIMS.md`, append 1 `## Entry N` riêng trong `docs/CODE_CHANGE_AUDIT_LEDGER.md`, và đi qua `scripts/pre-push-gate.mjs` + `node packages/web/scripts/check-multi-agent.mjs`.
