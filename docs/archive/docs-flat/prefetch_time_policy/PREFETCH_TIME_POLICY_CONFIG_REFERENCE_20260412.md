# PREFETCH TIME POLICY - CONFIG REFERENCE (2026-04-12)

## Muc dich

Tai lieu tham chieu nhanh cho tat ca field trong `prefetch_time_policy`.

---

## 1) Top-level fields

### timezone
- Type: string
- Required: yes
- Example: `Asia/Ho_Chi_Minh`
- Notes: dung timezone IANA.

### market
- Type: object
- Required: yes

Fields:
- `open_time` (HH:MM, required)
- `close_time` (HH:MM, required)
- `pre_open_minutes` (int >= 0, required)
- `post_close_minutes` (int >= 0, required)
- `lunch_break.enabled` (bool)
- `lunch_break.start` (HH:MM, optional if enabled)
- `lunch_break.end` (HH:MM, optional if enabled)
- `weekend_mode` (enum: `offhours`)

### profiles
- Type: object
- Required: yes

Required profiles:
- `pre_open`
- `market_open`
- `lunch_break`
- `pre_close`
- `post_close`
- `offhours`

Each profile fields:
- `query_enabled` (bool)
- `interval_seconds` (int >= 5)
- `batch_size` (int >= 1)
- `symbol_limit` (int >= 0)
- `max_retries` (int >= 0)

### rate_limit_guard
- Type: object
- Required: yes

Fields:
- `jitter_percent` (number in [0, 50])
- `cooldown_multiplier_on_429` (number >= 1)
- `max_interval_seconds` (int >= 60)

---

## 2) Validation rules (minimum)

- `open_time < close_time`
- `lunch_break.start < lunch_break.end` when enabled
- `interval_seconds <= max_interval_seconds`
- `pre_open_minutes` and `post_close_minutes` must be realistic (recommend <= 180)

---

## 3) Recommended defaults

- pre_open interval: 90
- market_open interval: 35
- lunch_break interval: 180
- pre_close interval: 60
- post_close interval: 180
- offhours: query disabled

---

## 4) Example minimal valid policy

```json
{
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
    "pre_open": {"query_enabled": true, "interval_seconds": 90, "batch_size": 10, "symbol_limit": 20, "max_retries": 2},
    "market_open": {"query_enabled": true, "interval_seconds": 35, "batch_size": 20, "symbol_limit": 40, "max_retries": 4},
    "lunch_break": {"query_enabled": true, "interval_seconds": 180, "batch_size": 8, "symbol_limit": 20, "max_retries": 1},
    "pre_close": {"query_enabled": true, "interval_seconds": 60, "batch_size": 12, "symbol_limit": 30, "max_retries": 2},
    "post_close": {"query_enabled": true, "interval_seconds": 180, "batch_size": 8, "symbol_limit": 20, "max_retries": 1},
    "offhours": {"query_enabled": false, "interval_seconds": 600, "batch_size": 5, "symbol_limit": 10, "max_retries": 0}
  },
  "rate_limit_guard": {
    "jitter_percent": 15,
    "cooldown_multiplier_on_429": 2.0,
    "max_interval_seconds": 1800
  }
}
```
