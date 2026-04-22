# RUNBOOK: Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Mục đích**: Chuẩn hóa các tình huống vận hành mà control plane phải hỗ trợ ngay từ thiết kế.

---

## 1. Tình huống: Service stalled

### Dấu hiệu
1. `last_heartbeat_at` không cập nhật vượt ngưỡng `stalled_after_sec`.
2. `rows_processed` không tăng nhưng state vẫn `running`.

### Hành động mong muốn của hệ thống
1. Đánh dấu `stalled` trong run ledger.
2. Phát alert `service_stalled`.
3. Tùy policy:
- auto-retry nếu idempotent,
- hoặc freeze service chờ điều tra.

---

## 2. Tình huống: Version drift

### Dấu hiệu
1. Cùng `service_code` có active runs với `release_sha` khác nhau.
2. Worker cũ vẫn đang tiêu thụ queue sau deploy.

### Hành động mong muốn
1. Gắn cờ `version_drift_detected`.
2. Hiển thị worker/version matrix trong dashboard.
3. Cho phép block run mới với service critical.

---

## 3. Tình huống: Overlap cùng scope

### Dấu hiệu
1. Có run mới với `scope_hash` trùng lease đang active.

### Hành động mong muốn
1. Áp `overlap_policy` đã cấu hình.
2. Trả `409 overlap_running` nếu policy là `reject_new`.
3. Ghi audit event cho mọi trường hợp bị từ chối do overlap.

---

## 4. Tình huống: Stop không được tôn trọng

### Dấu hiệu
1. `stop_requested=true` nhưng worker vẫn tiếp tục sau ngưỡng escalation.

### Hành động mong muốn
1. Chuyển `stop_requested -> stopping`.
2. Nếu quá ngưỡng, escalate bằng revoke/kill theo policy.
3. Ghi event escalation và phát alert info/warning.

---

## 5. Tình huống: Worker offline

### Dấu hiệu
1. API enqueue phát hiện worker unavailable.
2. Queue latency tăng bất thường, không có worker heartbeat.

### Hành động mong muốn
1. Từ chối enqueue với lỗi rõ ràng.
2. Hiển thị tình trạng worker trên UI.
3. Không báo `queued` nếu thực tế chưa thể dispatch.

---

## 6. Tình huống: Force overwrite request

### Điều kiện bắt buộc
1. `write_mode=force_overwrite`.
2. Có reason.
3. Có ticket/reference ID.
4. Có approval theo policy service.

### Hành động mong muốn
1. Ghi audit chi tiết.
2. Chụp mutation summary và sample diff.
3. Gắn tag high-risk cho run.

---

## 7. Tình huống: Schedule drift

### Dấu hiệu
1. Registry/policy nói service active nhưng Beat không có schedule tương ứng.
2. Hoặc Beat còn schedule cũ khi service đã pause.

### Hành động mong muốn
1. Tạo job reconcile schedule.
2. Báo sai lệch trên dashboard.
3. Cung cấp action resync schedule có audit log.