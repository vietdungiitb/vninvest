from __future__ import annotations

from datetime import date, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

try:
    from vnstock.core.utils.market_events import MARKET_EVENTS as VNSTOCK_MARKET_EVENTS
except Exception:  # pragma: no cover - optional runtime enrichment
    VNSTOCK_MARKET_EVENTS = {}


def resolve_market_timezone_name(policy: dict | None = None, fallback: str = 'Asia/Ho_Chi_Minh') -> str:
    candidate = ''
    if isinstance(policy, dict):
        candidate = str(policy.get('timezone') or '').strip()
    if not candidate:
        candidate = fallback
    try:
        ZoneInfo(candidate)
        return candidate
    except ZoneInfoNotFoundError:
        return fallback


def resolve_market_timezone(policy: dict | None = None, fallback: str = 'Asia/Ho_Chi_Minh') -> ZoneInfo:
    return ZoneInfo(resolve_market_timezone_name(policy=policy, fallback=fallback))


def resolve_market_local_now(policy: dict | None = None, now_dt=None):
    tz = resolve_market_timezone(policy=policy)
    return (now_dt or timezone.now()).astimezone(tz)


def resolve_market_local_date(policy: dict | None = None, now_dt=None) -> date:
    return resolve_market_local_now(policy=policy, now_dt=now_dt).date()


def normalize_market_holiday_dates(raw_value, *, field_name: str, max_items: int = 366) -> list[str]:
    if raw_value is None:
        return []

    if isinstance(raw_value, str):
        items = [
            item.strip()
            for chunk in raw_value.replace('\r', '\n').split('\n')
            for item in chunk.split(',')
            if item.strip()
        ]
    elif isinstance(raw_value, list):
        items = raw_value
    else:
        raise ValueError(f'{field_name} phải là danh sách ngày nghỉ hợp lệ theo định dạng YYYY-MM-DD.')

    normalized = []
    for item in items:
        candidate = str(item or '').strip()
        if not candidate:
            continue
        try:
            parsed = date.fromisoformat(candidate)
        except ValueError:
            raise ValueError(f'{field_name} chứa ngày không hợp lệ: {candidate}. Dùng định dạng YYYY-MM-DD.')
        normalized.append(parsed.isoformat())

    normalized = list(dict.fromkeys(normalized))
    if len(normalized) > max_items:
        raise ValueError(f'{field_name} không được vượt quá {max_items} ngày nghỉ.')
    return normalized


def resolve_default_market_holiday_dates(market_code: str, *, years: list[int] | None = None) -> list[str]:
    normalized_market_code = str(market_code or '').strip().upper()
    if normalized_market_code != 'VN_STOCK':
        return []

    requested_years = years or [timezone.localdate().year]
    requested_years = list(dict.fromkeys(int(year) for year in requested_years))
    holidays = []
    for raw_date, meta in VNSTOCK_MARKET_EVENTS.items():
        try:
            parsed = date.fromisoformat(str(raw_date))
        except ValueError:
            continue
        if parsed.year not in requested_years:
            continue
        event_type = str((meta or {}).get('type') or '').strip().lower()
        if event_type not in {'holiday', 'compensation'}:
            continue
        holidays.append(parsed.isoformat())
    return list(dict.fromkeys(sorted(holidays)))


def resolve_market_holiday_dates(policy: dict | None = None) -> set[date]:
    market = policy.get('market') if isinstance(policy, dict) and isinstance(policy.get('market'), dict) else {}
    raw_holidays = market.get('holiday_dates', [])
    try:
        normalized = normalize_market_holiday_dates(
            raw_holidays,
            field_name='prefetch_time_policy.market.holiday_dates',
        )
    except ValueError:
        normalized = []
    return {date.fromisoformat(item) for item in normalized}


def is_market_closed_day(policy: dict | None, target_date: date) -> bool:
    market = policy.get('market') if isinstance(policy, dict) and isinstance(policy.get('market'), dict) else {}
    weekend_mode = str(market.get('weekend_mode', 'offhours') or 'offhours').strip().lower()
    if weekend_mode == 'offhours' and target_date.weekday() >= 5:
        return True
    return target_date in resolve_market_holiday_dates(policy)


