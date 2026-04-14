"""
ai_advisory_helpers.py
Extracted helpers for the AI Advisory (Sprint-17 feature) pipeline.
S23-04 views decomposition — extracted from views.py.
"""
from __future__ import annotations

from datetime import timedelta
import hashlib
import json
import logging
import os
import re
from statistics import pstdev

from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone

from .ai_runtime_config import resolve_ai_runtime_config
from .models import AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, DailyPrice, OrderFlowSignal, WhaleAdvisory
from .serializers import (
    AIAdvisoryComponentRecordSerializer,
    AIAdvisoryExecutiveSummarySerializer,
    WhaleAdvisorySerializer,
)
from .stock_workspace_helpers import _build_stock_workspace_overview, _compute_rsi, _compute_stock_workspace_technical

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Component helpers
# ---------------------------------------------------------------------------

def _sprint17_suggested_action_from_status(status_value: str) -> str:
    mapping = {
        'oversold': AIAdvisoryComponentRecord.SuggestedAction.BUY,
        'breakout': AIAdvisoryComponentRecord.SuggestedAction.BUY,
        'overbought': AIAdvisoryComponentRecord.SuggestedAction.SELL,
        'accumulation': AIAdvisoryComponentRecord.SuggestedAction.WATCH,
        'neutral': AIAdvisoryComponentRecord.SuggestedAction.WATCH,
    }
    return mapping.get(status_value, AIAdvisoryComponentRecord.SuggestedAction.WATCH)


def _sprint17_build_component_templates(symbol: str, latest_advisory, dark_flow: dict, timeframe: str, chart_context: dict | None = None) -> list[dict]:
    side = str((getattr(latest_advisory, 'side', '') or 'UNKNOWN')).upper()
    signal_type = str((dark_flow or {}).get('signal_type') or 'none').lower()
    signal_strength = float((dark_flow or {}).get('strength') or 0)

    if side == 'BUY':
        pa_status = AIAdvisoryComponentRecord.StatusChoice.ACCUMULATION
    elif side == 'SELL':
        pa_status = AIAdvisoryComponentRecord.StatusChoice.OVERBOUGHT
    else:
        pa_status = AIAdvisoryComponentRecord.StatusChoice.NEUTRAL

    if signal_type in ('iceberg', 'twap_bot') and signal_strength >= 50:
        vo_status = AIAdvisoryComponentRecord.StatusChoice.BREAKOUT
    elif signal_type == 'absorption':
        vo_status = AIAdvisoryComponentRecord.StatusChoice.ACCUMULATION
    else:
        vo_status = AIAdvisoryComponentRecord.StatusChoice.NEUTRAL

    indicator_status = (
        AIAdvisoryComponentRecord.StatusChoice.OVERBOUGHT
        if side == 'SELL'
        else AIAdvisoryComponentRecord.StatusChoice.OVERSOLD
        if side == 'BUY'
        else AIAdvisoryComponentRecord.StatusChoice.NEUTRAL
    )
    preferred_indicator = _sprint29_pick_primary_indicator(chart_context)
    indicator_name = preferred_indicator or 'RSI + Bollinger Bands'

    return [
        {
            'symbol': symbol,
            'component_type': AIAdvisoryComponentRecord.ComponentType.PRICE_ACTION,
            'indicator_name': 'Price Action',
            'status': pa_status,
            'confidence_score': 6,
            'suggested_action': _sprint17_suggested_action_from_status(pa_status),
            'rationale_text': f'Gia dang phan ung theo dong lenh {side}; can theo doi phan ung vung ho tro/khang cu gan nhat.',
            'timeframe': timeframe,
        },
        {
            'symbol': symbol,
            'component_type': AIAdvisoryComponentRecord.ComponentType.INDICATOR,
            'indicator_name': indicator_name,
            'status': indicator_status,
            'confidence_score': 5,
            'suggested_action': _sprint17_suggested_action_from_status(indicator_status),
            'rationale_text': 'Indicator component duoc sinh tu context advisory hien tai va can duoc xac nhan boi du lieu thuc te.',
            'timeframe': timeframe,
        },
        {
            'symbol': symbol,
            'component_type': AIAdvisoryComponentRecord.ComponentType.VOLUME_ORDERFLOW,
            'indicator_name': 'Volume / Order Flow',
            'status': vo_status,
            'confidence_score': int(max(3, min(10, round(signal_strength / 10)))) if signal_strength > 0 else 4,
            'suggested_action': _sprint17_suggested_action_from_status(vo_status),
            'rationale_text': f"Order flow signal={signal_type}, strength={signal_strength:.1f}. Dung de kiem chung xac suat dong tien lon.",
            'timeframe': timeframe,
        },
    ]


def _sprint17_extract_json_block(raw_text: str) -> str:
    text = str(raw_text or '').strip()
    if not text:
        return ''
    fenced_match = re.search(r'```(?:json)?\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*```', text, flags=re.IGNORECASE)
    if fenced_match:
        return fenced_match.group(1).strip()
    object_match = re.search(r'(\{[\s\S]*\})', text)
    if object_match:
        return object_match.group(1).strip()
    array_match = re.search(r'(\[[\s\S]*\])', text)
    if array_match:
        return array_match.group(1).strip()
    return ''


