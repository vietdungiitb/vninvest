# BL-24 gates — product telemetry proposal (doc-only, chờ quyết định product) (2026-09-24)

## Đề xuất event catalog tối thiểu (mở khóa Product/Business scoring)
`auth.login/logout` · `portfolio.view/create` · `watchlist.{add,remove}` · `screener.run` (params hash, result_count) · `signal.{view,ack,mute}` · `ai.advisory.generate` (model, tokens) · `billing.{view_plans,upgrade_start,upgrade_success}` · `soc.*` (operator only).
Mỗi event: `user_id` (hash), `tenant_id`, `ts`, `props` — KHÔNG log PII (email, password, API keys), tuân thủ data-residency VN.

## Quyết định cần product
Backend-pending vs FE-beacon, retention window, owner dashboard (PostHog tự host hay warehouse riêng). Không implement khi chưa có quyết định (tránh thu thập dữ liệu vô chủ).

## DoD tick
- [x] catalog đề xuất · [ ] product decision · [ ] implement + dashboard.
