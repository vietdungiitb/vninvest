# Checklist Self-Audit PR — Global Alert Center SaaS OpenAPI Cutover

Ngày: 2026-05-16
Mục tiêu: checklist tự-audit nhanh trước khi mở PR để tránh code chệch hướng.

---

## 1. PR header bắt buộc

- [ ] PR title có Slice ID (ví dụ: B03, C01)
- [ ] PR mô tả rõ: Objective, Scope In, Scope Out
- [ ] PR link tới requirement IDs trong traceability matrix

---

## 2. Technical fitness checks

### Foundation / planner
- [ ] Không có monitored universe local tự phát
- [ ] Planner không full-scan by default

### Alert semantics
- [ ] Main feed chỉ gồm family hợp lệ (whale/dark_flow/price_shock/stale_quote/system)
- [ ] AI lane tách riêng, không trộn mặc định vào main
- [ ] alert_family và summary có nghĩa nghiệp vụ rõ ràng

### Delivery
- [ ] User scope đúng holding/watchlist/tracked/preferences
- [ ] Mute/snooze chỉ tác động delivery projection
- [ ] Cross-tenant bị chặn

### OpenAPI
- [ ] Endpoint path đúng family native
- [ ] Parameter docs phản ánh runtime behavior thực tế
- [ ] Error envelope schema đúng chuẩn

---

## 3. Anti-regression checks

- [ ] packages/web adapter tests pass
- [ ] frontend bridge tests pass
- [ ] signal_intelligence tests pass
- [ ] Không còn call route legacy trong phạm vi đã cutover

Gợi ý lệnh grep:

```powershell
rg -n "realtime/unified-alerts|/core/v1/unified-alert" frontend/src packages/web/src packages/mobile/src
rg -n "signals/alert-center|signals/ai-alerts" frontend/src packages/web/src packages/mobile/src packages/core/backend/src
```

---

## 4. Evidence checklist

- [ ] Đã điền execution evidence template cho slice
- [ ] Có payload snapshots cho endpoint chính
- [ ] Có residual risk note trung thực
- [ ] Có quyết định rollback path nếu slice chạm cutover

---

## 5. Merge blocker (chỉ cần 1 điều là block)

- [ ] Browser còn synthesize alert nghiệp vụ
- [ ] Endpoint thiếu pagination hoặc OpenAPI metadata quan trọng
- [ ] Có compat route mới chứa business logic
- [ ] Có mô tả hoặc code path nhằm bỏ shadow/parity/soak gate
- [ ] Chưa có test/evidence cho claim DONE

Nếu có blocker: đổi trạng thái task về IN PROGRESS/REOPENED và tạo remediation sub-slice.
