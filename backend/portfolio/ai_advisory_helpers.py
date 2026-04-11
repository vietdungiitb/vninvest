"""
ai_advisory_helpers.py
Extracted helpers for the AI Advisory (Sprint-17 feature) pipeline.
S23-04 views decomposition — extracted from views.py.
"""
from __future__ import annotations

import json
import logging
import os
import re

from django.utils import timezone

from .ai_runtime_config import resolve_ai_runtime_config
from .models import AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, WhaleAdvisory
from .serializers import (
    AIAdvisoryComponentRecordSerializer,
    AIAdvisoryExecutiveSummarySerializer,
    WhaleAdvisorySerializer,
)

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


def _sprint29_render_chart_context_block(chart_context: dict | None) -> str:
    if not isinstance(chart_context, dict) or not chart_context:
        return ''

    visible_range = chart_context.get('visible_range') or {}
    from_ts = visible_range.get('from_ts')
    to_ts = visible_range.get('to_ts')
    active_indicators = chart_context.get('active_indicators') or {}
    enabled_indicators = [name for name, enabled in active_indicators.items() if bool(enabled)]

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

    compact_payload = {
        'symbol': chart_context.get('symbol'),
        'chart_timeframe': chart_context.get('chart_timeframe'),
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
        indicator_key = str(key or '').strip().upper()
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
    api_key = str(runtime_cfg.get('api_key') or '').strip()

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


# ---------------------------------------------------------------------------
# Executive synthesis (AI)
# ---------------------------------------------------------------------------

def _sprint17_generate_executive_synthesis_with_ai(
    user,
    symbol: str,
    components: list[AIAdvisoryComponentRecord],
    summary_payload: dict,
    synthesis_preference: str = 'balanced',
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

    prompt = (
        "Ban la chuyen gia tu van chung khoan Viet Nam. "
        "Hay viet phan 'Thong tin tong hop' CHI TIET theo dung cac dau vao ben duoi.\n"
        "Yeu cau bat buoc:\n"
        "1) Viet khoang 20 dong (tu 18 den 22 dong).\n"
        "2) Moi dong bat dau bang '- '.\n"
        "3) Noi dung phai cu the, khong viet chung chung, khong nhac den viec ban la AI.\n"
        "4) Bao gom: tong quan xu huong, xung dot tin hieu, kich ban tang/giam, "
        "vung gia quan sat, quan tri rui ro, dieu kien vo hieu.\n"
        "5) Khong dua ra cam ket loi nhuan.\n\n"
        f"Input: symbol={symbol}, strategy_action={summary_payload.get('strategy_action')}, "
        f"risk_level={summary_payload.get('risk_level')}, "
        f"overall_confidence={summary_payload.get('overall_confidence')}/10.\n"
        f"So thich tong hop: {preference_instruction}\n"
        "Danh sach components:\n"
        f"{component_block}\n\n"
        "Chi tra ve noi dung 18-22 dong bat dau bang '- '."
    )

    try:
        if provider == 'openclaw':
            ai_response = _openclaw_call(prompt, max_tokens=780)
        elif provider == 'claude':
            ai_response = _claude_completion(api_key=api_key, model=model, prompt=prompt, max_tokens=780)
        elif provider == 'openai':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=780,
            )
        elif provider == 'gemini':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=780,
            )
        elif provider == 'copilot':
            ai_response = _openai_compatible_completion(
                base_url=os.getenv('COPILOT_BASE_URL', 'https://models.github.ai/inference'),
                api_key=api_key,
                model=model,
                prompt=prompt,
                max_tokens=780,
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
