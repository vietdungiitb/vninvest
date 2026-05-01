# AI TRADING INFRASTRUCTURE UPGRADE ROADMAP

**Date:** 2026-05-01
**Context:** Chuyển đổi tính năng AI Advisory thụ động thành một AI Trading Infrastructure tự chủ, đa tác tử và tích hợp Model Context Protocol (MCP). Bản thiết kế này được truyền cảm hứng từ repository `tradingview-mcp`.

---

## 1. Bối cảnh & Nghiên cứu (Nguồn cảm hứng: tradingview-mcp)

`tradingview-mcp` là một kiến trúc AI trading open-source tích hợp trực tiếp với Claude Desktop, nổi bật với:
- **Khung tranh luận Đa tác tử (Multi-Agent Debate):** Sử dụng 3 agents (Technical, Sentiment, Risk) để ra quyết định (STRONG BUY/SELL).
- **Natural Language Backtesting Engine:** Cho phép AI tự mô phỏng chiến lược và trả về Win Rate, Sharpe Ratio.
- **Dữ liệu thời gian thực:** Kết nối với các nguồn giá và tin tức.

**Lợi thế của VNINVEST:**
VNINVEST sở hữu các luồng dữ liệu độc quyền, sâu sắc hơn so với dữ liệu public:
- Order Flow Radar & Heatmap.
- Whale Analytics (CVD, Buy Strength, Institutional Strength).
- Money Flow Control Center.
Kết hợp mô hình của `tradingview-mcp` với lõi dữ liệu VNINVEST sẽ tạo ra một cỗ máy giao dịch AI có lợi thế cạnh tranh vô cùng lớn.

---

## 2. Tầm nhìn Kiến trúc (Architectural Vision)

**Hiện tại (AI Advisory):**
- Input: User Prompt + Dữ liệu KLine/Whale tĩnh.
- Xử lý: Một LLM prompt đơn giản tổng hợp dữ liệu và trả về Text (Single-Agent).
- Output: Lời khuyên giao dịch thụ động trên giao diện Web.

**Mục tiêu (AI Trading Infrastructure):**
- Input: Natural Language Query / API requests / Desktop MCP Clients.
- Xử lý: **Multi-Agent Debate Framework** (Nhiều Agent chuyên biệt tranh luận) có khả năng Function Calling.
- Output: Tín hiệu giao dịch (STRONG BUY/SELL) có độ tự tin cao, kèm theo Report Backtest, được expose không chỉ trên Web App mà còn qua **MCP Server**.

---

## 3. Lộ trình Triển khai (4 Giai đoạn)

### Phase 1: Xây dựng Multi-Agent Debate Framework (Nền tảng Tác tử)
*Mục tiêu: Đập bỏ cấu trúc Single-Prompt AI hiện tại, thay bằng mô hình nhóm tác tử chuyên gia có khả năng dùng Tool (Function Calling).*

1. **Thiết kế System Prompts và Roles:**
   - **OrderFlow/Whale Analyst Agent:** Được cấp quyền truy cập các hàm query dữ liệu từ `Money Flow Control Center`, `CVD`, `Institutional Strength`. Đánh giá sức mạnh dòng tiền ngầm.
   - **Technical Analyst Agent:** Được cấp quyền truy cập dữ liệu KLine, đường MA, RSI, MACD và mô hình nến (Candlestick Patterns).
   - **Risk Manager Agent:** Phân tích độ biến động (Volatility), thanh khoản, và rủi ro điều chỉnh chung của thị trường (Global Screener Signals).
2. **Orchestrator (Bộ điều phối):**
   - User gửi câu hỏi -> Orchestrator chia task cho 3 Agents -> Các Agents trả về nhận định (Bullish/Bearish kèm Score) -> Orchestrator tổng hợp thành 1 Decision cuối cùng (Ví dụ: `STRONG BUY`, Confidence: 85%).
3. **Cập nhật Backend (Django):**
   - Viết các service layer để bọc các hàm query dữ liệu nội bộ của VNINVEST thành "Tools" cho AI (theo chuẩn OpenAI Function Calling hoặc Anthropic Tools).

### Phase 2: Natural Language Backtesting Engine (Công cụ Mô phỏng Thực chiến)
*Mục tiêu: Cung cấp cho AI khả năng kiểm chứng giả thuyết giao dịch dựa trên dữ liệu lịch sử Intraday Tick và KLine của VNINVEST.*

1. **Xây dựng Backtest Core (Python/Django):**
   - Tạo một module Backtester nhận input là các luật (Rules) dạng JSON.
   - Engine sẽ chạy qua dữ liệu lịch sử và tính toán PnL, Win Rate, Max Drawdown, Sharpe Ratio.