def _sprint17_normalize_ai_component_payload(raw_item: dict, symbol: str, timeframe: str) -> dict | None:
    if not isinstance(raw_item, dict):
        return None

    valid_component_types = {choice for choice, _ in AIAdvisoryComponentRecord.ComponentType.choices}
    valid_statuses = {choice for choice, _ in AIAdvisoryComponentRecord.StatusChoice.choices}
    valid_actions = {choice for choice, _ in AIAdvisoryComponentRecord.SuggestedAction.choices}
    valid_timeframes = {choice for choice, _ in AIAdvisoryComponentRecord.TimeframeChoice.choices}

    component_type = str(raw_item.get('component_type') or '').strip().lower()
    status = str(raw_item.get('status') or '').strip().lower()
    suggested_action = str(raw_item.get('suggested_action') or '').strip().lower()
    indicator_name = str(raw_item.get('indicator_name') or 'General').strip()[:100] or 'General'
    rationale_text = str(raw_item.get('rationale_text') or '').strip()

    if component_type not in valid_component_types:
        return None
    if status not in valid_statuses:
        status = AIAdvisoryComponentRecord.StatusChoice.NEUTRAL
    if suggested_action not in valid_actions:
        suggested_action = _sprint17_suggested_action_from_status(status)

    try:
        confidence_score = int(raw_item.get('confidence_score', 5) or 5)
    except (TypeError, ValueError):
        confidence_score = 5
    confidence_score = int(max(1, min(10, confidence_score)))

    include_in_summary = bool(raw_item.get('include_in_summary', True))
    resolved_timeframe = timeframe if timeframe in valid_timeframes else AIAdvisoryComponentRecord.TimeframeChoice.M30

    return {
        'symbol': symbol,
        'component_type': component_type,
        'indicator_name': indicator_name,
        'status': status,
        'confidence_score': confidence_score,
        'suggested_action': suggested_action,
        'rationale_text': rationale_text,
        'timeframe': resolved_timeframe,
        'include_in_summary': include_in_summary,
    }


_SAFE_SYMBOL_RE = re.compile(r'[^A-Za-z0-9\-\.]')
_SAFE_TIMEFRAME_RE = re.compile(r'[^A-Za-z0-9]')
_SAFE_INDICATOR_RE = re.compile(r'[^A-Za-z0-9_\-]')
_PROMPT_INJECT_PATTERNS = re.compile(
    r'ignore\s+previous|disregard\s+above|system\s+prompt|<\|im_end\|>|<\|im_start\|>',
    re.IGNORECASE,
)


def _sanitize_for_prompt(value: str, max_len: int, allow_re: re.Pattern) -> str:
    """Strip injection-unsafe content and limit length for strings embedded in AI prompts."""
    raw = str(value or '')
    # Check for injection patterns on raw value first (before character stripping).
    if _PROMPT_INJECT_PATTERNS.search(raw):
        return ''
    return allow_re.sub('', raw[:max_len * 2]).strip()[:max_len]


def _sprint29_render_chart_context_block(chart_context: dict | None) -> str:
    if not isinstance(chart_context, dict) or not chart_context:
        return ''

    visible_range = chart_context.get('visible_range') or {}
    from_ts = visible_range.get('from_ts')
    to_ts = visible_range.get('to_ts')
    active_indicators = chart_context.get('active_indicators') or {}
    enabled_indicators = [
        _sanitize_for_prompt(name, 20, _SAFE_INDICATOR_RE)
        for name, enabled in active_indicators.items()
        if bool(enabled)
    ]
    enabled_indicators = [ind for ind in enabled_indicators if ind]

    ohlcv_rows = chart_context.get('ohlcv') or []
    sampled_rows = ohlcv_rows[-20:] if len(ohlcv_rows) > 20 else ohlcv_rows
    sampled_rows = [
        {
            'ts': row.get('ts'),
            'o': row.get('o'),
            'h': row.get('h'),
            'l': row.get('l'),
            'c': row.get('c'),
            'v': row.get('v'),
        }
        for row in sampled_rows
        if isinstance(row, dict)
    ]

    metrics = chart_context.get('computed_metrics') or {}
    compact_metrics = {
        'change_visible_pct': metrics.get('change_visible_pct'),
        'volatility_visible': metrics.get('volatility_visible'),
        'volume_ratio_vs_20': metrics.get('volume_ratio_vs_20'),
        'atr_estimate': metrics.get('atr_estimate'),
    }

    # Sanitize user-controlled string fields before embedding in AI prompt.
    safe_symbol = _sanitize_for_prompt(chart_context.get('symbol') or '', 20, _SAFE_SYMBOL_RE)
    safe_timeframe = _sanitize_for_prompt(chart_context.get('chart_timeframe') or '', 10, _SAFE_TIMEFRAME_RE)

    compact_payload = {
        'symbol': safe_symbol,
        'chart_timeframe': safe_timeframe,
        'visible_range': {'from_ts': from_ts, 'to_ts': to_ts},
        'enabled_indicators': enabled_indicators,
        'sampled_ohlcv': sampled_rows,
        'computed_metrics': compact_metrics,
    }
    return json.dumps(compact_payload, ensure_ascii=False, separators=(',', ':'))


def _sprint29_get_enabled_indicators(chart_context: dict | None) -> list[str]:
    if not isinstance(chart_context, dict):
        return []
    active_indicators = chart_context.get('active_indicators')
    if not isinstance(active_indicators, dict):
        return []
    enabled = []
    for key, value in active_indicators.items():
        indicator_key = _sanitize_for_prompt(key, 20, _SAFE_INDICATOR_RE).upper()
        if indicator_key and bool(value):
            enabled.append(indicator_key)
    return enabled


def _sprint29_pick_primary_indicator(chart_context: dict | None) -> str | None:
    enabled = _sprint29_get_enabled_indicators(chart_context)
    if not enabled:
        return None

    # Prioritize indicators that users most often expect dedicated tabs for.
    priority = ['RSI', 'MACD', 'VOL', 'KDJ', 'STOCH', 'OBV', 'ATR', 'EMA', 'BOLL', 'MA', 'SAR']
    enabled_set = set(enabled)
    for indicator in priority:
        if indicator in enabled_set:
            return indicator
    return enabled[0]


