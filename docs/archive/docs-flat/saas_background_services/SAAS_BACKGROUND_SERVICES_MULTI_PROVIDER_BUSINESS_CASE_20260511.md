# BUSINESS CASE — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11  
**Mục tiêu**: Thuyết phục quyết định đầu tư triển khai kiến trúc mới

---

## 1. Vấn đề kinh doanh hiện tại

1. Dữ liệu realtime có thể lệch độ tươi khi queue bị nghẽn chéo giữa realtime và heavy jobs.
2. Drift cấu hình scheduler giữa code và DB periodic tasks gây rủi ro "đã fix code nhưng runtime chưa đúng".
3. Ngoài giờ chưa có pipeline enrich đủ mạnh để mở phiên với dữ liệu đầy đủ trên mọi tầng.
4. Chưa có cơ chế manual-trigger chuẩn cho người dùng/admin có quota và ưu tiên rõ ràng.

Tác động:
1. UX không ổn định ở các thời điểm tải cao.
2. Rủi ro mất niềm tin dữ liệu với người dùng trả phí.
3. Khó scale lên 10.000 users mà vẫn giữ chi phí vận hành hợp lý.

---

## 2. Vì sao nên đầu tư ngay

1. Nền kỹ thuật đã sẵn building blocks: vnbroker adapter, prefetch topology, runtime policy, admin-ops contracts.
2. Chi phí chuyển đổi thấp hơn nhiều so với một lần rewrite toàn bộ.
3. Tăng chất lượng dịch vụ trực tiếp tác động retention và conversion gói Pro/Team.
4. Giảm rủi ro vận hành qua queue isolation + observability + policy governance.

---

## 3. Giá trị kỳ vọng

### 3.1 Giá trị cho người dùng
1. Dữ liệu thị trường nhanh hơn, đầy đủ hơn trong giờ giao dịch.
2. Dữ liệu enrich sẵn ngoài giờ giúp trải nghiệm sáng phiên mượt hơn.
3. Manual refresh/on-demand jobs có SLA rõ và phản hồi minh bạch.

### 3.2 Giá trị cho vận hành
1. Giảm incidents do queue backlog chéo miền.
2. Giảm thời gian điều tra nhờ metrics và trace rõ per-provider/per-queue.
3. Cho phép scale theo chiều ngang theo domain tải.

### 3.3 Giá trị cho kinh doanh SaaS
1. Nâng reliability phù hợp thông điệp sản phẩm trả phí.
2. Tạo nền tảng cho pricing theo SLA/tier data freshness.
3. Mở đường cho B2B/API plans với cam kết chất lượng định lượng.

---

## 4. KPI thành công đề xuất

1. Ticker freshness p95 trong giờ: <= 2 giây (top universe).
2. Cache miss ratio ở hot path: <= 0.5%.
3. Queue lag p95 cho realtime_prefetch: <= 5 giây.
4. Job success rate ngoài giờ: >= 99%.
5. Availability endpoint realtime chính: >= 99.5%.

---

## 5. Chi phí và ROI định tính

Chi phí chính:
1. Engineering effort theo phase (6-10 tuần).
2. Tăng nhẹ hạ tầng queue/worker/cache theo domain.
3. Thiết lập observability và alerting chuẩn.

ROI kỳ vọng:
1. Giảm ticket liên quan dữ liệu realtime và dashboard stale.
2. Giảm churn nhóm người dùng nhạy với tốc độ dữ liệu.
3. Tăng conversion từ free/community lên pro/team do trust dữ liệu.

---

## 6. Quyết định đề xuất

1. GO theo roadmap nhiều phase, không big-bang.
2. Ưu tiên Phase 1-2 để chặn rủi ro realtime ngay.
3. Duy trì backward compatibility trong suốt thời gian rollout.
