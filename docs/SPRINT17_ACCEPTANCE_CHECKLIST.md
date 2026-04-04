# Sprint 17 Acceptance Checklist — AI Advisory Multi-Tab

**Sprint**: 17  
**Ngay lap**: 2026-04-04  
**Trang thai**: COMPLETED (implementation + targeted validation done)

---

## A. Backend — Data Model

- [x] Co model `AIAdvisoryComponentRecord` voi cac field co ban: component_type, indicator_name, status, confidence_score, suggested_action, rationale_text, timeframe, include_in_summary, is_deleted, created_at.
- [x] Co model `AIAdvisoryExecutiveSummary` voi cac field: strategy_action, synthesis_text, target_price_zone, stop_loss_zone, risk_level, overall_confidence, used_component_ids, summary_version, created_at.
- [x] Migration apply OK, khong sua migration cu.
- [x] Index query cho user+symbol+created_at duoc tao.

## B. Backend — API & Service

- [x] `GET /stocks/{symbol}/ai-advisory-session/` tra summary + components.
- [x] `POST /stocks/{symbol}/ai-advisory-components/generate/` tao component records theo schema.
- [x] `POST /ai-advisory-components/{id}/toggle-include/` doi include_in_summary dung.
- [x] `DELETE /ai-advisory-components/{id}/` thuc hien soft delete (`is_deleted=true`).
- [x] `POST /stocks/{symbol}/ai-advisory-summary/regenerate/` tao summary_version moi.
- [x] Summary bo qua component `is_deleted=true` hoac `include_in_summary=false`.
- [x] Co cooldown/rate-limit cho regenerate endpoint.

## C. Frontend — Multi-Tab UI

- [x] AI Advisory panel tren StockDetail hien tab list theo component records.
- [x] Moi tab hien indicator_name, status, confidence, suggested_action.
- [x] Moi tab hien timestamp tao record.
- [x] Co nut include/exclude cho tung tab.
- [x] Co nut xoa component (goi API soft delete).
- [x] Block Executive Summary o ben duoi luon hien thi state ro (loading/empty/ready).
- [x] Nut Regenerate summary hoat dong, update summary ma khong can reload trang.
- [x] Hien thong tin "Summary su dung N components" va "Che do tong hop hien tai".

## D. QA

- [x] Backend tests cho component generate/toggle/delete/regenerate PASS.
- [x] Frontend build pass (`npm run build`).
- [x] Smoke test route `/stocks/:symbol` khong regression chart/order flow panel.
- [x] Session co du audit trail de truy vet (component timestamps + summary versions).

## E. Release Sign-off

- [x] Khong co P0/P1 blocker moi.
- [x] Execution log cap nhat sau khi code complete.
- [x] Taskboard Sprint 17 cap nhat day du.
