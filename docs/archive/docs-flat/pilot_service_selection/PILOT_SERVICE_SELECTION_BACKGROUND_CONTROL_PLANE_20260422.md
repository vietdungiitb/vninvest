# PILOT SERVICE SELECTION: Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Mục tiêu**: Chốt danh sách dịch vụ pilot phase đầu để team code bắt đầu với phạm vi nhỏ nhưng đủ đại diện.

---

## 1. Tiêu chí chọn pilot

Pilot service phase đầu phải thỏa càng nhiều tiêu chí càng tốt:
1. Có giá trị vận hành rõ nếu được kiểm soát tốt hơn.
2. Có rủi ro thực tế đã từng xuất hiện hoặc dễ xảy ra.
3. Đại diện cho kiểu hành vi khác nhau: mutate DB, sync định kỳ, prefetch/realtime, advisory pipeline.
4. Không quá nhiều phụ thuộc chéo để tránh phase đầu bị sa lầy.
5. Có thể đo hiệu quả control plane rõ ràng qua KPI.

---

## 2. Danh sách đề xuất ưu tiên

### Pilot A — `intraday_side_backfill`

**Lý do chọn**:
1. Đây là case điển hình của mutation job có rủi ro ghi đè dữ liệu.
2. Đã có status task nền, nên migrate lên run ledger sẽ nhanh hơn các service khác.
3. Có nhu cầu thực tế về overlap control, stop flow, write mode, preview/dry-run.

**Những năng lực control plane cần verify**:
1. `scope_hash`
2. `write_mode`
3. `stop_requested`
4. `rows_mutated`
5. `mutation_summary`

### Pilot B — `stock_profile_sync`

**Lý do chọn**:
1. Đại diện cho sync job định kỳ và có volume vừa phải.
2. Phù hợp để test schedule policy, success/failure accounting, retry matrix.
3. Ít rủi ro hơn backfill, thích hợp cho canary sớm.

**Những năng lực control plane cần verify**:
1. scheduled run
2. retry/backoff
3. duration baseline
4. run history retention

### Pilot C — 1 prefetch job đại diện

**Khuyến nghị**:
Chọn một job trong `tasks_prefetch.py` hoặc luồng tương đương có tính chất cache warm / periodic refresh.

**Lý do chọn**:
1. Đại diện cho nhóm runtime support service.
2. Có giá trị để test queue latency, freshness SLA, version drift trên worker đang chạy thường xuyên.
3. Ít đụng mutation DB trực tiếp hơn backfill, tạo đối trọng kiến trúc.

**Những năng lực control plane cần verify**:
1. heartbeat
2. freshness SLA
3. stalled detection
4. queue latency

---

## 3. Dịch vụ chưa nên onboard ngay phase đầu

### Whale advisory multi-phase pipeline
**Lý do**:
1. Pipeline nhiều phase, nhiều side-effect, phụ thuộc AI/provider/external services.
2. Nếu chọn quá sớm sẽ làm nhiễu việc validate control plane lõi.

### News / Telegram / broadcast phụ trợ
**Lý do**:
1. Không phải nơi có pain lớn nhất về data mutation và overlap.
2. Nên onboard sau khi control plane ổn định trên 3 pilot đầu.

### Toàn bộ realtime stack cùng lúc
**Lý do**:
1. Phụ thuộc luồng streaming, ws broadcast, cache và UI cùng lúc.
2. Nên chỉ chọn 1 prefetch/realtime support job, không chọn cả cụm.

---

## 4. Mapping pilot -> năng lực cần chứng minh

| Service | Mutation | Schedule | Heartbeat | Stop | Drift | Overlap | Write Mode |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| intraday_side_backfill | Yes | Optional | Yes | Yes | Yes | Yes | Yes |
| stock_profile_sync | Yes | Yes | Yes | Optional | Yes | Yes | Yes |
| prefetch representative | No/Low | Yes | Yes | Optional | Yes | Yes | Partial |

---

## 5. Khuyến nghị chốt phase đầu

### Scope phase đầu nên là
1. `intraday_side_backfill`
2. `stock_profile_sync`
3. 1 prefetch representative job

### Không nên thêm quá 3 pilot trong phase đầu vì
1. Mục tiêu phase đầu là chứng minh control plane lõi, không phải onboard toàn bộ hệ thống.
2. Mỗi pilot thêm vào kéo theo nhiều edge cases, làm trễ việc khóa contract chung.

---

## 6. Điều kiện để chuyển sang phase mở rộng

Chỉ onboard thêm nhóm whale/news/realtime phức tạp khi:
1. Pilot lifecycle chạy ổn trên staging 24-48h.
2. Stalled detection và drift detection đã cho ra tín hiệu đúng.
3. Write mode governance đã được áp dụng ít nhất cho backfill và sync.
4. UI active runs và run detail đã usable cho ops.