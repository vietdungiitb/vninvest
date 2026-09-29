# Frontend Design — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## 1. Mục tiêu frontend

1. Cho operator thấy trạng thái chạy thật của backfill runs.
2. Không đưa business crawl/planner logic lên client.
3. Cung cấp trigger, preview, progress và anomaly visibility rõ ràng.

---

## 2. Scope UI

1. `SchedulerBoard`
- queued/running/success/failed badges
- progress %, done/remaining, ETA
- latest error / provider / batch info
- history drawer enriched fields

2. `DataOpsPanel`
- critical gap cards
- hot tier breach summary
- promotion backlog summary
- targeted repair / repair missing preview section

3. Governance UX
- reason bắt buộc cho action nguy hiểm
- explicit mode labels và warnings
- i18n đầy đủ dấu

---

## 3. Contract requirements

1. Frontend chỉ render fields backend trả về.
2. Không tự tổng hợp `is_inflight` từ `last_run_at`.
3. History list phải hỗ trợ pagination.
4. Preview/run responses phải hiển thị `mode`, `priority_reason`, `planned_symbols_count`.

---

## 4. Accessibility and usability

1. Status colors luôn kèm text labels.
2. Progress state phải có fallback text rõ ràng nếu run đang khởi tạo.
3. Cards anomaly phải ưu tiên information density, không chỉ màu mè.

---

## 5. Test requirements

1. UI tests cho status transitions.
2. adapter tests cho progress/history payload fields.
3. regression tests chống stale running state.
4. i18n coverage tests cho strings mới.
