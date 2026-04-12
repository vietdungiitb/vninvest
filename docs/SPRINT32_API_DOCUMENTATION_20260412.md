# SPRINT 32: API Documentation

**Auto-Generated:** 2026-04-12  
**API Version:** 1.0  
**Base URL:** `/api/admin-ops/vnstock-config/`

---

## 📍 Endpoints Overview

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/current/` | Fetch current configuration | Admin |
| PATCH | `/update_config/` | Update configuration (partial) | Admin |
| POST | `/reset_to_defaults/` | Reset to default values | Admin |
| GET | `/changelog/` | Get audit trail | Admin |

---

## 1️⃣ GET `/api/admin-ops/vnstock-config/current/`

**Purpose:** Retrieve current vnstock configuration

### Request

```bash
curl -X GET "http://localhost:8000/api/admin-ops/vnstock-config/current/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Response (200 OK)

```json
{
  "max_concurrency": 12,
  "retry_attempts": 1,
  "retry_backoff_seconds": 0.35,
  "rate_limit_cooldown_seconds": 20,
  "timeout_config": {
    "price_board": 8,
    "intraday": 8,
    "financial_ratio": 10,
    "history": 12,
    "listing": 12,
    "general": 8
  },
  "price_board_source": "price_board",
  "fallback_sources": ["stock_intraday_data"],
  "enable_caching": true,
  "enable_rate_limit_detection": true,
  "enable_concurrent_limit": true,
  "updated_at": "2026-04-12T10:30:45.123456Z",
  "updated_by_username": "admin"
}
```

### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| max_concurrency | integer | Current concurrency limit (1-50) |
| retry_attempts | integer | Retry count (0-5) |
| retry_backoff_seconds | float | Backoff between retries (0.0-5.0s) |
| rate_limit_cooldown_seconds | integer | Cooldown after 429 (5-120s) |
| timeout_config | object | Timeout per channel (positive integers) |
| price_board_source | string | Primary data source (price_board\|stock_intraday_data) |
| fallback_sources | array | List of fallback sources |
| enable_caching | boolean | Redis caching enabled |
| enable_rate_limit_detection | boolean | 429 detection enabled |
| enable_concurrent_limit | boolean | Concurrency limiting enabled |
| updated_at | string | ISO-8601 timestamp of last update |
| updated_by_username | string | Username of last updater (null if system) |

### Error Responses

| Code | Response |
|------|----------|
| 401 | `{"detail": "Authentication credentials were not provided"}` |
| 403 | `{"detail": "You do not have permission to perform this action"}` |

---

## 2️⃣ PATCH `/api/admin-ops/vnstock-config/update_config/`

**Purpose:** Update configuration (partial updates allowed)

### Request

```bash
curl -X PATCH "http://localhost:8000/api/admin-ops/vnstock-config/update_config/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "max_concurrency": 20,
    "rate_limit_cooldown_seconds": 30
  }'
```

### Request Body (partial update - any subset of fields)

```json
{
  "max_concurrency": 20,
  "retry_attempts": 2,
  "retry_backoff_seconds": 0.5,
  "rate_limit_cooldown_seconds": 30,
  "timeout_config": {
    "price_board": 10,
    "intraday": 9,
    "financial_ratio": 12,
    "history": 15,
    "listing": 15,
    "general": 10
  },
  "price_board_source": "stock_intraday_data",
  "fallback_sources": ["price_board"],
  "enable_caching": false,
  "enable_rate_limit_detection": true,
  "enable_concurrent_limit": true
}
```

### Response (200 OK)

```json
{
  "status": "success",
  "message": "Vnstock configuration updated successfully",
  "config": {
    "max_concurrency": 20,
    "retry_attempts": 2,
    "retry_backoff_seconds": 0.5,
    "rate_limit_cooldown_seconds": 30,
    "timeout_config": {
      "price_board": 10,
      "intraday": 9,
      "financial_ratio": 12,
      "history": 15,
      "listing": 15,
      "general": 10
    },
    "price_board_source": "stock_intraday_data",
    "fallback_sources": ["price_board"],
    "enable_caching": false,
    "enable_rate_limit_detection": true,
    "enable_concurrent_limit": true,
    "updated_at": "2026-04-12T10:35:20.456789Z",
    "updated_by_username": "admin"
  }
}
```

### Validation Rules

| Field | Rule | Example |
|-------|------|---------|
| max_concurrency | 1 ≤ value ≤ 50 | 12, 20, 50 |
| retry_attempts | 0 ≤ value ≤ 5 | 0, 1, 3, 5 |
| retry_backoff_seconds | 0.0 ≤ value ≤ 5.0 | 0.35, 1.0, 2.5 |
| rate_limit_cooldown_seconds | 5 ≤ value ≤ 120 | 20, 60, 120 |
| timeout_config | dict with positive numbers | `{"price_board": 8}` |
| price_board_source | price_board \| stock_intraday_data | "price_board" |
| fallback_sources | list of valid sources | ["stock_intraday_data"] |
| enable_caching | true \| false | true |
| enable_rate_limit_detection | true \| false | true |
| enable_concurrent_limit | true \| false | true |

### Error Responses

| Code | Response |
|------|----------|
| 400 | `{"status": "error", "message": "Validation failed", "errors": {"max_concurrency": ["must be between 1 and 50"]}}` |
| 401 | `{"detail": "Authentication credentials were not provided"}` |
| 403 | `{"detail": "You do not have permission"}` |

