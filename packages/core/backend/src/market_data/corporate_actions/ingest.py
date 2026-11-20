"""Ingest corporate actions từ VCI 3.7.2 (trực tiếp, không qua facade KBS rỗng)."""
import hashlib
import logging
import os
from datetime import date
from decimal import Decimal
from typing import Any

from django.utils import timezone

from .parser import parse_event_title

logger = logging.getLogger(__name__)

SUPPORTED_EVENT_CODES = ('DIV', 'ISS')
DNSE_NOTE = 'DNSE get_corporate_action_history là API theo tài khoản — không dùng làm nguồn thị trường.'


class ProviderError(Exception):
    """Lỗi provider chung (network/parse/cache) — KHÔNG phải lỗi xác thực."""

    code = 'PROVIDER_ERROR'

    def __init__(self, message: str):
        super().__init__(f'{message} (mã={self.code}).')
        self.code = ProviderError.code


class ProviderAuthError(ProviderError):
    """Lỗi xác thực provider, đã chuẩn hoá mã để client xử lý."""

    code = 'PROVIDER_AUTH'

    def __init__(self, message: str):
        super(ProviderError, self).__init__(
            f'{message} (mã={self.code}). Kiểm tra env <PROVIDER>_TOKEN / quyền provider.'
        )
        self.code = ProviderAuthError.code


def get_provider_token(provider: str) -> str | None:
    return os.getenv(f'{provider.upper()}_TOKEN')


def normalize_provider_error(error: Exception) -> ProviderAuthError:
    message = str(error)
    lowered = message.lower()
    if any(token in lowered for token in ('token', 'auth', 'unauthor', 'quyền', 'provider_auth')):
        return ProviderAuthError(message)
    return ProviderError(message)


def _event_date(value: Any) -> date | None:
    if value is None:
        return None
    text = str(value)
    if text in ('', 'NaT', 'nan', 'None'):
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _normalized_number(value: Decimal | None, places: str) -> str:
    if value is None:
        return ''
    return format(Decimal(value).quantize(Decimal(places)), 'f')


def make_fallback_event_id(
    symbol: str,
    ex_date: date,
    action_type: str,
    cash_amount: Decimal | None,
    stock_ratio_pct: Decimal | None,
) -> str:
    """ID dự phòng khi VCI không trả cột id — KHÔNG chứa raw_title (AC7)."""
    payload = '|'.join([
        symbol.upper(),
        ex_date.isoformat(),
        action_type,
        _normalized_number(cash_amount, '0.01'),
        _normalized_number(stock_ratio_pct, '0.0001'),
    ])
    return 'fb-' + hashlib.sha256(payload.encode('utf-8')).hexdigest()[:32]


def fetch_corporate_actions(symbol: str, from_date: date, to_date: date | None = None) -> list[dict]:
    """Gọi trực tiếp VCI `explorer.vci.company.Company`, map sang dict chuẩn."""
    # Import tại call-time để patch `vnbroker.explorer.vci.company.Company` trong test.
    from vnbroker.explorer.vci.company import Company as VCICompany

    kwargs = {
        'from_date': from_date.strftime('%Y%m%d'),
        'event_codes': ','.join(SUPPORTED_EVENT_CODES),
    }
    if to_date is not None:
        kwargs['to_date'] = to_date.strftime('%Y%m%d')

    try:
        frame = VCICompany(symbol.upper()).events(**kwargs)
    except Exception as exc:  # noqa: BLE001 - chuẩn hoá lỗi provider
        raise normalize_provider_error(exc) from exc

    if frame is None or getattr(frame, 'empty', True):
        return []

    rows: list[dict] = []
    columns = set(frame.columns)
    for record in frame.to_dict('records'):
        code = str(record.get('event_code') or '').upper()
        if code not in SUPPORTED_EVENT_CODES:
            logger.warning('Bỏ qua event_code lạ: %s (symbol=%s)', code or '<rỗng>', symbol)
            continue

        ex_date = _event_date(record.get('exright_date'))
        if ex_date is None:
            continue

        raw_title = str(record.get('event_title_vi') or '')
        parsed = parse_event_title(raw_title, code)
        source_id = str(record.get('id') or '').strip()
        fallback = not source_id
        if fallback:
            source_id = make_fallback_event_id(
                symbol.upper(), ex_date, code,
                parsed.cash_amount, parsed.stock_ratio_pct,
            )
            logger.warning('FALLBACK_ID symbol=%s ex_date=%s raw_title=%s', symbol, ex_date, raw_title)

        rows.append({
            'symbol': symbol.upper(),
            'action_type': code,
            'ex_date': ex_date,
            'record_date': _event_date(record.get('record_date')) if 'record_date' in columns else None,
            'payment_date': None,
            'cash_amount_per_share': parsed.cash_amount,
            'stock_ratio_pct': parsed.stock_ratio_pct,
            'currency': 'VND',
            'source': 'VCI',
            'source_event_id': source_id,
            'raw_title': raw_title,
            'parse_status': parsed.status,
            'is_latest': True,
            'fetched_at': timezone.now(),
            '_fallback_id': fallback,
        })
    return rows


def upsert_corporate_actions(symbol: str, rows: list[dict]) -> tuple[int, int]:
    """Upsert theo (source, source_event_id); provider rỗng ⇒ giữ nguyên dữ liệu cũ."""
    from market_data.models import CorporateAction

    created_count = 0
    updated_count = 0
    for row in rows:
        defaults = {key: value for key, value in row.items() if not key.startswith('_')}
        _, created = CorporateAction.objects.update_or_create(
            source=row['source'],
            source_event_id=row['source_event_id'],
            defaults=defaults,
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

        # Đường fallback: event cũ chưa parse được, event mới bổ sung số tiền cho cùng tiêu đề
        # ⇒ bản mới là correction, bản cũ không còn là bản ghi mới nhất.
        if row.get('_fallback_id') and row.get('cash_amount_per_share') is not None:
            for old in CorporateAction.objects.filter(
                symbol=row['symbol'],
                ex_date=row['ex_date'],
                action_type=row['action_type'],
                cash_amount_per_share__isnull=True,
            ).exclude(source_event_id=row['source_event_id']):
                if row.get('raw_title', '').startswith(old.raw_title):
                    old.is_latest = False
                    old.save(update_fields=['is_latest'])
                    logger.warning('FALLBACK_ID_COLLISION supersede old id=%s', old.source_event_id)
    return created_count, updated_count
