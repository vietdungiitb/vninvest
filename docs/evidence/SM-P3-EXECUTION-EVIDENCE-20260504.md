# SM Phase 3 — Execution Evidence
**Date**: 2026-05-04  
**Phase**: SM-P3 — Business Logic Migration  
**Tasks**: SM-P3.1, SM-P3.3, SM-P3.4, SM-P3.5, SM-P3.6  

---

## 1. Files Changed

| File | Task | Change |
|------|------|--------|
| `packages/core/backend/src/identity_access/models.py` | SM-P3.1 | Added `UserProfile` model |
| `packages/core/backend/src/identity_access/migrations/0002_userprofile.py` | SM-P3.1 | NEW — migration for UserProfile |
| `packages/core/backend/src/identity_access/management/commands/migrate_userprofiles_to_core.py` | SM-P3.1.2 | NEW — management command with --dry-run/--execute, parity gate 99% |
| `packages/core/backend/src/signal_intelligence/models.py` | SM-P3.3 | Added `OrderFlowEvent` model |
| `packages/core/backend/src/signal_intelligence/migrations/0002_orderflow_event.py` | SM-P3.3 | NEW — migration |
| `packages/core/backend/src/advisory/` | SM-P3.4 | NEW domain — `SystemAISettings`, `AdvisoryRecord` models + migration |
| `packages/core/backend/src/user_workspace/` | SM-P3.5 | NEW domain — `Portfolio`, `Transaction`, `Watchlist`, `WatchlistItem` + migration |
| `packages/core/backend/src/market_data/` | SM-P3.6 | NEW domain — `StockProfile`, `DailyPrice`, `VnstockRuntimeConfig` + migration |
| `packages/core/backend/src/vninvest_core/settings.py` | SM-P3.4/5/6 | Added `advisory`, `user_workspace`, `market_data` to INSTALLED_APPS |
| `packages/core/backend/src/vninvest_core/db_router.py` | SM-P3.4/5/6 | Added new apps to `_CORE_APPS` frozenset |

---

## 2. SM-P3.1 — UserProfile (identity_access)

`UserProfile` model:
- `user`: OneToOneField(User) — one profile per user
- `tenant`: FK(CoreTenant, nullable) — tenant scoping
- `display_name`, `language`, `theme` — UI preferences
- `whale_alert_threshold` — per-user alert threshold (mirrors legacy UserConfig)
- `preferences` JSONField — extensible settings
- `legacy_user_id` — migration tracking FK reference

Management command `migrate_userprofiles_to_core`:
- `--dry-run`: preview mode, no writes
- `--execute`: upsert via `update_or_create`, batched
- Raises `CommandError` if parity < 99% after execute
- Reads from `legacy_readonly` DB; writes to `default` DB

---

## 3. SM-P3.3 — OrderFlowEvent (signal_intelligence)

`OrderFlowEvent` model:
- `event_id` (UUID), `symbol`, `session_date`, `signal_type`, `side`
- `strength`, `whale_intensity`, `cvd_at_signal`, `price_at_signal`, `volume_at_signal`
- `source_ref` — forensic reference (mirrors legacy OrderFlowSignal.id)
- `unified_alert` FK — links to UnifiedAlert
- `metadata` JSONField
- Indexes: `[symbol, session_date, signal_type]`, `[side, triggered_at]`

---

## 4. SM-P3.4 — advisory domain (NEW)

`SystemAISettings`:
- Singleton-style active AI config (is_active flag)
- Fields: ai_model, max_tokens, temperature, prompt_template

`AdvisoryRecord`:
- Replaces legacy WhaleAdvisory
- Fields: advisory_id (UUID), symbol, session_date, user FK, status, ai_model, advisory_text, context_snapshot, tokens_used, error_message, legacy_advisory_id

---

## 5. SM-P3.5 — user_workspace domain (NEW)

Models: `Portfolio`, `Transaction`, `Watchlist`, `WatchlistItem`
- Mirrors legacy Portfolio, Transaction, WatchlistGroup, WatchlistItem
- All have `legacy_*_id` fields for migration tracking
- No FK to backend.portfolio models

---

## 6. SM-P3.6 — market_data domain (NEW)

Models:
- `StockProfile`: exchange/industry/status metadata per symbol
- `DailyPrice`: canonical OHLCV, replaces legacy TickerSessionClose as long-term storage
- `VnstockRuntimeConfig`: adapter configuration (source, concurrency, retry policy)

---

## 7. Validation

```
# Python syntax checks — all 13 files
OK: identity_access/models.py
OK: identity_access/migrations/0002_userprofile.py
OK: identity_access/management/commands/migrate_userprofiles_to_core.py
OK: signal_intelligence/models.py
OK: signal_intelligence/migrations/0002_orderflow_event.py
OK: advisory/models.py
OK: advisory/migrations/0001_initial.py
OK: user_workspace/models.py
OK: user_workspace/migrations/0001_initial.py
OK: market_data/models.py
OK: market_data/migrations/0001_initial.py
OK: vninvest_core/settings.py
OK: vninvest_core/db_router.py

All Phase 3 syntax checks PASSED ✅
```

---

## 8. Not Implemented in This Phase (shadow run tasks)

Per taskboard, these require 1-week shadow runs before cutover — they are planned for Phase 3.shadow:
- SM-P3.2.3 shadow run: `process_plan_lifecycle_transitions`
- SM-P3.3.3/3.4 shadow run: `detect_and_store_global_whale_alerts` / `detect_and_store_order_flow`
- SM-P3.4.4 shadow run: `generate_whale_advisory_task`
- SM-P3.5.3 shadow run: `sync_user_watch_assets`
- SM-P3.6.4 shadow run: `prefetch_realtime_ticker_shard → fetch_symbol_batch`

These cannot proceed until real production traffic runs for 3 consecutive trade days with parity >= 99%.

---

## 9. Residual Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shadow run tasks not yet wired | Cutover blocked | Proceed only after 3-day shadow + parity gate |
| Migration command requires `legacy_readonly` DB to be reachable | Migration fails if network down | Document runbook: must run during maintenance window |
| `advisory` app needs `OPENAI_API_KEY` or AI provider config at runtime | Advisory generation fails silently | SystemAISettings allows disabling; task should check before calling |
| `DailyPrice.unique_together(symbol, date)` constraint | Upsert failures on duplicate ingest | Use `update_or_create` or `INSERT ... ON CONFLICT` in ingest task |
