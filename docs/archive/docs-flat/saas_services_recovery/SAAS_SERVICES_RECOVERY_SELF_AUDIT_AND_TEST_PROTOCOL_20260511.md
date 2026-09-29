# SELF AUDIT AND TEST PROTOCOL — SaaS Services Recovery

**Ngày**: 2026-05-11

---

## 1. Audit checklist theo pha

## R0
1. Freeze window đã thông báo chưa?
2. Snapshot runtime đã lưu chưa?
3. Compose target đã chốt chưa?

## R1
1. DB healthy liên tục >= 10 phút chưa?
2. Redis healthy liên tục >= 10 phút chưa?
3. Volume/persistence test đã pass chưa?

## R2
1. Core API health pass chưa?
2. Worker startup log sạch lỗi broker/db chưa?
3. Beat dispatch có log chưa?
4. Frontend route chính chạy ổn chưa?

## R3
1. Worker consume/complete flow đã pass 3 chu kỳ chưa?
2. Beat schedule đúng cadence chưa?
3. Queue depth/latency trong ngưỡng chưa?
4. Domain smoke tests pass chưa?

## R4
1. Core đã là đường chạy chính chưa?
2. Có duplicate processing không?
3. Cutover/parity checklist đã pass và ký chưa?

## R5
1. Soak 24h pass chưa?
2. Soak 72h pass chưa?
3. Alert critical có phát sinh không?

## R6
1. Evidence đủ cho mọi slice chưa?
2. Ledger và progress đã cập nhật chưa?
3. Sign-off đủ các vai trò chưa?

---

## 2. Test protocol tối thiểu

1. Runtime health tests
   1. `/core/v1/health`
   2. `/api/health/`
2. Queue tests
   1. Dispatch từ beat
   2. Consume tại worker
   3. Completion metrics
3. Domain smoke tests
   1. Realtime ticker
   2. Whale/unified alerts
   3. Workspace portfolio/watchlist

---

## 3. Failure triage protocol

1. Incident P0/P1
   1. đóng băng rollout
   2. kích hoạt rollback path
2. Incident queue
   1. kiểm tra broker connectivity
   2. kiểm tra registration/scheduler drift
3. Incident API health
   1. kiểm tra dependency DB/Redis
   2. kiểm tra migration/config mismatch

---

## 4. Sign-off rule

Chỉ được đánh dấu hoàn tất chương trình khi:
1. Tất cả checklist trên đã pass.
2. Không còn blocker mở.
3. Đã có final evidence bundle.
