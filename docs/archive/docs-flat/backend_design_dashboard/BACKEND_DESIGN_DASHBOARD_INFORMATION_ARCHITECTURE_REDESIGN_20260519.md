# BACKEND DESIGN — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Quan trọng**: Đây là workstream frontend-first. Backend mặc định **không cần thay đổi**.

---

## 1. Tóm tắt

Redesign dashboard lần này chỉ thay đổi information architecture và layout composition. Toàn bộ data sources cần cho dashboard đã tồn tại:

- portfolio summary
- holdings
- analytics
- technicals
- tracked symbols
- watchlist groups
- alert center feed
- realtime feed
- portfolio news digest

Không có lý do kỹ thuật bắt buộc nào để thêm endpoint mới cho v1.

---

## 2. Data sources inventory

| Domain | Endpoint / Source | Ghi chú |
|---|---|---|
| Portfolio summary | `/core/v1/portfolio/portfolios/{id}/summary/` hoặc legacy `/api/...` path hiện dùng ở live route | Existing |
| Holdings | `/core/v1/portfolio/portfolios/{id}/holdings/` | Existing |
| Analytics | `/core/v1/portfolio/portfolios/{id}/analytics/` | Existing |
| Technicals | `/core/v1/portfolio/portfolios/{id}/technicals/` + `/api/stock-management/technicals/bulk/` | Existing |
| Tracked symbols | `/core/v1/stock-management/tracked-symbols/` | Existing |
| Watchlist groups | `/core/v1/portfolio/watchlist/groups/` | Existing |
| Alert feed | `/core/v1/signals/alert-center/feed` | Existing |
| Realtime overlay | websocket / realtime hooks hiện có | Existing |
| AI news digest | `getPortfolioNewsDigest()` current path | Existing |

---

## 3. No-change policy for backend in v1

### Forbidden in this workstream

1. Không thêm endpoint `dashboard shell summary` mới.
2. Không thêm contract mới chỉ để phục vụ bố cục triad.
3. Không đổi serializer shape của alert feed hoặc portfolio analytics.
4. Không đổi polling cadence / beat / cache strategy cho realtime chỉ vì layout thay đổi.

### Allowed

- Verify inventory và document response shapes.
- QA sanity check current endpoints trước/ sau redesign để xác nhận layout changes không tạo data regressions.

---

## 4. Response shape assumptions frontend phải giữ nguyên

### 4.1 Summary

Frontend chỉ được dùng các field đang có như:

- `market_value`
- `unrealized_pl`
- `unrealized_pl_percent` hoặc equivalent
- `holdings_count`

### 4.2 Analytics compact strip

Nếu giữ micro-metrics ở header, frontend chỉ lấy từ existing analytics payload những field sau khi có sẵn:

- `alpha_annual_pct`
- `beta`
- `sharpe_ratio`
- `max_drawdown_pct` hoặc tương đương

Nếu field không có, header strip phải degrade gracefully; không được yêu cầu backend bổ sung trong workstream này.

### 4.3 Alert feed

`UnifiedAlertCenter` vẫn là consumer chính của alert feed. Redesign không thay đổi:

- pagination semantics
- audience filter semantics
- severity filter semantics
- `session_date` usage

---

## 5. Integration guidance for backend reviewers

Backend reviewer chỉ cần trả lời 3 câu hỏi:

1. Frontend redesign có tăng số API calls không?
2. Frontend redesign có đòi serializer/endpoint change không?
3. Frontend redesign có vô tình duplicate fetch hoặc gọi sai route (`/core/v1/` vs `/api/`) không?

Nếu cả 3 câu trả lời đều là “không”, backend side được coi là PASS.

---

## 6. Optional future enhancements — explicitly out of scope

Các đề xuất sau có thể hợp lý trong tương lai, nhưng không được implement ở redesign v1:

- Aggregated dashboard shell endpoint
- Dedicated AI lane summary endpoint
- Header metrics mini-endpoint
- Server-side deduplicated “top alerts ribbon” endpoint

Mọi đề xuất như trên phải mở workstream backend riêng với OpenAPI artifacts riêng.

---

## 7. SaaS native / OpenAPI hard rules if backend is touched anyway

Nếu trong lúc triển khai đội code phát hiện cần sửa backend, các ràng buộc sau là bắt buộc:

1. Chỉ sửa trong `packages/core/backend/`.
2. Chỉ expose contract mới qua `/core/v1/*`.
3. Phải cập nhật OpenAPI metadata đồng bộ với implementation.
4. Phải tuân thủ error envelope chuẩn (`detail/code/timestamp/request_id/field_errors`).
5. List endpoint nếu có phải có pagination; auth/private endpoint phải có auth + rate limit semantics đúng chuẩn.
6. Không được thêm dashboard business logic mới vào `backend/` legacy monolith.
7. Không được tạo compat `/api/` route mới như lời giải chính thức cho redesign dashboard.

Nếu không đáp ứng đồng thời các điều kiện trên, backend change phải bị reject và mở workstream riêng.