def _sprint17_generate_component_templates_with_ai(
    user,
    symbol: str,
    latest_advisory,
    dark_flow: dict,
    timeframe: str,
    chart_context: dict | None = None,
) -> list[dict]:
    from portfolio.ai_service import _claude_completion, _openai_compatible_completion
    from portfolio.openclaw_client import _call as _openclaw_call

    runtime_cfg = resolve_ai_runtime_config(user=user)
    if not runtime_cfg.get('ready'):
        return []
    provider = str(runtime_cfg.get('provider') or 'openclaw').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    # Pop api_key immediately; prevents key exposure if runtime_cfg is ever logged downstream.
    api_key = str(runtime_cfg.pop('api_key', '') or '').strip()

    side = str((getattr(latest_advisory, 'side', '') or 'UNKNOWN')).upper()
    signal_type = str((dark_flow or {}).get('signal_type') or 'none').lower()
    signal_strength = float((dark_flow or {}).get('strength') or 0)
    # F2 Fix: Use correct tick_rate field name (tick_rate_per_min, not .score)
    tick_rate = float(((dark_flow or {}).get('components') or {}).get('tick_rate', {}).get('tick_rate_per_min') or 0)
    chart_context_block = _sprint29_render_chart_context_block(chart_context)
    enabled_indicators = _sprint29_get_enabled_indicators(chart_context)
    preferred_indicator = _sprint29_pick_primary_indicator(chart_context)

    prompt = (
        'Ban la AI analyst cho TTCK Viet Nam. '\
        'Hay tra ve JSON DUY NHAT theo dung schema sau, khong giai thich them:\n'
        '{"components":[{'
        '"component_type":"price_action|indicator|volume_orderflow|sentiment",'
        '"indicator_name":"string<=100",'
        '"status":"overbought|oversold|accumulation|breakout|neutral",'
        '"confidence_score":1-10,'
        '"suggested_action":"watch|buy|sell|hold_off",'
        '"rationale_text":"string",'
        '"include_in_summary":true'
        '}]}\n'
        'Yeu cau: sinh dung 3 components theo thu tu: price_action, indicator, volume_orderflow. '
        'Khong duoc lap component_type, khong them field khac.\n'
        f'Input context: symbol={symbol}, timeframe={timeframe}, advisory_side={side}, '
        f'order_flow_signal={signal_type}, order_flow_strength={signal_strength:.1f}, tick_rate_score={tick_rate:.1f}.\n'
    )
    if enabled_indicators:
        prompt += f'Active indicators tren chart hien tai: {", ".join(enabled_indicators)}.\n'
    if preferred_indicator:
        prompt += f'Yeu cau dac biet: component_type="indicator" bat buoc uu tien indicator_name="{preferred_indicator}" neu indicator nay dang active.\n'
    if chart_context_block:
        prompt += f'Client chart context (uu tien boi canh nay neu co xung dot du lieu): {chart_context_block}\n'
    prompt += 'Output phai la JSON hop le.'

    if provider != 'openclaw' and not api_key:
        return []

    # Prompt caching: identical prompts within 15 min hit cache instead of calling the AI provider.
    _prompt_cache_key = 'advisory:prompt-cache:components:' + hashlib.md5(prompt.encode('utf-8')).hexdigest()
    _PROMPT_CACHE_TTL = int(os.getenv('ADVISORY_PROMPT_CACHE_TTL_SECONDS', '900'))  # 15 min default
    _cached_templates = cache.get(_prompt_cache_key) if _PROMPT_CACHE_TTL > 0 else None
    if _cached_templates is not None:
        logger.debug('Sprint17 AI component generation: prompt cache hit symbol=%s', symbol)
        return _cached_templates

    try:
        if provider == 'openclaw':
            if not api_key:
                return []
            ai_response = _openclaw_call(prompt, max_tokens=420)
        elif provider == 'claude':
            ai_response = _claude_completion(api_key=api_key, model=model, prompt=prompt, max_tokens=420)
        elif provider == 'openai':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=420,
            )
        elif provider == 'gemini':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=420,
            )
        elif provider == 'copilot':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('COPILOT_BASE_URL', 'https://models.github.ai/inference'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=420,
                extra_headers={
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': os.getenv('COPILOT_API_VERSION', '2026-03-10'),
                },
            )
        else:
            return []

        raw_text = str((ai_response or {}).get('text') or '').strip()
        if not raw_text:
            return []
        json_block = _sprint17_extract_json_block(raw_text)
        if not json_block:
            return []

        parsed = json.loads(json_block)
        if isinstance(parsed, dict):
            raw_components = parsed.get('components') or []
        elif isinstance(parsed, list):
            raw_components = parsed
        else:
            raw_components = []

        templates: list[dict] = []
        seen_types: set[str] = set()
        for raw_item in raw_components:
            normalized = _sprint17_normalize_ai_component_payload(raw_item, symbol=symbol, timeframe=timeframe)
            if not normalized:
                continue
            ctype = normalized['component_type']
            if ctype in seen_types:
                continue
            seen_types.add(ctype)
            templates.append(normalized)
            if len(templates) >= 4:
                break
        if templates and _PROMPT_CACHE_TTL > 0:
            cache.set(_prompt_cache_key, templates, timeout=_PROMPT_CACHE_TTL)
        return templates
    except Exception as exc:
        logger.warning('Sprint17 AI component generation fallback to template symbol=%s err=%s', symbol, exc)
        return []


# ---------------------------------------------------------------------------
# Summary computation
# ---------------------------------------------------------------------------

