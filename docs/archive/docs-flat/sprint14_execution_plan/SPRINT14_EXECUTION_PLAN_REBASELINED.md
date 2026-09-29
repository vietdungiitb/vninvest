# Sprint 14 Execution Plan (Rebaselined from Current Code State)

**Ngày lập kế hoạch**: 2026-04-03  
**Phạm vi**: Lập kế hoạch thực thi chức năng tiếp theo sau khi chuẩn hóa docs  
**Nguyên tắc**: Chưa sửa code, chỉ planning để triển khai có kiểm soát

---

## 1) Mục tiêu Sprint 14 (rebaseline)

### Mục tiêu chính (P0 trước, P1 sau)
1. **Realtime reliability hardening** (FE runtime stability)
2. **Whale aggregate feed hardening** (BE contract stability)
3. **Ops observability baseline** (BE/DevOps visibility)
4. **Analytics depth expansion** (deferred metrics có kiểm soát)
5. **Admin operations hardening** (UX/ops readiness)
6. **Stock workspace advanced foundation** (flow consistency)

---

## 2) Workstreams & Task Breakdown

## WS-1: Realtime Reliability Hardening (P0)
**Owner**: FE + QA  
**Files dự kiến tác động**:
- `frontend/src/hooks/useRealtimeFeed.js`
- `frontend/src/components/RealtimeDebugPanel.jsx`
- `frontend/src/components/DashboardRealtimePanel.jsx`
- `frontend/src/pages/Watchlist.jsx`
- `frontend/src/pages/StockDetail.jsx`

### Tasks
- S14-R1: Chuẩn hóa state machine realtime (`idle/connecting/live/polling/stale/disconnected`)
- S14-R2: Chuẩn hóa reconnect policy (backoff + jitter + max attempts)
- S14-R3: Đồng bộ cleanup subscribe/unsubscribe lifecycle cho mount/unmount
- S14-R4: Bổ sung stale-data policy rõ ràng cho từng panel
- S14-R5: Regression FE realtime flows (Dashboard/Watchlist/StockDetail)

### DoD
- Không leak socket khi đổi page liên tục
- Reconnect không spam
- Fallback polling hoạt động khi WS unavailable
- Chỉ số debug realtime phản ánh đúng lifecycle

### Risk
- Đụng logic hook dùng chung có thể gây regression đa màn hình

---

## WS-2: Whale Aggregate Feed Hardening (P0)
**Owner**: BE + QA  
**Files dự kiến tác động**:
- `backend/portfolio/views.py`
- `backend/portfolio/urls_realtime.py`
- `backend/portfolio/tests/test_api_routes.py`
- (nếu cần) `backend/portfolio/tests/test_realtime_*`

### Tasks
- S14-W1: Chốt contract query params (`scope/symbols/watchlist/sort/limit/cursor`)
- S14-W2: Chốt sorting stability + cursor monotonicity
- S14-W3: Chuẩn hóa response metadata (`has_more/next_cursor/filters/...`)
- S14-W4: Test edge-cases:
  - cursor invalid
  - limit out-of-range
  - sort key invalid
  - symbols filter empty/duplicate
- S14-W5: Đồng bộ docs API aggregate feed

### DoD
- Contract aggregate feed rõ và deterministic
- Cursor pagination ổn định qua nhiều trang
- Test happy path + error path + edge cases đầy đủ

### Risk
- Breaking change cho frontend nếu đổi contract không version hóa

---

## WS-3: Ops Observability Baseline (P0)
**Owner**: BE + DevOps  
**Files dự kiến tác động**:
- `backend/config/health.py`
- `backend/portfolio/tasks.py`
- `backend/config/settings.py` (nếu cần feature flag/logging knobs)
- docs runbook liên quan

### Tasks
- S14-O1: Chuẩn hóa health payload cho realtime/channels/redis
- S14-O2: Bổ sung log points có cấu trúc cho collect->compute->publish
- S14-O3: Xác định bộ metric tối thiểu để theo dõi sự cố
- S14-O4: Viết runbook phản ứng sự cố mức cơ bản

### DoD
- Có thể truy vết nhanh sự cố realtime qua health + log
- Có guideline vận hành tối thiểu cho dev/staging