### Examples

**Example 1: Update only concurrency**
```bash
curl -X PATCH "/api/admin-ops/vnstock-config/update_config/" \
  -H "Authorization: Bearer <token>" \
  -d '{"max_concurrency": 25}'
```

**Example 2: Update timeout for specific channel**
```bash
curl -X PATCH "/api/admin-ops/vnstock-config/update_config/" \
  -H "Authorization: Bearer <token>" \
  -d '{"timeout_config": {"price_board": 12, "intraday": 10, "financial_ratio": 15, "history": 18, "listing": 18, "general": 12}}'
```

**Example 3: Switch to fallback source**
```bash
curl -X PATCH "/api/admin-ops/vnstock-config/update_config/" \
  -H "Authorization: Bearer <token>" \
  -d '{"price_board_source": "stock_intraday_data", "fallback_sources": ["price_board"]}'
```

---

## 3️⃣ POST `/api/admin-ops/vnstock-config/reset_to_defaults/`

**Purpose:** Reset configuration to default values

### Request

```bash
curl -X POST "http://localhost:8000/api/admin-ops/vnstock-config/reset_to_defaults/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

### Response (200 OK)

```json
{
  "status": "success",
  "message": "Configuration reset to defaults",
  "config": {
    "max_concurrency": 12,
    "retry_attempts": 1,
    "retry_backoff_seconds": 0.35,
    "rate_limit_cooldown_seconds": 20,
    "timeout_config": {
      "price_board": 8,
      "intraday": 8,
      "financial_ratio": 10,
      "history": 12,
      "listing": 12,
      "general": 8
    },
    "price_board_source": "price_board",
    "fallback_sources": ["stock_intraday_data"],
    "enable_caching": true,
    "enable_rate_limit_detection": true,
    "enable_concurrent_limit": true,
    "updated_at": "2026-04-12T10:40:30.789012Z",
    "updated_by_username": "admin"
  }
}
```

### Notes

- Changelog records the reset action with old values
- User is recorded as who initiated the reset
- Takes effect immediately (within 1 request)

---

## 4️⃣ GET `/api/admin-ops/vnstock-config/changelog/`

**Purpose:** Retrieve audit log of all configuration changes

### Request

```bash
curl -X GET "http://localhost:8000/api/admin-ops/vnstock-config/changelog/" \
  -H "Authorization: Bearer <token>"
```

### Response (200 OK)

```json
{
  "status": "success",
  "changelog": [
    {
      "timestamp": "2026-04-12T09:30:15.123456Z",
      "user": "admin",
      "changes": {
        "max_concurrency": {
          "old": "12",
          "new": "20"
        },
        "rate_limit_cooldown_seconds": {
          "old": "20",
          "new": "30"
        }
      }
    },
    {
      "timestamp": "2026-04-12T10:15:45.654321Z",
      "user": "qa_user",
      "changes": {
        "action": "reset_to_defaults",
        "old_values": { ... }
      }
    }
  ],
  "total_changes": 2
}
```

### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| status | string | "success" |
| changelog | array | List of change entries |
| total_changes | integer | Total number of changes recorded |

### Changelog Entry Format

| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | ISO-8601 UTC timestamp |
| user | string | Username who made change (or "system") |
| changes | object | Dict of field changes |

---

## Authentication & Authorization

### Required Headers

| Header | Value | Example |
|--------|-------|---------|
| Authorization | Bearer token | `Authorization: Bearer eyJhbGc...` |
| Content-Type | JSON | `Content-Type: application/json` |

### Permission Requirements

- **All endpoints require:** `IsAdminUser` permission
- User must be superuser or have admin access

### Getting Auth Token

```bash
# Get token
curl -X POST "http://localhost:8000/api-token-auth/" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Response
{"token": "abc123xyz..."}
```

---

## Rate Limiting

- **No explicit rate limits** on these endpoints (admin-only)
- Respects global vnstock rate limiting after config updates
- Changes take effect within 1 API cycle (5-min cache window)

---

## Common Issues & Solutions

### Q: Changes don't take effect immediately?
**A:** Cache TTL is 5 minutes. Force invalidation by restarting adapter or editing config again.

### Q: Validation error on timeout_config?
**A:** All values must be positive integers. Example: `{"price_board": 8}` not `{"price_board": "8s"}`

### Q: How long until new concurrency limit applies?
**A:** Within 1 request (< 100ms after API call returns).

### Q: Can I update only one field?
**A:** Yes! PATCH supports partial updates. Send only the fields you want to change.

---

## Integration Testing Checklist

- [ ] Test GET /current/ returns 200 with all fields
- [ ] Test PATCH /update_config/ with valid data returns 200
- [ ] Test PATCH /update_config/ with invalid data returns 400 with errors
- [ ] Test invalid concurrency (51) rejected
- [ ] Test invalid timeout (negative number) rejected
- [ ] Test POST /reset_to_defaults/ returns to defaults
- [ ] Test GET /changelog/ shows all changes
- [ ] Test 401 response without auth
- [ ] Test 403 response as non-admin user
- [ ] Verify changelog entries contain user + timestamp
- [ ] Verify adapter uses new config within 1 request

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-12

