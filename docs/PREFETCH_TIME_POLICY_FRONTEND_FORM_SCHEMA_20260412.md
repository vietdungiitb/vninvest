# PREFETCH TIME POLICY - FRONTEND FORM SCHEMA (2026-04-12)

## Muc dich

Spec chi tiet cho form AdminOps de FE co the code nhanh va dong bo voi backend rulebook.

---

## 1) Form groups

### Group A - Market Window
- timezone (select/input)
- open_time (time)
- close_time (time)
- pre_open_minutes (number)
- post_close_minutes (number)
- lunch_break_enabled (switch)
- lunch_break_start (time)
- lunch_break_end (time)
- weekend_mode (select)

### Group B - Profile Cards (6 cards)
Moi card co 5 truong:
- query_enabled (switch)
- interval_seconds (number)
- batch_size (number)
- symbol_limit (number)
- max_retries (number)

Profiles:
- pre_open
- market_open
- lunch_break
- pre_close
- post_close
- offhours

### Group C - Rate Limit Guard
- jitter_percent (number)
- cooldown_multiplier_on_429 (number)
- max_interval_seconds (number)

---

## 2) FE state model

- `formValues`
- `fieldErrors`
- `isDirty`
- `isSaving`
- `saveStatus` (idle/success/error)
- `activePreview` (profile/query_enabled/effective_interval/reason)

---

## 3) Validation mapping

Client-side rule (truoc submit):
- Required fields not empty.
- Numeric ranges in min/max.
- Time relationships valid.

Server-side rule (sau submit):
- Map `field_errors` to exact form path.

Path mapping example:
- `prefetch_time_policy.market.open_time`
- `prefetch_time_policy.profiles.market_open.interval_seconds`

---

## 4) UX requirements

- Save button disabled when invalid or saving.
- Show inline field errors + top summary.
- Preserve unsaved values on API error.
- Reset button restores last fetched payload.

---

## 5) i18n keys namespace

Recommended namespace:
- `admin.prefetchTimePolicy.title`
- `admin.prefetchTimePolicy.market.*`
- `admin.prefetchTimePolicy.profiles.*`
- `admin.prefetchTimePolicy.guard.*`
- `admin.prefetchTimePolicy.preview.*`
- `admin.prefetchTimePolicy.actions.save`
- `admin.prefetchTimePolicy.actions.reset`
- `admin.prefetchTimePolicy.errors.*`

---

## 6) Acceptance checklist

- [ ] Form renders all fields.
- [ ] Rulebook-driven min/max reflected in UI hints.
- [ ] Validation prevents invalid submit.
- [ ] Server field errors map correctly.
- [ ] Active profile preview shown after load/save.
- [ ] Works on desktop and mobile.
