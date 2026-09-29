# WALKTHROUGH: SSOT Whale Alert - Bubble Sync

**Ngày**: 2026-04-22  
**Mục tiêu**: Handoff cho đội code triển khai ngay, không cần hỏi lại.

---

## 1. Tài liệu bắt buộc cần đọc theo thứ tự

1. `docs/IMPLEMENTATION_PLAN_SSOT_WHALE_ALERT_BUBBLE_SYNC_20260422.md`
2. `docs/TECH_SPEC_SSOT_WHALE_ALERT_BUBBLE_SYNC_20260422.md`
3. `docs/TASKBOARD_SSOT_WHALE_ALERT_BUBBLE_SYNC_20260422.md`

---

## 2. Coding Sequence (exact order)

## Step 1 - Backend canonical service

File chính:
- `backend/portfolio/market_data_service.py`

Việc phải làm:
- Tạo `get_whale_events_by_symbol()`.
- Chuẩn hóa side, price unit, matched value.
- Tạo summary + quality flags + degraded reason.

Output bắt buộc:
- Có payload canonical ổn định cho cả alert và bubble.

## Step 2 - Refactor whale feed endpoint

File:
- `backend/portfolio/views_realtime_advanced.py`

Việc phải làm:
- Bỏ transform riêng.
- Gọi canonical service.

Output bắt buộc:
- Endpoint vẫn tương thích route cũ, trả thêm metadata mới.

## Step 3 - Refactor whale orders endpoint

File:
- `backend/portfolio/views_whale_orders.py`

Việc phải làm:
- Bỏ query path riêng theo intraday/ref-price cũ.
- Dùng cùng canonical events.
- Tránh empty cứng khi thiếu ref price.

Output bắt buộc:
- Bubble endpoint và alert endpoint parity theo event count.

## Step 4 - Frontend bubble behavior

File:
- `frontend/src/components/WhaleBubbleChart.jsx`

Việc phải làm:
- Parse contract mới.
- Render fallback banner khi degraded.
- Chỉ empty state khi event_count = 0.

Output bắt buộc:
- Không còn trạng thái "alert có nhưng bubble rỗng".

## Step 5 - Tests and metrics

Files:
- `backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py`
- `backend/portfolio/tests/test_whale_orders_ssot_parity.py` (new)

Việc phải làm:
- Viết đầy đủ parity cases trong taskboard.
- Cắm metrics mismatch/degraded.

Output bắt buộc:
- Test matrix pass, metrics có dữ liệu.

---

## 3. Verification Commands

Backend tests:

```powershell
cd backend
python manage.py test portfolio.tests.test_api_routes_stock_workspace_realtime_bulk -v 2
python manage.py test portfolio.tests.test_whale_orders_ssot_parity -v 2
```

Frontend check:

```powershell
cd frontend
npm run build
```

Full stack smoke:

```powershell
docker compose -f docker-compose.dev.yml up -d --build backend celery_worker celery_beat frontend
```

---

## 4. UAT Checklist

- Chọn symbol có whale event trong stream.
- Xác minh alert hiển thị.
- Vào Tab Cá mập cùng symbol + timeframe.
- Xác minh bubble có điểm tương ứng.
- Giả lập thiếu ref_price.
- Xác minh fallback banner xuất hiện và chart không rỗng sai semantics.

---

## 5. Rollback Procedure

1. Tắt feature flag `WHALE_BUBBLE_USE_SSOT_EVENTS`.
2. Redeploy backend.
3. Kiểm tra endpoint trở về logic cũ.
4. Ghi incident note vào audit ledger.

---

## 6. Definition of Success

- Không còn mismatch alert-bubble.
- Không còn ticket phản ánh "hệ thống sai lệch" cho nghiệp vụ này.
- Có telemetry để phát hiện sớm regression.

---

## 7. Handoff Note cho Team

Đây là nhiệm vụ trust-critical.  
Ưu tiên đúng thứ tự backend canonical trước, frontend sau; không triển khai UI trước khi contract backend đã chốt.  
Mọi thay đổi phải giữ backward compatibility route trong phase hiện tại.
