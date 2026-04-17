# 🕵️ Báo Cáo Audit Technical: Realtime Engine (WebSockets & Redis Streams)
**Thời gian rà soát:** 2026-04-17

Sau khi rà soát tệp dữ liệu pub/sub (`tick_producer.py`, `stream_consumers.py`, `stream_reader.py`, `publisher.py` và phần WS `consumers.py`), dưới đây là phân tích kiến trúc, điểm mạnh và các rủi ro thắt cổ chai (bottlenecks) cần khắc phục.

---

## 1. 🏗️ Tổng quan kiến trúc hiện tại

Hệ thống Realtime của VNInvest được thiết kế theo dạng **Event-Driven Pub/Sub**, sử dụng Redis Streams làm Message Broker chính và Django Channels làm WebSocket Layer. 

**Luồng dữ liệu:**
1. **Producer (`tick_producer.py`)**: Đọc dữ liệu từ vnstock, ghi DataFrames trực tiếp vào `vninvest:ticks:{SYMBOL}` (Redis Streams) với `maxlen=50000`, đồng thời tạo một snapshot giá (`HSET`) để API lấy nhanh (tránh việc API liên tục gọi DB hoặc Stream XREVRANGE).
2. **Consumers (`stream_consumers.py`)**: 3 nhóm consumer độc lập hoạt động theo mô hình Stream Consumer Groups (Giúp phân chia sập độc lập, sập module nào không ảnh hưởng module khác):
   - `db-writer`: Kéo ticks về và chạy `IntradayTick.objects.bulk_create()` để lưu vào PostgreSQL.
   - `ws-broadcaster`: Tính toán payload mới (tạo Pandas DataFrame trong memory) và bắn sự kiện qua Django Channels `group_send` (ticker_{SYMBOL}).
   - `alert-engine`: Chạy thuật toán phát hiện Whale (có check threshold cấu hình override) và bắn qua Channel Layer `whale_{SYMBOL}`.
3. **Delivery (`consumers.py`)**: Khách hàng duy trì WebSocket connection. Khi nhận được message từ Channels Layer, `AsyncJsonWebsocketConsumer` truyền thẳng JSON xuống Frontend.
4. **Fallback (`stream_reader.py`)**: Core fallback 3-tier tuyệt vời của API - Khi request `/api/realtime/ticker_abc`, API đọc theo thứ tự: Stream -> Cache -> vnstock.

> **Đánh giá chung:** Đây là một kiến trúc rất tiêu chuẩn và scale tốt (enterprise pattern). Điểm mạnh nhất là việc sử dụng **Redis Stream Consumer Groups**, giúp cô lập (isolate) các tác vụ IO tốn kém như DB insert ra khỏi luồng broadcast cho WebSockets. 

---

## 2. ⚠️ Các điểm yếu và Nút thắt hiệu năng (Bottlenecks / N+1 Issues)

Dù tổng thể thiết kế tốt, có những phần logic trong code hiện tại có rủi ro nghiêm trọng khi số lượng User hoạt động đồng thời (CCU) lớn.

### 🔴 Lỗi Nghiêm Trọng (Critical): Tấn công N+1 Database trong Broadcaster
Tại `RealtimeConsumer.whale_advisory(self, event)` trong `consumers.py`:
```python
    async def whale_advisory(self, event):
        plan = await self._get_user_plan() # <--- BUG HIỆU NĂNG TẠI ĐÂY
        ...
```
Hàm `_get_user_plan` có chứa `@database_sync_to_async`, mỗi lần chạy hàm này sẽ gọi DB để check `DPIPlan` của user thông qua connection pool. 
**Tác hại**: Nếu có 2,000 users đang subscribe mã VIC, khi xảy ra 1 Whale Advisory cho VIC, Django Channels sẽ phát event này cho 2,000 WebSocket Consumers. Lập tức **2,000 tiến trình đồng loạt kết nối tới cơ sở dữ liệu** để check plan! 
Điều này sẽ gây bóp nghẹt PostgreSQL (thundering herd) và làm sập app (cạn connection pool, lock DB).

### 🟡 Rủi ro Cao (High): Pandas DataFrame khởi tạo liên tục trong Event Loop
Tại `WsBroadcastConsumer` và `AlertEngineConsumer` (`stream_consumers.py`):
- Khi consumer quét batch mới của Redis Stream, raw list dictionary được đẩy vào hàm `process_batch()`.
- Hàm lập tức tạo `df = pd.DataFrame(rows)`.
**Tác hại**: `pandas` là một thư viện biên dịch Python/C rất nặng nề trong việc khởi tạo instance. Việc liên tục new `DataFrame` trên CPU cho mỗi batch stream siêu nhanh có thể khiến backend Node bị OOM (Out of memory) hoặc CPU 100% trong phiên giao dịch cao điểm.

### 🟡 Rủi ro Trung Bình (Medium): Authentication DB Load khi Reconnecting
Tại `_authenticate_user` trong `consumers.py`:
```python
    @database_sync_to_async
    def _get_user(self, user_id: int):
        return User.objects.get(pk=user_id)
```
**Tác hại**: Nếu hệ thống cần deploy và restart, toàn bộ WebSockets của user sẽ disconnect và đồng loạt reconnect cùng 1s. Hệ thống sẽ nhận hàng ngàn lệnh mở connection, mỗi lệnh query DB 1 lần. Backend sẽ bị khựng lại một lúc. (Nên cache `user_id -> User/Plan` trong Redis Cache trong 5 phút).

---

## 3. 🛠️ Khuyến nghị Khắc phục (Action Plan đề xuất)

1. **Khắc phục N+1 WebSocket (Ưu tiên P0)**: Chuyển logic kiểm tra gói (DPI Plan) sang thực hiện một lần duy nhất tại hàm `connect()`, lưu dưới dạng `self.user_plan = plan`. Sau đó, trong `whale_advisory`, chỉ cần dùng biến `self.user_plan` có sẵn ở RAM để filter, cắt đứt hoàn toàn việc chạm vào DB lúc broadcast.
2. **Tối ưu Payload Generator (Ưu tiên P1)**: Thay vì build Pandas Dataframe để tính payload trong `build_ticker_payload`, nếu các field cần lấy chỉ là đơn giản (ts, price, vol, side), có thể thay qua xử lý bằng Native Python Lists / Dicts cho luồng Consumer Broadcast. Dataframe chỉ dùng cho Data Analytics.
3. **Caching User Auth (Ưu tiên P2)**: Trong `_get_user`, check `cache.get(f"auth_user_{user_id}")` hoặc nạp JWT claim nếu không cần đụng đến model, để xử lý mượt mà kịch bản "Bão Reconnection".