def _sprint17_compute_summary_from_components(components: list[AIAdvisoryComponentRecord]) -> dict:
    if not components:
        return {
            'strategy_action': AIAdvisoryExecutiveSummary.StrategyAction.STAND_ASIDE,
            'synthesis_text': 'Khong co component active de tong hop.',
            'target_price_zone': '',
            'stop_loss_zone': '',
            'risk_level': AIAdvisoryExecutiveSummary.RiskLevel.MEDIUM,
            'overall_confidence': 1,
            'used_component_ids': [],
        }

    weight_map = {
        AIAdvisoryComponentRecord.ComponentType.PRICE_ACTION: 35,
        AIAdvisoryComponentRecord.ComponentType.INDICATOR: 25,
        AIAdvisoryComponentRecord.ComponentType.VOLUME_ORDERFLOW: 30,
        AIAdvisoryComponentRecord.ComponentType.SENTIMENT: 10,
    }
    score = 0.0
    confidence_weighted = 0.0
    total_weight = 0.0
    for item in components:
        w = float(weight_map.get(item.component_type, 10))
        total_weight += w
        confidence_weighted += float(item.confidence_score or 0) * w
        if item.suggested_action == AIAdvisoryComponentRecord.SuggestedAction.BUY:
            score += 1.0 * w
        elif item.suggested_action == AIAdvisoryComponentRecord.SuggestedAction.SELL:
            score -= 1.0 * w
        elif item.suggested_action == AIAdvisoryComponentRecord.SuggestedAction.HOLD_OFF:
            score -= 0.3 * w

    normalized = score / total_weight if total_weight else 0.0
    avg_conf = (confidence_weighted / total_weight) if total_weight else 5.0

    if normalized >= 0.25:
        action = AIAdvisoryExecutiveSummary.StrategyAction.BUY
    elif normalized <= -0.25:
        action = AIAdvisoryExecutiveSummary.StrategyAction.SELL
    elif abs(normalized) <= 0.08:
        action = AIAdvisoryExecutiveSummary.StrategyAction.HOLD
    else:
        action = AIAdvisoryExecutiveSummary.StrategyAction.STAND_ASIDE

    if avg_conf >= 7.5:
        risk = AIAdvisoryExecutiveSummary.RiskLevel.LOW
    elif avg_conf >= 5.5:
        risk = AIAdvisoryExecutiveSummary.RiskLevel.MEDIUM
    else:
        risk = AIAdvisoryExecutiveSummary.RiskLevel.HIGH

    summary_text = (
        f"Tong hop {len(components)} component: score={normalized:.2f}, confidence TB={avg_conf:.1f}. "
        "Khuyen nghi duoc tao theo weighting Trend/Momentum/Volume/Sentiment."
    )

    return {
        'strategy_action': action,
        'synthesis_text': summary_text,
        'target_price_zone': 'Xac dinh theo khang cu gan nhat (manual confirm).',
        'stop_loss_zone': 'Xac dinh theo ho tro gan nhat (manual confirm).',
        'risk_level': risk,
        'overall_confidence': int(max(1, min(10, round(avg_conf)))),
        'used_component_ids': [item.id for item in components],
    }


def _sprint17_enforce_summary_narrative_policy(summary_payload: dict, components: list[AIAdvisoryComponentRecord]) -> dict:
    payload = dict(summary_payload or {})
    raw_text = str(payload.get('synthesis_text') or '').strip()

    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        lines = ['- Tong hop thong tin tu advisory components.']
    normalized_lines = [line if line.startswith('- ') else f'- {line.lstrip("- ").strip()}' for line in lines]

    text_blob = '\n'.join(normalized_lines).lower()
    has_evidence = 'evidence bullets:' in text_blob
    has_invalidating = 'invalidating conditions:' in text_blob

    if not has_evidence:
        normalized_lines.append('- Evidence bullets:')
        for item in sorted(components, key=lambda comp: int(comp.confidence_score or 0), reverse=True)[:3]:
            normalized_lines.append(
                f"- {item.indicator_name}: status={item.status}, confidence={int(item.confidence_score or 0)}/10, action={item.suggested_action}."
            )

    if not has_invalidating:
        action = str(payload.get('strategy_action') or '').upper()
        normalized_lines.append('- Invalidating conditions:')
        if action == AIAdvisoryExecutiveSummary.StrategyAction.BUY:
            normalized_lines.append('- Gia dong cua roi duoi vung ho tro gan nhat voi khoi luong tang dot bien.')
            normalized_lines.append('- RVOL suy yeu lien tiep trong khi dong tien lon chuyen sang ban chu dong.')
        elif action == AIAdvisoryExecutiveSummary.StrategyAction.SELL:
            normalized_lines.append('- Gia dong cua vuot lai vung khang cu quan trong voi dong tien xac nhan.')
            normalized_lines.append('- Luc ban giam nhanh va cac tin hieu momentum dao chieu sang tich cuc.')
        else:
            normalized_lines.append('- Xuat hien breakout/breakdown ro rang duoc xac nhan boi volume va order-flow.')
            normalized_lines.append('- Bien dong rui ro vuot nguong chap nhan theo ke hoach quan tri vi the.')

    payload['synthesis_text'] = '\n'.join(normalized_lines)
    return payload


