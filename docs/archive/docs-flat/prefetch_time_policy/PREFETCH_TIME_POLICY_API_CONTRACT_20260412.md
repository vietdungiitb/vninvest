# PREFETCH TIME POLICY - API CONTRACT (2026-04-12)

## 1) Scope

API contract cho admin settings phan `prefetch_time_policy`.

---

## 2) GET admin settings

Endpoint:
- GET /api/.../admin-settings

Response additions:
- `prefetch_time_policy`: object
- `prefetch_time_policy_rulebook`: object
- `prefetch_time_policy_preview` (optional): object

Example:

```json
{
  "prefetch_time_policy": {
    "timezone": "Asia/Ho_Chi_Minh",
    "market": {
      "open_time": "09:00",
      "close_time": "15:00",
      "pre_open_minutes": 30,
      "post_close_minutes": 30,
      "lunch_break": {"enabled": true, "start": "11:30", "end": "13:00"},
      "weekend_mode": "offhours"
    },
    "profiles": {
      "market_open": {"query_enabled": true, "interval_seconds": 35, "batch_size": 20, "symbol_limit": 40, "max_retries": 4},
      "offhours": {"query_enabled": false, "interval_seconds": 600, "batch_size": 5, "symbol_limit": 10, "max_retries": 0}
    },
    "rate_limit_guard": {"jitter_percent": 15, "cooldown_multiplier_on_429": 2.0, "max_interval_seconds": 1800}
  },
  "prefetch_time_policy_rulebook": {
    "interval_seconds": {"min": 5, "max": 1800},
    "batch_size": {"min": 1, "max": 200},
    "symbol_limit": {"min": 0, "max": 500},
    "max_retries": {"min": 0, "max": 10}
  },
  "prefetch_time_policy_preview": {
    "profile": "market_open",
    "query_enabled": true,
    "effective_interval_seconds": 35,
    "reason": "within market_open window"
  }
}
```

---

## 3) PUT admin settings

Endpoint:
- PUT /api/.../admin-settings

Request patch payload:

```json
{
  "prefetch_time_policy": {
    "timezone": "Asia/Ho_Chi_Minh",
    "market": {
      "open_time": "09:00",
      "close_time": "15:00",
      "pre_open_minutes": 30,
      "post_close_minutes": 30
    }
  }
}
```

Behavior:
- Partial update cho phep, backend merge voi current/default policy.
- Backend validate toan bo policy sau merge.

Success response:
- 200 + settings object moi.

Validation error response:
- 400

```json
{
  "error": "validation_error",
  "message": "prefetch_time_policy is invalid",
  "field_errors": {
    "prefetch_time_policy.market.open_time": "must be HH:MM",
    "prefetch_time_policy.profiles.market_open.interval_seconds": "must be >= 5"
  }
}
```

Permission error:
- 403

---

## 4) Backward compatibility

- Cac truong settings cu giu nguyen.
- Client cu bo qua truong moi khong bi anh huong.

---

## 5) Health payload contract additions

In `ticker_prefetch` health:
- `policy.profile`
- `policy.query_enabled`
- `policy.effective_interval_seconds`
- `policy.reason`
- `policy.next_allowed_query_at` (optional)

---

## 6) Idempotency

- PUT cung payload nhieu lan cho cung ket qua settings.
- Metadata `updated_at` thay doi theo request hop le.