### Risk
- Logging quá nhiều gây nhiễu/chi phí

---

## WS-4: Analytics Depth Expansion (P1)
**Owner**: BE + FE + QA  
**Files dự kiến tác động**:
- `backend/portfolio/analytics.py`
- `backend/portfolio/views.py`
- `backend/portfolio/tests/test_analytics_advanced.py`
- `frontend/src/components/PortfolioAnalyticsPanel.jsx` (nếu hiển thị metric mới)

### Tasks
- S14-A1: Chốt scope metric bổ sung (ưu tiên HHI; VaR lite nếu đủ dữ liệu)
- S14-A2: Implement + serialize metric trong analytics endpoint
- S14-A3: UI hiển thị + giải thích metric
- S14-A4: Test fixture và boundary behavior

### DoD
- Metric mới có định nghĩa business rõ
- API + UI + test nhất quán
- Không làm sai lệch metric cũ

---

## WS-5: Admin Operations Hardening (P1)
**Owner**: FE + BE + QA  
**Files dự kiến tác động**:
- `frontend/src/pages/AdminOps.jsx`
- `backend/portfolio/views.py`
- `backend/portfolio/tests/test_admin_ops.py`

### Tasks
- S14-M1: Chuẩn hóa UX lỗi 401/403/429/5xx
- S14-M2: Bổ sung diagnostic block cho trạng thái sync/health
- S14-M3: Tối ưu retry flow và thông điệp vận hành
- S14-M4: Thêm test permission + error mapping

### DoD
- Trang admin-ops có hành vi rõ cho từng nhóm lỗi
- Không cần đọc log backend để hiểu lỗi phổ biến

---

## WS-6: Stock Workspace Advanced Foundation (P1)
**Owner**: FE + QA  
**Files dự kiến tác động**:
- `frontend/src/pages/StockDetail.jsx`
- components chart/panel liên quan

### Tasks
- S14-S1: Chuẩn hóa bố cục panel theo user flow
- S14-S2: Đồng bộ luồng insight (alerts/realtime/technical snapshot)
- S14-S3: Kiểm soát hiệu năng render cho chart + panels

### DoD
- Luồng thao tác nhất quán từ dashboard/watchlist sang stock detail
- Không giật lag rõ rệt khi nhận realtime updates

---

## 3) Timeline đề xuất (2 tuần)

### Tuần 1
- Day 1-2: WS-1 (Realtime reliability hardening)
- Day 3-4: WS-2 (Aggregate feed hardening)
- Day 5: WS-3 (Observability baseline v1)

### Tuần 2
- Day 6-7: WS-4 (Analytics depth expansion)
- Day 8: WS-5 (Admin ops hardening)
- Day 9: WS-6 (Stock workspace foundation)
- Day 10: Regression + sign-off + docs sync

---

## 4) Acceptance Checklist (Sprint 14)

- [ ] Realtime FE không leak socket, reconnect ổn định, fallback hoạt động
- [ ] Aggregate feed có contract rõ, cursor/sort deterministic
- [ ] Health + observability đủ để triage sự cố realtime
- [ ] Ít nhất 1 metric analytics deferred được hoàn tất (HHI ưu tiên)
- [ ] AdminOps error UX rõ cho 401/403/429/5xx
- [ ] StockDetail flow nhất quán với realtime + alerts
- [ ] Backend tests liên quan pass, frontend build pass
- [ ] Docs đồng bộ sau mỗi nhóm task hoàn tất

---

## 5) Test Strategy

### Critical-path (mặc định)
- FE: Dashboard/Watchlist/StockDetail/AdminOps luồng chính
- BE: aggregate feed + analytics + admin-ops + health endpoints

### Thorough (khi vào phase QA cuối sprint)
- FE: kiểm tra toàn bộ route chính + thao tác đầy đủ
- BE: test happy/error/edge cho toàn bộ endpoint impacted + contract checks

---

## 6) Deliverables cuối Sprint 14

1. Code hardening + tests
2. Checklist acceptance đã tick đủ
3. Execution log cập nhật
4. Roadmap status cập nhật
5. Backlog/board cập nhật trạng thái Done/In Progress rõ ràng