def _safe_float(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _format_dt_short(value) -> str:
    if value is None:
        return 'n/a'
    try:
        local_value = timezone.localtime(value)
    except Exception:
        local_value = value
    try:
        return local_value.strftime('%d/%m %H:%M')
    except Exception:
        return str(value)


def _format_billion(value: float) -> str:
    return f'{(_safe_float(value) / 1_000_000_000):.1f} ty'


def _format_price_level(value: float | None) -> str:
    if value is None:
        return 'n/a'

    numeric_value = _safe_float(value)
    if abs(numeric_value) >= 1000:
        return f'{numeric_value:,.0f}'
    return f'{numeric_value:.2f}'


def _fetch_live_price_anchor(symbol: str) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return {}

    try:
        from .adapters.vnstock_adapter import fetch_price_board_dataframe

        price_board_df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
        if price_board_df is None or getattr(price_board_df, 'empty', True):
            return {}

        listing_row = price_board_df['match'].iloc[0] if 'match' in price_board_df.columns.get_level_values(0) else None
        if listing_row is None:
            return {}

        current_price = _safe_float(listing_row.get('match_price'))
        reference_price = _safe_float(listing_row.get('reference_price'))
        high_price = _safe_float(listing_row.get('highest'))
        low_price = _safe_float(listing_row.get('lowest'))
        return {
            'current_price': current_price,
            'reference_price': reference_price,
            'high_price': high_price,
            'low_price': low_price,
            'source': 'live_price_board',
        }
    except Exception as exc:
        logger.debug('Live price anchor fallback symbol=%s err=%s', normalized_symbol, exc)
        return {}


def _resolve_price_scale_factor(symbol: str, overview: dict | None, latest_close: float | None) -> tuple[float, dict]:
    latest_close_value = _safe_float(latest_close)
    if latest_close_value <= 0:
        return 1.0, {}

    live_anchor = _fetch_live_price_anchor(symbol)
    anchor_price = _safe_float(
        live_anchor.get('current_price')
        or live_anchor.get('reference_price')
        or (overview or {}).get('current_price')
        or (overview or {}).get('reference_price')
        or latest_close_value
    )
    if anchor_price <= 0:
        return 1.0, live_anchor

    scale_factor = anchor_price / latest_close_value
    if 0.2 <= scale_factor <= 5.0:
        return 1.0, live_anchor
    return scale_factor, live_anchor


def _market_session_label(now_local) -> str:
    weekday = getattr(now_local, 'weekday', lambda: 0)()
    if weekday >= 5:
        return 'off_market_weekend'

    minutes = (now_local.hour * 60) + now_local.minute
    if minutes < 9 * 60:
        return 'pre_market'
    if 9 * 60 <= minutes < 11 * 60 + 30:
        return 'in_market_morning'
    if 11 * 60 + 30 <= minutes < 13 * 60:
        return 'midday_break'
    if 13 * 60 <= minutes < 15 * 60:
        return 'in_market_afternoon'
    return 'post_market'


def _compute_rsi_series(values: list[float], window: int = 14) -> list[float | None]:
    series: list[float | None] = []
    for idx in range(len(values)):
        if idx < window:
            series.append(None)
            continue
        series.append(_compute_rsi(values[: idx + 1], window))
    return series


def _compute_macd_series(values: list[float]) -> list[dict]:
    if len(values) < 35:
        return []

    k12 = 2.0 / 13.0
    k26 = 2.0 / 27.0
    k9 = 2.0 / 10.0

    ema12 = None
    ema26 = None
    signal = None
    macd_values: list[float] = []
    output: list[dict] = []

    for idx, value in enumerate(values):
        if idx == 11:
            ema12 = sum(values[:12]) / 12.0
        elif idx > 11 and ema12 is not None:
            ema12 = value * k12 + ema12 * (1 - k12)

        if idx == 25:
            ema26 = sum(values[:26]) / 26.0
        elif idx > 25 and ema26 is not None:
            ema26 = value * k26 + ema26 * (1 - k26)

        if ema12 is None or ema26 is None:
            continue

        macd = ema12 - ema26
        macd_values.append(macd)
        if len(macd_values) == 9:
            signal = sum(macd_values[:9]) / 9.0
        elif len(macd_values) > 9 and signal is not None:
            signal = macd * k9 + signal * (1 - k9)

        if signal is None:
            continue

        output.append(
            {
                'macd': macd,
                'signal': signal,
                'hist': macd - signal,
            }
        )

    return output


def _compute_bollinger_snapshot(close_values: list[float], window: int = 20) -> dict | None:
    if len(close_values) < window:
        return None

    recent_values = close_values[-window:]
    middle = sum(recent_values) / window
    std_dev = pstdev(recent_values) if len(recent_values) >= 2 else 0.0
    upper = middle + (2.0 * std_dev)
    lower = middle - (2.0 * std_dev)
    latest_close = close_values[-1]
    band_span = upper - lower
    band_position_pct = ((latest_close - lower) / band_span * 100.0) if band_span > 0 else None

    state = 'mid_band'
    if band_position_pct is not None:
        if band_position_pct >= 80:
            state = 'near_upper_band'
        elif band_position_pct <= 20:
            state = 'near_lower_band'

    return {
        'middle': middle,
        'upper': upper,
        'lower': lower,
        'position_pct': band_position_pct,
        'state': state,
    }


def _build_whale_context_for_prompt(user, symbol: str, lookback_days: int = 180) -> str:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or user is None:
        return ''

    since = timezone.now() - timedelta(days=max(int(lookback_days), 30))
    qs = WhaleAdvisory.objects.filter(user=user, symbol=normalized_symbol, created_at__gte=since).order_by('-created_at')
    if not qs.exists():
        return f'Whale context {lookback_days}d: khong co whale advisory du lieu luu tru.'

    buy_value = _safe_float(qs.filter(side='BUY').aggregate(total=Sum('matched_value')).get('total'))
    sell_value = _safe_float(qs.filter(side='SELL').aggregate(total=Sum('matched_value')).get('total'))
    buy_count = qs.filter(side='BUY').count()
    sell_count = qs.filter(side='SELL').count()
    total_value = buy_value + sell_value
    buy_ratio_pct = (buy_value / total_value * 100.0) if total_value > 0 else 0.0
    sell_ratio_pct = (sell_value / total_value * 100.0) if total_value > 0 else 0.0

    recent_30d_since = timezone.now() - timedelta(days=30)
    previous_30d_since = timezone.now() - timedelta(days=60)
    recent_30d_value = _safe_float(qs.filter(created_at__gte=recent_30d_since).aggregate(total=Sum('matched_value')).get('total'))
    previous_30d_value = _safe_float(
        qs.filter(created_at__gte=previous_30d_since, created_at__lt=recent_30d_since).aggregate(total=Sum('matched_value')).get('total')
    )
    whale_trend = 'on_dinh'
    if recent_30d_value > previous_30d_value * 1.15:
        whale_trend = 'tang'
    elif previous_30d_value > 0 and recent_30d_value < previous_30d_value * 0.85:
        whale_trend = 'giam'

    turnover_rows = list(
        DailyPrice.objects.filter(symbol=normalized_symbol).order_by('-date').values('close_price', 'volume')[:lookback_days]
    )
    latest_close = _safe_float(turnover_rows[0].get('close_price')) if turnover_rows else 0.0
    scale_factor, _ = _resolve_price_scale_factor(symbol=normalized_symbol, overview=None, latest_close=latest_close)
    estimated_turnover = sum(
        (_safe_float(row.get('close_price')) * scale_factor) * _safe_float(row.get('volume')) for row in turnover_rows
    )
    dominance_pct = (total_value / estimated_turnover * 100.0) if estimated_turnover > 0 else None

    recent_events = list(qs.values('created_at', 'side', 'matched_value')[:6])
    recent_block = '; '.join(
        f"{_format_dt_short(row.get('created_at'))} {str(row.get('side') or 'UNK').upper()} {_format_billion(row.get('matched_value'))}"
        for row in recent_events
    ) or 'n/a'

    dominance_text = f'{dominance_pct:.2f}%' if dominance_pct is not None else 'n/a'
    return (
        f'Whale context {lookback_days}d: BUY={buy_count} lenh/{_format_billion(buy_value)}, '
        f'SELL={sell_count} lenh/{_format_billion(sell_value)}, '
        f'buy_ratio={buy_ratio_pct:.1f}%, sell_ratio={sell_ratio_pct:.1f}%, '
        f'dominance_uoc_tinh_vs_turnover={dominance_text}.\n'
        f'Whale trend 30d: {whale_trend}; 30d_gan_nhat={_format_billion(recent_30d_value)} vs 30d_truoc={_format_billion(previous_30d_value)}.\n'
        f'Whale recent: {recent_block}'
    )


def _build_dark_flow_context_for_prompt(symbol: str, lookback_days: int = 180) -> str:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return ''

    since = timezone.now() - timedelta(days=max(int(lookback_days), 30))
    qs = OrderFlowSignal.objects.filter(symbol=normalized_symbol, created_at__gte=since).order_by('-created_at')
    if not qs.exists():
        return f'Dark flow {lookback_days}d: khong co OrderFlowSignal du lieu luu tru.'

    recent_rows = list(qs.values('created_at', 'signal_type', 'strength', 'confidence')[:12])
    peak_row = qs.order_by('-strength', '-created_at').values('created_at', 'signal_type', 'strength').first() or {}
    latest_row = recent_rows[0] if recent_rows else {}

    latest_cluster = [_safe_float(row.get('strength')) for row in recent_rows[:4]]
    previous_cluster = [_safe_float(row.get('strength')) for row in recent_rows[4:8]]
    latest_avg = sum(latest_cluster) / len(latest_cluster) if latest_cluster else 0.0
    previous_avg = sum(previous_cluster) / len(previous_cluster) if previous_cluster else 0.0
    trend = 'on_dinh'
    if latest_avg > previous_avg + 5:
        trend = 'manh_len'
    elif previous_avg > latest_avg + 5:
        trend = 'yeu_di'

    type_counts: dict[str, int] = {}
    for row in recent_rows:
        key = str(row.get('signal_type') or 'none').lower()
        type_counts[key] = type_counts.get(key, 0) + 1
    type_mix = ', '.join(f'{key}={value}' for key, value in sorted(type_counts.items(), key=lambda item: (-item[1], item[0]))[:4]) or 'n/a'
    history_block = '; '.join(
        f"{_format_dt_short(row.get('created_at'))} {str(row.get('signal_type') or 'none')}:{_safe_float(row.get('strength')):.1f}"
        for row in recent_rows[:8]
    ) or 'n/a'

    return (
        f'Dark flow {lookback_days}d: so_tin_hieu={qs.count()}, latest={str(latest_row.get("signal_type") or "none")} '
        f'{_safe_float(latest_row.get("strength")):.1f} @ {_format_dt_short(latest_row.get("created_at"))}, '
        f'peak={str(peak_row.get("signal_type") or "none")} {_safe_float(peak_row.get("strength")):.1f} @ {_format_dt_short(peak_row.get("created_at"))}, '
        f'trend={trend}.\n'
        f'Dark flow mix gan day: {type_mix}.\n'
        f'Dark flow recent history: {history_block}'
    )


def _build_technical_context_for_prompt(user, symbol: str, lookback_sessions: int = 30) -> str:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return ''

    rows_desc = list(
        DailyPrice.objects.filter(symbol=normalized_symbol)
        .order_by('-date')
        .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')[:90]
    )
    if not rows_desc:
        return ''

    rows = list(reversed(rows_desc))
    close_values = [_safe_float(row.get('close_price')) for row in rows if row.get('close_price') is not None]
    volume_values = [_safe_float(row.get('volume')) for row in rows if row.get('volume') is not None]
    high_values = [_safe_float(row.get('high_price')) for row in rows if row.get('high_price') is not None]
    low_values = [_safe_float(row.get('low_price')) for row in rows if row.get('low_price') is not None]
    if not close_values:
        return ''

    try:
        overview = _build_stock_workspace_overview(normalized_symbol, user)
    except Exception:
        overview = {}
    technical = _compute_stock_workspace_technical(rows, overview)
    scale_factor, live_anchor = _resolve_price_scale_factor(
        symbol=normalized_symbol,
        overview=overview,
        latest_close=close_values[-1] if close_values else None,
    )

    rsi_series = [value for value in _compute_rsi_series(close_values, 14) if value is not None]
    recent_rsi = rsi_series[-lookback_sessions:] if rsi_series else []
    current_rsi = recent_rsi[-1] if recent_rsi else technical.get('rsi14')
    rsi_trend = 'on_dinh'
    if len(recent_rsi) >= 6:
        rsi_delta = current_rsi - recent_rsi[-6]
        if rsi_delta >= 4:
            rsi_trend = 'di_len'
        elif rsi_delta <= -4:
            rsi_trend = 'di_xuong'

    macd_series = _compute_macd_series(close_values)
    recent_macd = macd_series[-lookback_sessions:] if macd_series else []
    current_macd = recent_macd[-1] if recent_macd else None
    previous_macd = recent_macd[-2] if len(recent_macd) >= 2 else None
    crossover = 'khong_ro'
    hist_trend = 'on_dinh'
    if current_macd and previous_macd:
        if previous_macd['macd'] <= previous_macd['signal'] and current_macd['macd'] > current_macd['signal']:
            crossover = 'bullish_cross'
        elif previous_macd['macd'] >= previous_macd['signal'] and current_macd['macd'] < current_macd['signal']:
            crossover = 'bearish_cross'
        if current_macd['hist'] > previous_macd['hist']:
            hist_trend = 'hist_tang'
        elif current_macd['hist'] < previous_macd['hist']:
            hist_trend = 'hist_giam'

    bollinger = _compute_bollinger_snapshot(close_values, 20)
    avg_volume_20 = _safe_float(technical.get('avg_volume_20'))
    current_volume = volume_values[-1] if volume_values else 0.0
    volume_ratio = (current_volume / avg_volume_20) if avg_volume_20 > 0 else 0.0
    volume_trend = 'on_dinh'
    if len(volume_values) >= 10:
        recent_vol = sum(volume_values[-5:]) / 5.0
        previous_vol = sum(volume_values[-10:-5]) / 5.0
        if recent_vol > previous_vol * 1.15:
            volume_trend = 'tang'
        elif previous_vol > 0 and recent_vol < previous_vol * 0.85:
            volume_trend = 'giam'

    support_window_lows = low_values[-lookback_sessions:] if len(low_values) >= lookback_sessions else low_values
    resistance_window_highs = high_values[-lookback_sessions:] if len(high_values) >= lookback_sessions else high_values
    support = (min(support_window_lows) * scale_factor) if support_window_lows else None
    resistance = (max(resistance_window_highs) * scale_factor) if resistance_window_highs else None

    rsi_range_text = 'n/a'
    if recent_rsi:
        rsi_range_text = f'{min(recent_rsi):.1f}-{max(recent_rsi):.1f}'

    macd_text = 'MACD 30 phien: khong du du lieu.'
    if current_macd:
        macd_text = (
            f'MACD 30 phien: macd={current_macd["macd"]:.2f}, signal={current_macd["signal"]:.2f}, '
            f'hist={current_macd["hist"]:.2f}, crossover={crossover}, hist_trend={hist_trend}.'
        )

    boll_text = 'Bollinger 30 phien: khong du du lieu.'
    if bollinger:
        position_text = f'{bollinger["position_pct"]:.1f}%' if bollinger.get('position_pct') is not None else 'n/a'
        boll_text = (
            f'Bollinger 30 phien: upper={_format_price_level(bollinger["upper"] * scale_factor)}, '
            f'middle={_format_price_level(bollinger["middle"] * scale_factor)}, '
            f'lower={_format_price_level(bollinger["lower"] * scale_factor)}, '
            f'band_pos={position_text}, state={bollinger["state"]}.'
        )

    current_price_anchor = _safe_float(
        live_anchor.get('current_price') or overview.get('current_price') or (close_values[-1] * scale_factor if close_values else 0.0)
    )
    support_text = _format_price_level(support)
    resistance_text = _format_price_level(resistance)
    current_price_text = _format_price_level(current_price_anchor)
    current_rsi_text = f'{current_rsi:.1f}' if current_rsi is not None else 'n/a'
    return (
        f'Technical 30 phien: current_price={current_price_text}, bias={technical.get("bias", "NEUTRAL")}, RSI14={current_rsi_text}, '
        f'RSI_range_30={rsi_range_text}, RSI_trend={rsi_trend}.\n'
        f'{macd_text}\n'
        f'{boll_text}\n'
        f'Volume 30 phien: current={current_volume:,.0f}, avg20={avg_volume_20:,.0f}, ratio={volume_ratio:.2f}x, '
        f'volume_trend={volume_trend}, support={support_text}, resistance={resistance_text}.'
    )


def _build_market_context_for_prompt(user, symbol: str) -> str:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or user is None:
        return ''

    now_local = timezone.localtime(timezone.now())
    latest_summaries = list(
        AIAdvisoryExecutiveSummary.objects.filter(user=user, symbol=normalized_symbol)
        .order_by('-summary_version', '-created_at')[:3]
    )
    if not latest_summaries:
        previous_line = 'Previous advisory sentiment: chua co lich su.'
    else:
        actions = ' -> '.join(str(item.strategy_action or 'HOLD') for item in reversed(latest_summaries))
        latest_item = latest_summaries[0]
        previous_line = (
            f'Previous advisory sentiment: latest={latest_item.strategy_action}/{latest_item.risk_level}/'
            f'{int(latest_item.overall_confidence or 0)}/10 @ {_format_dt_short(latest_item.created_at)}, '
            f'history={actions}.'
        )

    return (
        f'Market context: timestamp={now_local.strftime("%d/%m/%Y %H:%M:%S")}, '
        f'session={_market_session_label(now_local)}.\n'
        f'{previous_line}'
    )


# ---------------------------------------------------------------------------
# News context helper
# ---------------------------------------------------------------------------

def _fetch_news_context_for_advisory(
    symbol: str,
    user,
    max_headlines: int = 4,
    timeout_sec: float = 5.0,
) -> str:
    """
    Fetch AI-summarized news for stock and format as text block for prompt injection.
    
    Args:
        symbol: Stock code (e.g., 'MWG')
        user: User object (for access to UserConfig AI settings)
        max_headlines: Max number of headlines to include (default: 4)
        timeout_sec: Timeout for internal API call (default: 5 sec)
    
    Returns:
        Formatted news context string, or empty string if unavailable.
        Graceful degradation: no hard failure if news unavailable.
    """
    try:
        from portfolio.adapters.cache_adapter import get_cache
        
        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol:
            return ''
        
        # Try cache first (from Sprint 34 AI News module)
        ai_cache_key = f'stock:news:ai-summary:{normalized_symbol}'
        cached_ai = get_cache(ai_cache_key)
        
        if cached_ai is None:
            # Graceful degradation: news not available is OK
            logger.debug('News context cache miss for symbol=%s', normalized_symbol)
            return ''
        
        summary_text = str(cached_ai.get('summary') or '').strip()
        item_count = int(cached_ai.get('item_count') or 0)
        
        if not summary_text or item_count == 0:
            logger.debug('Empty news summary for symbol=%s', normalized_symbol)
            return ''
        
        # Format for prompt injection
        news_block = f"Tin tuc gan day ve {normalized_symbol}:\n"
        news_block += f"- {summary_text}\n"
        news_block += f"(Tong hop tu {item_count} tin tuc gan day)"
        
        logger.debug('News context fetched for symbol=%s items=%d', normalized_symbol, item_count)
        return news_block
    
    except Exception as e:
        logger.warning('Fetch news context fallback symbol=%s err=%s', symbol, e)
        return ''


# ---------------------------------------------------------------------------
# Executive synthesis (AI)
# ---------------------------------------------------------------------------

def _sprint17_generate_executive_synthesis_with_ai(
    user,
    symbol: str,
    components: list[AIAdvisoryComponentRecord],
    summary_payload: dict,
    synthesis_preference: str = 'balanced',
    news_context: str = "",
) -> str | None:
    from portfolio.ai_service import _claude_completion, _openai_compatible_completion
    from portfolio.openclaw_client import _call as _openclaw_call

    runtime_cfg = resolve_ai_runtime_config(user=user)
    if not runtime_cfg.get('ready'):
        return None
    provider = str(runtime_cfg.get('provider') or 'openclaw').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    api_key = str(runtime_cfg.get('api_key') or '').strip()

    if not api_key:
        return None

    preference = str(synthesis_preference or 'balanced').strip().lower()
    preference_map = {
        'short_term_action': 'Thien ve hanh dong giao dich ngan han (uu tien diem vao/ra, trigger va xac nhan).',
        'risk_management': 'Thien ve quan tri rui ro (uu tien drawdown control, dieu kien vo hieu, va kich ban phong thu).',
        'balanced': 'Can bang 50/50 giua hanh dong giao dich va quan tri rui ro.',
    }
    preference_instruction = preference_map.get(preference, preference_map['balanced'])

    component_lines = []
    for item in components[:6]:
        rationale = str(item.rationale_text or '').strip().replace('\n', ' ')
        rationale = rationale[:220]
        component_lines.append(
            f"- {item.indicator_name} | type={item.component_type} | status={item.status} | "
            f"confidence={item.confidence_score}/10 | action={item.suggested_action} | rationale={rationale}"
        )
    component_block = '\n'.join(component_lines) if component_lines else '- khong co component'

    whale_context_block = _build_whale_context_for_prompt(user=user, symbol=symbol, lookback_days=180)
    dark_flow_context_block = _build_dark_flow_context_for_prompt(symbol=symbol, lookback_days=180)
    technical_context_block = _build_technical_context_for_prompt(user=user, symbol=symbol, lookback_sessions=30)
    market_context_block = _build_market_context_for_prompt(user=user, symbol=symbol)

    grounding_sections = []
    if whale_context_block:
        grounding_sections.append(f'Whale / whale alert context:\n{whale_context_block}')
    if dark_flow_context_block:
        grounding_sections.append(f'Dark money / order-flow context:\n{dark_flow_context_block}')
    if technical_context_block:
        grounding_sections.append(f'Technical context 30 phien (RSI/MACD/VOL/BOLL):\n{technical_context_block}')
    if market_context_block:
        grounding_sections.append(f'Market context:\n{market_context_block}')

    # Format news block if available
    news_block = ''
    if news_context and str(news_context).strip():
        news_block = f"\n\nThong tin tin tuc:\n{news_context}\n"

    grounding_block = ''
    if grounding_sections:
        grounding_block = '\n\n'.join(grounding_sections) + '\n\n'

    prompt = (
        "Ban la chuyen gia tu van chung khoan Viet Nam. "
        "Hay viet phan 'Thong tin tong hop' CHI TIET theo dung cac dau vao ben duoi.\n"
        "Yeu cau bat buoc:\n"
        "1) Viet khoang 18-20 dong (tu 18 den 20 dong).\n"
        "2) Moi dong bat dau bang '- '.\n"
        "3) Noi dung phai cu the, khong viet chung chung, khong nhac den viec ban la AI.\n"
        "4) Bao gom: tong quan xu huong, xung dot tin hieu, kich ban tang/giam, "
        "vung gia quan sat, quan tri rui ro, dieu kien vo hieu, whale context dai han, dark money flow dai han, technical trend 30 phien va CAC TUAN NHAN TIN TUC.\n"
        "5) Khong dua ra cam ket loi nhuan.\n\n"
        f"Input: symbol={symbol}, strategy_action={summary_payload.get('strategy_action')}, "
        f"risk_level={summary_payload.get('risk_level')}, "
        f"overall_confidence={summary_payload.get('overall_confidence')}/10.\n"
        f"So thich tong hop: {preference_instruction}\n"
        f"{grounding_block}"
        f"{news_block}"
        "Danh sach components:\n"
        f"{component_block}\n\n"
        "Chi tra ve noi dung 18-20 dong bat dau bang '- '."
    )

    try:
        if provider == 'openclaw':
            ai_response = _openclaw_call(prompt, max_tokens=980)
        elif provider == 'claude':
            ai_response = _claude_completion(api_key=api_key, model=model, prompt=prompt, max_tokens=980)
        elif provider == 'openai':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=980,
            )
        elif provider == 'gemini':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=980,
            )
        elif provider == 'copilot':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('COPILOT_BASE_URL', 'https://models.github.ai/inference'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=980,
                extra_headers={
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': os.getenv('COPILOT_API_VERSION', '2026-03-10'),
                },
            )
        else:
            return None

        raw_text = str((ai_response or {}).get('text') or '').strip()
        if not raw_text:
            return None

        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
        if not lines:
            return None

        normalized_lines = []
        for line in lines[:22]:
            normalized_lines.append(line if line.startswith('- ') else f'- {line.lstrip("- ").strip()}')

        return '\n'.join(normalized_lines)
    except Exception as exc:
        logger.warning('Sprint17 executive synthesis AI fallback symbol=%s err=%s', symbol, exc)
        return None


