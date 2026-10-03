# Sprint 33 API and Data Contract

Status: FROZEN FOR SPRINT 33 V1
Date: 2026-04-10

## 1) UserConfig contract

Endpoint:
- GET `/api/portfolio/userconfig/`
- PUT `/api/portfolio/userconfig/`

Required behavior:
- Existing field `advisory_whale_signal_enabled` is retained.
- Product meaning in V1 is redefined to event-based advisory toggle.

### UserConfig fields used by Sprint 33
- `language`
- `theme`
- `whale_alert_threshold`
- `ai_provider`
- `ai_model`
- `ai_api_key` (write-only)
- `ai_api_key_configured` (read-only)
- `advisory_auto_generation_enabled`
- `advisory_whale_signal_enabled` (V1 event-based toggle)
- `advisory_manual_refresh_enabled`
- `advisory_refresh_interval_hours`
- `advisory_max_auto_refreshes_per_day`
- `advisory_max_tokens_per_day`

### PUT payload example
{
  "language": "vi",
  "theme": "dark",
  "whale_alert_threshold": 500,
  "ai_provider": "openai",
  "ai_model": "gpt-4o-mini",
  "advisory_auto_generation_enabled": true,
  "advisory_whale_signal_enabled": false,
  "advisory_manual_refresh_enabled": true,
  "advisory_refresh_interval_hours": 24,
  "advisory_max_auto_refreshes_per_day": 24,
  "advisory_max_tokens_per_day": 5000
}

### GET response expectation (subset)
{
  "language": "vi",
  "theme": "dark",
  "whale_alert_threshold": 500,
  "ai_provider": "openai",
  "ai_model": "gpt-4o-mini",
  "ai_api_key_configured": true,
  "advisory_auto_generation_enabled": true,
  "advisory_whale_signal_enabled": false,
  "advisory_manual_refresh_enabled": true,
  "advisory_refresh_interval_hours": 24,
  "advisory_max_auto_refreshes_per_day": 24,
  "advisory_max_tokens_per_day": 5000
}

## 2) Advisory trigger contract

### Source groups in V1
- Manual refresh source
- Periodic auto-generation source
- Event-based source

### Event-based source family (all controlled by one toggle)
- Whale alert path
- Dark flow merge path
- Reversal queue path

### Contract rule
- If `advisory_whale_signal_enabled = false`, event-based source family must not enqueue advisory generation work for that user.
- Manual and periodic behavior remain controlled by their own existing flags.

## 3) Login error mapping contract

Endpoint:
- POST `/api/auth/token/`

Frontend handling contract:
- Invalid credentials -> show invalid login guidance.
- Unverified email -> show verification-required guidance and enable resend flow.
- Network error / 5xx -> show retry technical fallback.

Security rule:
- Do not expose sensitive internal details.
- Keep error messages user-actionable and safe.

## 4) Frontend route contract

New route target:
- `/settings` or `/user-config` (final path to be locked during implementation)

Required route behavior:
- Authenticated only.
- If user config fetch fails transiently, page should fail-soft with retry, not force logout unless auth truly invalid.

## 5) Backward compatibility notes

- No DB migration required for V1 toggle semantics reuse.
- Existing API field names remain unchanged.
- Existing clients that already send `advisory_whale_signal_enabled` remain compatible.

## 6) Open contract questions (must resolve before merge)

1. Default behavior for existing users if they never touched settings.
2. Final route path naming for UserConfig page.
3. Whether to update backend verbose labels in Sprint 33 or postpone to Sprint 33.x cleanup.
