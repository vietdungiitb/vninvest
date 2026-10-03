# AUDIT: AI Advisory Canonical prompt_config Runtime Integration
## Feature: Dynamic source control, new context builders, endpoint upgrade

**Date:** 2026-04-18  
**Sprint:** Sprint 35+ / AI Advisory Runtime Config Phase  
**Status:** ✅ COMPLETE  
**Branch:** dev  

---

## 1) Executive Summary

This audit documents the implementation of canonical `prompt_config` runtime configuration support for the AI Advisory synthesis pipeline, as specified in `docs/CANONICAL_AI_ADVISORY_RUNTIME_CONFIG_CONTRACT_20260418.md` (schema v2).

**Scope:**
- Added `_parse_prompt_config` helper with canonical defaults and validation
- Added 3 new optional context builders: `fundamental`, `ownership`, `sector`  
- Refactored `_sprint17_generate_executive_synthesis_with_ai` to dynamically select sources based on `prompt_config`
- Updated `_build_technical_context_for_prompt` to support per-indicator filtering
- Updated `stock_ai_advisory_summary_regenerate_api` to accept `prompt_config` from request
- Full backward compatibility — all callers without `prompt_config` get original behavior

---

## 2) Modified Files

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/portfolio/ai_advisory_helpers.py` | Extended | Added constants, parser, 3 new context builders, refactored synthesis + technical context |
| `backend/portfolio/views_ai_advisory_components_summary.py` | Updated | `stock_ai_advisory_summary_regenerate_api` reads `prompt_config` from request, passes to synthesis helper, returns `prompt_config_version` |
| `backend/tests/test_ai_advisory_prompt_config.py` | New | 9 regression tests for parser and new builders |

---

## 3) Added Constants & Helpers

### `_PROMPT_CONFIG_DEFAULTS` (dict)
Canonical source registry defaults per schema v2:
- `whale`: enabled=True, lookback=180d
- `dark_flow`: enabled=True, lookback=90d
- `technical`: enabled=True, lookback=30s, indicators=[all 8]
- `news`: enabled=True, lookback=14d
- `market`: enabled=True, lookback=7d
- `fundamental`: **enabled=False**, lookback=1q
- `ownership`: **enabled=False**, lookback=365d
- `sector`: **enabled=False**, lookback=60s

### `_PROMPT_CONFIG_REGISTRY` (dict)
Per-source lookback min/max bounds for clamping.

### `VALID_TECHNICAL_INDICATORS` (frozenset)
`{'vols', 'prices', 'cdms', 'ma20', 'ma50', 'rsi', 'bollinger', 'snapshot'}`

### `_parse_prompt_config(raw_config: dict | None) -> dict`
- Input: raw dict from client request or `None`
- Output: fully-resolved per-source config dict (all 8 sources present)
- Behavior: merges client overrides over defaults; clamps lookback to registry min/max; validates indicator strings

---

## 4) New Context Builders

### `_build_fundamental_context_for_prompt(symbol, lookback_quarters=1) -> str`
- Uses `fetch_fundamental_snapshot_dataframe` from vnbroker adapter
- Returns formatted multi-quarter fundamental metrics block (EPS, PE, ROE, ROA, etc.)
- Graceful fallback on any error

### `_build_ownership_context_for_prompt(symbol, lookback_days=365) -> str`
- Uses `fetch_insider_deals_dataframe` from vnbroker adapter
- Summarizes insider buy/sell count + top 5 recent transactions
- Filters by `lookback_days` window

### `_build_sector_context_for_prompt(symbol, lookback_sessions=60) -> str`
- Uses `fetch_industry_peers_dataframe` + `fetch_industry_benchmark_dataframe` from adapter
- Lists peer group symbols and benchmark metric statistics

---

## 5) Refactored Functions

### `_build_technical_context_for_prompt` signature change
```python
# Before
def _build_technical_context_for_prompt(user, symbol: str, lookback_sessions: int = 30) -> str

# After
def _build_technical_context_for_prompt(
    user, symbol: str, lookback_sessions: int = 30,
    enabled_indicators: list | None = None,
) -> str
```
When `enabled_indicators=None`, all indicators included (backward compat).

### `_sprint17_generate_executive_synthesis_with_ai` signature change
```python
# Before
def _sprint17_generate_executive_synthesis_with_ai(user, symbol, components, summary_payload,
    synthesis_preference='balanced', news_context='') -> str | None

# After
def _sprint17_generate_executive_synthesis_with_ai(user, symbol, components, summary_payload,
    synthesis_preference='balanced', news_context='',
    prompt_config: dict | None = None) -> str | None
```
Body now calls `_parse_prompt_config(prompt_config)` and conditionally builds each context block.

---

## 6) View Changes — `stock_ai_advisory_summary_regenerate_api`

```python
# NEW: Extract prompt_config from request
raw_prompt_config = request.data.get('prompt_config')
prompt_config = raw_prompt_config if isinstance(raw_prompt_config, dict) else None

# NEW: Pass to synthesis
ai_synthesis_text = advisory_helpers._sprint17_generate_executive_synthesis_with_ai(
    ...
    prompt_config=prompt_config,
)

# NEW: Return prompt_config_version in response
response_data = {
    'ok': True,
    'executive_summary': ...,
    'prompt_config_version': (raw_prompt_config or {}).get('version', 2) if isinstance(raw_prompt_config, dict) else 2,
}
```

---

## 7) Backward Compatibility

| Caller | Impact |
|--------|--------|
| Existing frontend (no `prompt_config`) | `prompt_config=None` → all defaults → same behavior as before |
| Direct Python callers | Default kwarg `prompt_config=None` — no change required |
| `_build_technical_context_for_prompt` internal calls | `enabled_indicators=None` → all indicators → same output |

---

## 8) Test Coverage

File: `backend/tests/test_ai_advisory_prompt_config.py`

| Test | Purpose |
|------|---------|
| `test_parse_prompt_config_none` | None input → full defaults returned |
| `test_parse_prompt_config_override` | Client overrides merged correctly |
| `test_parse_prompt_config_clamp_lookback` | Out-of-range lookback clamped to min/max |
| `test_parse_prompt_config_invalid_indicators` | Invalid indicator names filtered out |
| `test_parse_prompt_config_all_invalid_indicators_fallback` | All-invalid → fallback to full set |
| `test_build_fundamental_context_empty_symbol` | Empty symbol → '' |
| `test_build_ownership_context_empty_symbol` | Empty symbol → '' |
| `test_build_sector_context_empty_symbol` | Empty symbol → '' |
| `test_valid_technical_indicators_set` | Default indicators ⊆ VALID_TECHNICAL_INDICATORS |

---

## 9) Frontend Integration Notes (Pending)

To enable new sources from the frontend, client must send `prompt_config` in the regenerate POST body:

```json
{
  "synthesis_preference": "balanced",
  "prompt_config": {
    "version": 2,
    "sources": {
      "fundamental": { "enabled": true, "lookback": 2 },
      "technical": { "enabled": true, "lookback": 20, "indicators": ["rsi", "bollinger", "vols"] }
    }
  }
}
```

Unspecified sources default to registry values. Disabled sources are skipped entirely (no API call).
