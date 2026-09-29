# Tech Spec — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16  
**Status**: Approved for implementation  
**Parent**: `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md`

---

## 1. Phạm vi kỹ thuật

Spec này định nghĩa kỹ thuật cho:

1. Nền tảng `global symbol matrix` của alert-center.
2. Canonical alert facts cho whale, dark flow, price shock, stale quote, system, AI signal.
3. OpenAPI-native alert-center family trên `/core/v1/`.
4. Per-user delivery và AI lane.
5. Cutover rules từ compat/legacy sang native.

---

## 2. Domain boundaries

### 2.1 Foundation domain

SSOT foundation dùng lại các entity hiện có:

- `market_data.GlobalSymbolRegistry`
- `market_data.GlobalSymbolDemandSource`
- `market_data.GlobalSymbolCoverage`

Invariant:

1. Không có user-owned market-data copy.
2. Planner, detection và operator observability đều đọc cùng foundation này.
3. `ScrapeMatrix`, queue state và run-log chỉ là execution tracking.

### 2.2 Signal domain

Giữ và mở rộng các entity hiện có:

- `signal_intelligence.OrderFlowEvent` cho whale/dark-flow/order-flow facts
- `signal_intelligence.UnifiedAlert` làm read model/delivery model

Thêm các entity native mới:

- `MarketAnomalyEvent` cho `price_shock` và `stale_quote`
- `AdvisorySignalEvent` cho AI alert lane
- `UserAlertDelivery` cho per-user projection
- `UserAlertPreference` cho mute/snooze/preferences

---

## 3. Alert taxonomy

### 3.1 Main alert center

Family hợp lệ:

- `whale`
- `dark_flow`
- `price_shock`
- `stale_quote`
- `system`

### 3.2 AI lane

Family hợp lệ:

- `ai_signal`
- `ai_suggest`

Rule:

- AI lane hiển thị riêng.
- Chỉ được promote sang main feed bằng policy explicit dựa trên confidence, urgency và freshness.

---

## 4. Detection model

```text
raw/shared market data
  -> canonical facts/events
  -> unified alert read model
  -> per-user delivery projection
```

Detection semantics:

1. Whale/dark flow detect từ order-flow facts.
2. Price shock detect từ `SymbolSnapshot`, `SessionFacts`, baseline window và runtime freshness.
3. Stale quote detect từ `GlobalSymbolCoverage` + serving freshness TTL.
4. AI signal detect từ advisory outputs đã canonical hóa, không detect trực tiếp ở browser.

---

## 5. Delivery model

Per-user delivery chỉ dùng các nguồn relevance:

- holding
- watchlist
- tracked symbol
- explicit subscription/preference
- broadcast policy do operator cấu hình

`UserAlertDelivery` tối thiểu cần có:

- `user_id`
- `alert_id`
- `delivery_state` (`new`, `seen`, `acknowledged`, `muted`, `suppressed`)
- `delivered_at`
- `seen_at`
- `acknowledged_at`
- `suppression_reason`
- `metadata`

`UserAlertPreference` tối thiểu cần có:

- `user_id`
- `symbol`
- `alert_family`
- `mute_until`
- `cooldown_seconds`
- `channel_policy`

Invariant:

1. Mute/snooze chỉ tác động delivery projection.
2. Canonical global event không bị xóa hoặc overwrite vì preference user.

---

## 6. OpenAPI contract family

### 6.1 Main alert center

- `GET /core/v1/signals/alert-center/feed`
- `GET /core/v1/signals/alert-center/summary`
- `GET /core/v1/signals/alert-center/events/{alert_id}`
- `GET /core/v1/signals/alert-center/symbols/{symbol}/context`
- `POST /core/v1/signals/alert-center/events/{alert_id}/ack`
- `POST /core/v1/signals/alert-center/preferences/mute`

### 6.2 AI lane

- `GET /core/v1/signals/ai-alerts/feed`
- `GET /core/v1/signals/ai-alerts/summary`

### 6.3 Contract rules

1. List endpoints bắt buộc pagination.
2. Error responses bắt buộc dùng envelope `{detail, code, timestamp, request_id, field_errors}`.
3. Tenant isolation phải nằm ở query layer.
4. Mọi endpoint private bắt buộc auth + rate-limit semantics.

---

## 7. Response shape tối thiểu

### 7.1 Feed item

```json
{
  "alert_id": "uuid",
  "family": "whale",
  "symbol": "HPG",
  "severity": "high",
  "confidence": 0.92,
  "freshness_state": "fresh",
  "title": "Dòng tiền lớn mua chủ động tăng mạnh",
  "body": "...",
  "session_date": "2026-05-16",
  "triggered_at": "2026-05-16T09:45:12Z",
  "direction": "buy",
  "evidence_ref": "orderflow:uuid",
  "route_target": "/signals/whale-alerts?symbol=HPG"
}
```

### 7.2 Summary

```json
{
  "totals": {
    "new": 12,
    "critical": 2,
    "high": 5
  },
  "families": [
    {"family": "whale", "count": 4},
    {"family": "stale_quote", "count": 3}
  ],
  "updated_at": "2026-05-16T10:00:00Z"
}
```

---

## 8. Compat/legacy transition rules

1. Compat `/api/realtime/*` chỉ được phép làm temporary bridge.
2. Không thêm logic business mới vào compat routes.
3. Không tạo additional proxy qua legacy backend cho alert-center.
4. `packages/web` phải chuyển sang `/core/v1/` first; `frontend/src` chỉ bridge trong giai đoạn chuyển tiếp.

---

## 9. Cutover safety rules

1. Shadow/parity validation là mandatory trước khi sunset compat/legacy paths.
2. Không có big-bang cutover bỏ shadow gate.
3. Yêu cầu “skip soak/shadow” phải bị coi là exception blocked-by-default; spec này không phê duyệt exception đó.

---

## 10. Observability requirements

Phải đo được tối thiểu:

- alert fact producer lag
- unified alert materialization lag
- per-user delivery lag
- dedupe count
- mute/suppression ratio
- symbol promotion/demotion churn
- parity gap giữa feed cũ và feed mới trong giai đoạn shadow
