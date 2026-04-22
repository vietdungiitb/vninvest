# CODING KICKOFF: Phase 0-1 Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Mục tiêu**: Tài liệu kickoff thực chiến cho team code trong 2 phase đầu, tập trung vào thứ tự làm việc, điểm khóa kỹ thuật và các bẫy cần tránh.

---

## 1. Mục tiêu Phase 0-1

### Phase 0
1. Dựng schema additive.
2. Dựng service registry và Redis key helpers.
3. Chưa onboard pilot service vào runtime thật.

### Phase 1
1. Dựng admin API lõi.
2. Dựng run ledger + event flow.
3. Có thể tạo run/stop/retry trên dữ liệu kiểm thử.
4. Chưa cần UI hoàn chỉnh.

---

## 2. Đầu ra bắt buộc của Phase 0

1. Models đã tồn tại trong codebase.
2. Migration chạy được sạch trên local/staging.
3. Có seed/registry cho pilot services.
4. Có helper chuẩn cho:
- lease key
- heartbeat key
- stop key
- idempotency key

---

## 3. Đầu ra bắt buộc của Phase 1

1. Có API list services.
2. Có API active runs.
3. Có API run service.
4. Có API stop/retry run.
5. Có audit log/event log cho thao tác này.

---

## 4. Trình tự coding khuyến nghị

1. Model trước.
2. Migration sau model.
3. Redis helper + orchestration service sau migration.
4. Serializers/views sau service layer.
5. Test contract sau API.
6. Pilot integration chỉ làm sau khi Phase 1 API ổn định.

Không được đảo ngược sang hướng “làm pilot trước, schema tính sau”.

---

## 5. Các quyết định kỹ thuật cần khóa ngay trong kickoff

1. `run_id` dùng UUID hay string prefixed.
2. `scope_hash` dùng hash algorithm nào.
3. Redis TTL mặc định cho lease/heartbeat/idempotency.
4. Mapping permission classes mới vào hệ plan hiện tại.
5. Naming convention metrics và API serializers.

---

## 6. Bẫy triển khai cần tránh

1. Gắn logic orchestration trực tiếp vào view thay vì service layer.
2. Tạo nhiều bảng log chồng chéo ngoài run ledger.
3. Tạo state machine không nhất quán giữa API và worker.
4. Để `idempotency_key` không có scope rõ ràng.
5. Quên lưu `release_sha` và `worker_hostname` ngay từ pilot đầu.

---

## 7. Checklist kỹ thuật trước khi merge PR Phase 0

- [ ] Migration additive, không phá dữ liệu cũ.
- [ ] Models có index hợp lý.
- [ ] Có test model/service registry.
- [ ] Có feature flag đóng control plane mới.

## 8. Checklist kỹ thuật trước khi merge PR Phase 1

- [ ] API contract tests pass.
- [ ] Audit event được ghi đầy đủ.
- [ ] Stop/retry/run không bypass permission check.
- [ ] Active runs endpoint có trả đúng metadata version fields.

---

## 9. Gợi ý chia commit/PR cho Phase 0-1

1. PR-A: schema + migrations.
2. PR-B: service registry + Redis helper.
3. PR-C: admin API + serializers.
4. PR-D: tests + docs refresh.

---

## 10. Exit criteria cho kickoff pack

Kickoff được xem là xong khi:
1. Backend lead xác nhận thứ tự triển khai không còn mơ hồ.
2. Reviewer chốt được các quyết định kỹ thuật khóa ở mục 5.
3. Team code có thể mở taskboard và bắt đầu Phase 0 ngay.