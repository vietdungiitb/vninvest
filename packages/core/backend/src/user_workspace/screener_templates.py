"""Pre-built Screener templates (S2.5).

Static catalog of 12 ready-to-apply screening templates. Each template references
only allowed screener fields (see user_workspace.screener_helpers._SCREENER_ALLOWED_FIELDS)
and uses the same {field, op, value, logic} rule shape as ScreenerRule.rules_json.

Display strings are i18n keys (resolved client-side via t()); the backend stays
language-agnostic. Categories mirror the field groups used in the UI.
"""

SCREENER_TEMPLATES = [
    {
        "id": "oversold_bounce",
        "name_key": "screener.templates.oversold_bounce.name",
        "desc_key": "screener.templates.oversold_bounce.desc",
        "category": "technical",
        "rules_json": [
            {"field": "rsi_14", "op": "lt", "value": 30, "logic": "AND"},
            {"field": "price_vs_sma20_pct", "op": "lt", "value": 0, "logic": "AND"},
        ],
    },
    {
        "id": "golden_cross",
        "name_key": "screener.templates.golden_cross.name",
        "desc_key": "screener.templates.golden_cross.desc",
        "category": "technical",
        "rules_json": [
            {"field": "sma20_vs_sma50_pct", "op": "gt", "value": 0, "logic": "AND"},
            {"field": "price_vs_sma50_pct", "op": "gt", "value": 0, "logic": "AND"},
        ],
    },
    {
        "id": "momentum_breakout",
        "name_key": "screener.templates.momentum_breakout.name",
        "desc_key": "screener.templates.momentum_breakout.desc",
        "category": "technical",
        "rules_json": [
            {"field": "momentum_20d_pct", "op": "gt", "value": 20, "logic": "AND"},
        ],
    },
    {
        "id": "macd_bullish",
        "name_key": "screener.templates.macd_bullish.name",
        "desc_key": "screener.templates.macd_bullish.desc",
        "category": "technical",
        "rules_json": [
            {"field": "macd_hist", "op": "gt", "value": 0, "logic": "AND"},
        ],
    },
    {
        "id": "bollinger_squeeze",
        "name_key": "screener.templates.bollinger_squeeze.name",
        "desc_key": "screener.templates.bollinger_squeeze.desc",
        "category": "technical",
        "rules_json": [
            {"field": "bollinger_width", "op": "lt", "value": 3, "logic": "AND"},
        ],
    },
    {
        "id": "whale_accumulation",
        "name_key": "screener.templates.whale_accumulation.name",
        "desc_key": "screener.templates.whale_accumulation.desc",
        "category": "whale",
        "rules_json": [
            {"field": "whale_buy_pct", "op": "gt", "value": 60, "logic": "AND"},
        ],
    },
    {
        "id": "dark_pool_signal",
        "name_key": "screener.templates.dark_pool_signal.name",
        "desc_key": "screener.templates.dark_pool_signal.desc",
        "category": "dark",
        "rules_json": [
            {"field": "dark_flow_strength", "op": "gt", "value": 0.5, "logic": "AND"},
        ],
    },
    {
        "id": "high_dividend",
        "name_key": "screener.templates.high_dividend.name",
        "desc_key": "screener.templates.high_dividend.desc",
        "category": "fundamental",
        "rules_json": [
            {"field": "dividend_yield", "op": "gt", "value": 5, "logic": "AND"},
        ],
    },
    {
        "id": "small_cap_growth",
        "name_key": "screener.templates.small_cap_growth.name",
        "desc_key": "screener.templates.small_cap_growth.desc",
        "category": "fundamental",
        "rules_json": [
            {"field": "market_cap", "op": "lt", "value": 10000, "logic": "AND"},
            {"field": "revenue_growth_yoy", "op": "gt", "value": 15, "logic": "AND"},
        ],
    },
    {
        "id": "value_pe",
        "name_key": "screener.templates.value_pe.name",
        "desc_key": "screener.templates.value_pe.desc",
        "category": "fundamental",
        "rules_json": [
            {"field": "pe_ratio", "op": "gt", "value": 0, "logic": "AND"},
            {"field": "pe_ratio", "op": "lt", "value": 15, "logic": "AND"},
        ],
    },
    {
        "id": "volume_breakout",
        "name_key": "screener.templates.volume_breakout.name",
        "desc_key": "screener.templates.volume_breakout.desc",
        "category": "technical",
        "rules_json": [
            {"field": "volume_rvol", "op": "gt", "value": 2.5, "logic": "AND"},
            {"field": "price_vs_sma20_pct", "op": "gt", "value": 5, "logic": "AND"},
        ],
    },
    {
        "id": "profit_growth",
        "name_key": "screener.templates.profit_growth.name",
        "desc_key": "screener.templates.profit_growth.desc",
        "category": "fundamental",
        "rules_json": [
            {"field": "eps_growth_yoy", "op": "gt", "value": 20, "logic": "AND"},
            {"field": "revenue_growth_yoy", "op": "gt", "value": 15, "logic": "AND"},
        ],
    },
]