def previous_trading_day(policy: dict | None, anchor_date: date) -> date:
    cursor = anchor_date
    attempts = 0
    while is_market_closed_day(policy, cursor):
        cursor = cursor - timedelta(days=1)
        attempts += 1
        if attempts > 370:
            break
    return cursor


def resolve_market_phase(policy: dict | None = None, now_dt=None) -> dict:
    market_policy = policy if isinstance(policy, dict) else {}
    local_now = resolve_market_local_now(market_policy, now_dt=now_dt)
    timezone_name = resolve_market_timezone_name(market_policy)
    market_code = str(market_policy.get('market_code') or 'VN_STOCK').strip().upper() or 'VN_STOCK'
    supported_timezones = list(market_policy.get('supported_timezones') or [timezone_name])
    market = market_policy.get('market') if isinstance(market_policy.get('market'), dict) else {}

    def _parse_hhmm_to_minutes(value: str, fallback_minutes: int) -> int:
        candidate = str(value or '').strip()
        try:
            hh, mm = candidate.split(':', 1)
            total = int(hh) * 60 + int(mm)
            return max(min(total, 1439), 0)
        except (TypeError, ValueError):
            return fallback_minutes

    current_date = local_now.date()
    if is_market_closed_day(market_policy, current_date):
        reason = 'holiday_offhours_mode'
        if current_date.weekday() >= 5:
            reason = 'weekend_offhours_mode'
        return {
            'profile': 'offhours',
            'reason': reason,
            'local_now': local_now,
            'timezone': timezone_name,
            'market_code': market_code,
            'supported_timezones': supported_timezones,
        }

    open_minutes = _parse_hhmm_to_minutes(market.get('open_time'), 9 * 60)
    close_minutes = _parse_hhmm_to_minutes(market.get('close_time'), 15 * 60)
    if open_minutes >= close_minutes:
        open_minutes, close_minutes = 9 * 60, 15 * 60

    now_minutes = local_now.hour * 60 + local_now.minute
    pre_open_minutes = max(int(market.get('pre_open_minutes', 30) or 30), 0)
    post_close_minutes = max(int(market.get('post_close_minutes', 30) or 30), 0)
    pre_close_minutes = max(int(market.get('pre_close_minutes', pre_open_minutes) or pre_open_minutes), 0)
    pre_open_start = max(open_minutes - pre_open_minutes, 0)
    pre_close_start = max(close_minutes - pre_close_minutes, open_minutes)
    post_close_end = min(close_minutes + post_close_minutes, 24 * 60)

    lunch = market.get('lunch_break') if isinstance(market.get('lunch_break'), dict) else {}
    lunch_enabled = bool(lunch.get('enabled', False))
    lunch_start = _parse_hhmm_to_minutes(lunch.get('start'), 11 * 60 + 30)
    lunch_end = _parse_hhmm_to_minutes(lunch.get('end'), 13 * 60)

    profile = 'offhours'
    reason = 'outside_market_windows'
    if pre_open_start <= now_minutes < open_minutes:
        profile = 'pre_open'
        reason = 'within_pre_open_window'
    elif open_minutes <= now_minutes < close_minutes:
        if lunch_enabled and lunch_start <= now_minutes < lunch_end:
            profile = 'lunch_break'
            reason = 'within_lunch_break_window'
        elif pre_close_start <= now_minutes < close_minutes:
            profile = 'pre_close'
            reason = 'within_pre_close_window'
        else:
            profile = 'market_open'
            reason = 'within_market_open_window'
    elif close_minutes <= now_minutes < post_close_end:
        profile = 'post_close'
        reason = 'within_post_close_window'

    return {
        'profile': profile,
        'reason': reason,
        'local_now': local_now,
        'timezone': timezone_name,
        'market_code': market_code,
        'supported_timezones': supported_timezones,
    }