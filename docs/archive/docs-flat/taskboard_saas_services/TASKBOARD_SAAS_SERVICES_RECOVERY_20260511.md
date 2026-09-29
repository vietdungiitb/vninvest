# TASKBOARD — SaaS Services Recovery

**Ngày**: 2026-05-11  
**Legend**: `[ ]` Not started | `[~]` In progress | `[x]` Done | `[!]` Blocked

---

## R0 — Stabilization Gate

- [ ] `SSR-R0.1` Freeze thay đổi runtime ngoài scope recovery  
Owner: Tech Lead  
DoD: freeze window được công bố cho team

- [x] `SSR-R0.2` Chụp snapshot hiện trạng containers/health/env  
Owner: DevOps Lead  
DoD: có artifact snapshot trong evidence folder

- [ ] `SSR-R0.3` Chốt compose target cho dev/prod  
Owner: DevOps Lead  
DoD: danh sách compose files mục tiêu được duyệt

---

## R1 — Data Plane Recovery

- [x] `SSR-R1.1` Khôi phục `db` về healthy  
Owner: DevOps  
DoD: healthcheck pass ổn định >= 10 phút

- [x] `SSR-R1.2` Khôi phục `redis` về healthy  
Owner: DevOps  
DoD: ping pass ổn định >= 10 phút

- [ ] `SSR-R1.3` Xác nhận volume + persistence  
Owner: DevOps  
DoD: restart thử 1 lần không mất trạng thái cần thiết

---

## R2 — Core Runtime Recovery

- [x] `SSR-R2.1` Start `core-api` và đưa về healthy  
Owner: Backend Lead  
DoD: `/core/v1/health` trả 200 ổn định

- [x] `SSR-R2.2` Start `core-worker` và xác nhận broker connectivity  
Owner: Backend Lead  
DoD: không lỗi broker/db trong log boot

- [x] `SSR-R2.3` Start `core-beat` và xác nhận schedule tick  
Owner: Backend Lead  
DoD: beat dispatch xuất hiện trong log

- [x] `SSR-R2.4` Start frontend sau khi core healthy  
Owner: Frontend/DevOps  
DoD: endpoint runtime chính truy cập bình thường

- [x] `SSR-R2.5` Khôi phục schema blocker `RuntimeVnbrokerConfig`  
Owner: Backend Lead  
DoD: bảng `portfolio_runtimevnbrokerconfig` tồn tại; `RuntimeVnbrokerConfig.get_or_create_singleton()` chạy thành công

---

## R3 — Background Services Recovery

- [x] `SSR-R3.1` Verify worker consume-complete flow
Owner: Backend Lead  
DoD: 3 task cycles liên tiếp pass

- [x] `SSR-R3.2` Verify beat schedule dispatch flow
Owner: Backend Lead  
DoD: schedule trigger đúng cadence

- [x] `SSR-R3.3` Kiểm tra queue depth/latency
Owner: Backend + DevOps  
DoD: queue depth không tăng bất thường liên tục

- [x] `SSR-R3.4` Smoke test domain critical endpoints
Owner: QA Lead  
DoD: ticker, whale/unified alerts, workspace endpoints pass

---

## R4 — SaaS-Only Runtime Gate

- [x] `SSR-R4.1` Xác nhận runtime entry point chính qua core  
Owner: Tech Lead  
DoD: traffic path được chứng minh bằng test và config

- [x] `SSR-R4.2` Ngăn duplicate processing từ legacy background services  
Owner: Backend Lead  
DoD: không có job trùng cho workload chính

- [x] `SSR-R4.3` Chạy parity/cutover checklist  
Owner: QA + Tech Lead  
DoD: checklist pass, có sign-off

---

## R5 — Soak & Hardening

- [~] `SSR-R5.1` Chạy soak 24h  
Owner: DevOps + QA  
DoD: không incident P1  
**Status**: IN PROGRESS (T=0 baseline captured at 2026-05-11 09:41:27 UTC, monitoring started)

- [ ] `SSR-R5.2` Chạy soak 72h (khuyến nghị)  
Owner: DevOps + QA  
DoD: SLO đạt ngưỡng theo tech spec

- [ ] `SSR-R5.3` Tinh chỉnh giới hạn tài nguyên nếu cần  
Owner: DevOps  
DoD: restart count giảm về ngưỡng bình thường

---

## R6 — Sign-off & Handover

- [ ] `SSR-R6.1` Hoàn tất evidence cho từng slice  
Owner: Tất cả owners  
DoD: evidence docs đầy đủ và link được

- [ ] `SSR-R6.2` Cập nhật audit ledger + progress dashboard  
Owner: Executor mỗi slice  
DoD: cả 2 file đã phản ánh đầy đủ tình trạng

- [ ] `SSR-R6.3` Sign-off cuối chương trình  
Owner: Tech Lead + DevOps Lead + QA Lead  
DoD: quyết định GO chính thức được ghi tài liệu