2. **Tích hợp vào AI Agent:**
   - Cung cấp tool `run_historical_backtest(rules, timeframe, symbol)` cho AI.
   - Ví dụ Prompt: *"Tín hiệu cá mập gom hàng hiện tại trên mã SSI có tỷ lệ thắng bao nhiêu trong 1 năm qua?"* -> AI tự động gọi hàm mô phỏng.
3. **Hiển thị Frontend (React):**
   - Trả về các UI Component dạng tương tác (`BacktestResultCard`) để render biểu đồ Equity Curve thay vì chỉ render Text.

### Phase 3: Bổ sung Context thay thế (Alternative Data & Social Sentiment)
*Mục tiêu: Giúp AI hiểu được bối cảnh tâm lý đám đông tại Việt Nam để đối chiếu với hành vi của Cá mập.*

1. **Social Sentiment Ingestion:**
   - Crawl dữ liệu từ các forum chứng khoán VN (F319, FireAnt) và mặt báo (CafeF).
   - Chạy mô hình NLP để chấm điểm Sentiment Score (-1 đến 1) lưu vào Database.
2. **Sentiment Agent:**
   - Thêm Agent thứ 4. Nhiệm vụ là cảnh báo phân kỳ: Đám đông quá hưng phấn (Sentiment cao) nhưng dòng tiền Cá mập lại đang rút ra (Whale Flow âm).

### Phase 4: Đóng gói VNINVEST MCP Server
*Mục tiêu: Biến VNINVEST từ một "Ứng dụng Web đóng" thành một "Hạ tầng Dữ liệu mở" (Open Infrastructure).*

1. **Phát triển `vninvest-mcp-server`:**
   - Xây dựng MCP Server chuẩn để expose các tài nguyên (Resources) như `whale_alerts/:symbol` và các công cụ (Tools) như `get_whale_strength(symbol)`, `run_strategy_backtest()`.
2. **Trải nghiệm User VIP / Data Ops:**
   - Tích hợp trực tiếp VNINVEST MCP vào Claude Desktop / Cursor.
   - User có thể dùng AI trên máy tính để ra lệnh: *"Dùng vninvest tool, hãy lấy danh sách các mã có Whale Flow lớn nhất hôm nay và phân tích kỹ thuật giúp tôi"*.

---

## 4. Rủi ro & Khuyến nghị Kiến trúc (Architecture Constraints)

1. **Hiệu năng Backtest:**
   - Chạy backtest realtime trên hàng triệu dòng Intraday Ticks sẽ gây nghẽn Django backend.
   - *Giải pháp:* Đẩy Backtest logic xuống tầng Database (VD: ClickHouse/TimescaleDB) hoặc dùng in-memory OLAP (DuckDB) cho các tập data đã được pre-materialized (bucket facts).
2. **Chi phí API / Độ trễ của LLM (Latency):**
   - Gọi 3-4 Agents cho 1 câu hỏi sẽ tốn nhiều tokens và thời gian phản hồi (chờ 10-20s).
   - *Giải pháp:* Áp dụng Streaming UI (Server-sent events kết hợp React Suspense) để user nhìn thấy quá trình tư duy (thought process) của AI trong lúc chờ.
3. **SSOT (Single Source of Truth) cho Logic Giao dịch:**
   - Mọi tools cấp cho AI phải tái sử dụng nghiêm ngặt các policy hiện có tại `global_signal_universe_policy` và `runtime_policy_helpers.py` thuộc hệ thống `Money Flow Control Center`. Tuyệt đối không để AI tự tạo ra script tính toán Whale Flow sai lệch với các biểu đồ hiển thị trên UI.
4. **Kiến trúc BYOM (Bring Your Own Model) & BYOK (Bring Your Own Key):**
   - Do hệ thống cần chạy Multi-Agent Debate với 3-4 models khác nhau (để tối ưu ưu/nhược điểm từng LLM), việc VNINVEST chịu toàn bộ chi phí API tập trung là rất lớn và cứng nhắc.
   - *Giải pháp:* Thiết kế một Module "AI Configuration" trên UI cho phép người dùng (Power Users) tự nhập API Keys của riêng họ (OpenAI, Anthropic, Google, OpenRouter). Hệ thống Orchestrator sẽ đọc cấu hình mapping (VD: Agent 1 dùng key Claude, Agent 2 dùng key OpenAI) từ User Profile để khởi tạo các cuộc tranh luận.