# ---------------------------------------------------------------------------
# Session serializer helper
# ---------------------------------------------------------------------------

def _sprint17_serialize_stock_advisory_session(user, symbol: str, advisory_obj):
    components_qs = AIAdvisoryComponentRecord.objects.filter(
        user=user,
        symbol=symbol,
        is_deleted=False,
    ).order_by('-created_at')
    deleted_components_qs = AIAdvisoryComponentRecord.objects.filter(
        user=user,
        symbol=symbol,
        is_deleted=True,
    ).order_by('-updated_at', '-created_at')
    latest_summary = AIAdvisoryExecutiveSummary.objects.filter(user=user, symbol=symbol).order_by('-summary_version', '-created_at').first()
    summary_history = list(
        AIAdvisoryExecutiveSummary.objects.filter(user=user, symbol=symbol)
        .order_by('-summary_version', '-created_at')[:8]
    )
    return {
        'advisory': WhaleAdvisorySerializer(advisory_obj).data if advisory_obj else None,
        'components': AIAdvisoryComponentRecordSerializer(components_qs, many=True).data,
        'deleted_components': AIAdvisoryComponentRecordSerializer(deleted_components_qs, many=True).data,
        'executive_summary': AIAdvisoryExecutiveSummarySerializer(latest_summary).data if latest_summary else None,
        'executive_summaries': AIAdvisoryExecutiveSummarySerializer(summary_history, many=True).data,
        'components_count': components_qs.count(),
        'active_components_count': components_qs.filter(include_in_summary=True).count(),
    }
