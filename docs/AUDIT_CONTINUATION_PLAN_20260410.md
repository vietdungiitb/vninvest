# Audit Continuation Plan - 2026-04-10

## Purpose

This document records the current audit decisions so future sessions can continue without re-discovering the same context.

## Roadmap alignment

- This audit follow-up is now proposed as `Sprint 33 - UserConfig Consolidation & Advisory Governance`.
- Canonical sprint plan: `docs/SPRINT33_USERCONFIG_ADVISORY_GOVERNANCE_PLAN_20260410.md`
- Daily execution log: `docs/SPRINT33_EXECUTION_LOG.md`
- Roadmap reference: `ROADMAP_STATUS.md`

## Confirmed findings

### 1. Login UX is not explicit enough
- Backend authentication distinguishes meaningful states such as invalid credentials and unverified email.
- Frontend login still falls back to generic error messaging in several cases.
- Audit direction: improve user-facing error clarity and surface the correct next action.

### 2. User settings are fragmented
- Persistent user settings currently live behind one backend `UserConfig` API.
- Frontend configuration is distributed across Whale Advisory, Stock Detail, language context, and other flows.
- Audit direction: create a dedicated UserConfig page and move account-level settings there.

### 3. AI Advisory source policy needs to be user-controlled
- Current backend behavior supports advisory generation from three source families:
  - Manual refresh.
  - Periodic auto-generation.
  - Event-based auto-generation from whale alerts, dark flow merge, and reversal queue.
- Audit direction: keep all three source families available, but make event-based auto-generation a user option.

## Product decision recorded

### Event-based AI advisory becomes a user config option
- Do not hard-remove event-based advisory generation from the system.
- Add or repurpose a UserConfig-controlled toggle so the user decides whether advisory should auto-run on market events.
- V1 should prefer minimal change over a large schema redesign.

## Recommended V1 implementation

### Backend strategy
- Reuse the existing field `advisory_whale_signal_enabled` as the V1 toggle.
- Product meaning for V1:
  - `true`: allow event-based auto advisory.
  - `false`: disable event-based auto advisory.
- Event-based scope covered by this single toggle:
  - Whale alert accumulation.
  - Dark flow accumulation.
  - Reversal advisory auto-queue.

### Why this is the lowest-risk option
- The field already exists in `UserConfig` and is already exposed by the serializer/API.
- `generate_whale_advisory_task` already checks this field for `WHALE_SIGNAL` source.
- This avoids immediate migration cost and keeps API compatibility stable.

### Backend changes expected in V1
- Keep the final guard in `generate_whale_advisory_task`.
- Add early guards before event accumulation and reversal queue scheduling so disabled users do not produce unnecessary:
  - Redis merge state.
  - Celery tasks.
  - Noise in observability/logs.
- Keep periodic and manual flows unchanged.

### Frontend changes expected in V1
- Create a dedicated UserConfig page.
- Move account-level AI and advisory settings out of Whale Advisory page.
- Show one toggle with wording close to:
  - `Bật AI Advisory tự động khi có sự kiện thị trường`.
- Supporting description should explain that this includes whale events, dark flow, and reversal alerts.
- Whale Advisory page should focus on viewing and manually refreshing advisory, not owning account settings.

## Recommended information architecture for UserConfig page

### Section A. General preferences
- Language
- Theme

### Section B. Market monitoring
- Whale alert threshold

### Section C. AI configuration
- AI provider
- AI model
- AI API key
- AI readiness status

### Section D. AI Advisory policy
- Enable periodic auto-generation
- Refresh interval in hours
- Maximum auto refreshes per day
- Maximum token budget per day
- Enable manual refresh
- Enable event-based auto advisory

## Suggested acceptance criteria

### Login UX
- Wrong credentials show a clear invalid login message.
- Unverified email shows a verification-specific message and resend action.
- Network or backend failure shows a technical fallback without misleading the user.

### UserConfig architecture
- Users can find persistent settings in one dedicated page.
- Whale Advisory no longer acts as the primary settings screen.

### AI Advisory behavior
- Manual refresh still works when enabled.
- Periodic auto-generation still works when enabled.
- Event-based advisory is generated only when the user toggle is enabled.
- When the event-based toggle is disabled, whale alert, dark flow, and reversal signals no longer enqueue unnecessary advisory work for that user.

## Proposed next implementation order

1. Fix login error mapping and resend verification UX.
2. Create dedicated UserConfig page and move advisory settings there.
3. Wire the event-based advisory toggle end-to-end.
4. Add regression tests for event-based advisory disabled path.
5. Update user-facing copy and audit docs.

## Open questions for next session

1. Should event-based auto advisory default to on for existing users, or should it default to off for safer cost control?
2. Should reversal remain part of the same V1 toggle, or be separated in V2?
3. Should Whale Advisory page keep a shortcut card linking to UserConfig, or remove settings entirely from that page?