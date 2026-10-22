"""R2.7 - bang gia token va snapshot tai thoi diem ghi.

Mot noi duy nhat doc gia: `resolve_cost` / `pricing_snapshot`. Tinh tien tai
`tasks._write_advisory_usage_record` va copy gia tri da tinh vao `AIUsageRecord.cost`
=> doi gia sau KHONG sua record da luu (AC3).

Nguyen tac khong bia (AC1/AC6):
- Khong co dong gia  -> `(Decimal('0'), False)`. Khong bao `$0.00` nhu that.
- `copilot`         -> tinh theo han muc subscription, KHONG theo token cua ban
                      => `(Decimal('0'), False)` + nhan rieng, bat ke co dong gia.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.utils import timezone

from advisory.models import AICostRate

logger = logging.getLogger(__name__)

#: Provider tinh theo han muc subscription, khong theo token.
#: AC6 - dung chuoi nay de UI hien "dang dung han muc ... cua ban" thay vi `$`.
PRICING_PROVIDER_TIERED = {
    'copilot': 'Đang dùng hạn mức Copilot của bạn (giá theo gói, không tính theo token)',
}

COST_QUANT = Decimal('0.000001')


def _to_decimal(raw, default=Decimal('0')) -> Decimal:
    """Decimal hop le hoac `default`. Không bao giờ ném, không bao giờ bịa."""
    if raw is None or isinstance(raw, bool):
        return default
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError, TypeError):
        return default


def _tokens(raw) -> int:
    try:
        value = int(raw or 0)
    except (TypeError, ValueError):
        return 0
    # Token am la du lieu hong - ghi 0 chu khong tao "giam gia am" (credit).
    return max(value, 0)


def is_tiered_provider(provider: str) -> bool:
    return (provider or '').strip().lower() in PRICING_PROVIDER_TIERED


def latest_rate(provider: str, model: str):
    """Dong gia con hieu luc tai thoi diem hien tai, hoac None."""
    provider = (provider or '').strip()
    model = (model or '').strip()
    if not provider or not model:
        return None
    try:
        return (
            AICostRate.objects.filter(
                provider__iexact=provider,
                model__iexact=model,
                effective_from__lte=timezone.now(),
            )
            .order_by('-effective_from', '-id')
            .first()
        )
    except Exception:
        # Bang gia khong doc duoc (chua migrate / DB het) -> coi nhu chua co gia.
        # Khong lam hong task ghi usage.
        logger.warning('AICostRate doc that bai - coi nhu chua co bang gia', exc_info=True)
        return None


def pricing_snapshot(provider: str, model: str, tokens_in: int, tokens_out: int) -> dict:
    """Tra snapshot gia tai thoi diem goi (AC3).

    Khu vuc luon cung cap cho moi provider de UI hien thoi diem + nguon gia (AC4).
    """
    provider_key = (provider or '').strip()
    result = {
        'cost': Decimal('0.000000'),
        'pricing_available': False,
        'source': AICostRate.PricingSourceChoices.MANUAL,
        'effective_from': None,
        'rate_id': None,
        'tiered': is_tiered_provider(provider_key),
    }
    if result['tiered']:
        # AC6: khong bao gio gia tien theo token cho provider han muc.
        result['source'] = AICostRate.PricingSourceChoices.COPILOT_TIER
        return result

    rate = latest_rate(provider_key, model)
    if rate is None:
        return result
    tin, tout = _tokens(tokens_in), _tokens(tokens_out)
    cost = (
        _to_decimal(rate.usd_per_1k_input) * tin
        + _to_decimal(rate.usd_per_1k_output) * tout
    ) / Decimal('1000')
    result.update(
        cost=cost.quantize(COST_QUANT, rounding=ROUND_HALF_UP),
        pricing_available=True,
        source=rate.pricing_source,
        effective_from=rate.effective_from,
        rate_id=rate.id,
    )
    return result


def resolve_cost(provider: str, model: str, tokens_total: int, tokens_in=None, tokens_out=None) -> tuple:
    """`(cost, pricing_available)` - tuong thich 2 chu so (ke goi R0.7).

    Cho phep tach input/output (giong bang gia). `tokens_total` chi dung khi
    khong truyen `tokens_in`/`tokens_out`.
    """
    if tokens_in is None and tokens_out is None:
        total = _tokens(tokens_total)
        tokens_in, tokens_out = total, 0
    snapshot = pricing_snapshot(provider, model, tokens_in, tokens_out)
    return snapshot['cost'], snapshot['pricing_available']


def format_cost_for_display(
    provider: str, model: str, tokens_in: int, tokens_out: int, pricing_available: bool
) -> str:
    """Chuoi hien thi cho FE (AC1/AC6) - khong bao gio '$0.00' nhu that."""
    if is_tiered_provider(provider):
        return PRICING_PROVIDER_TIERED[(provider or '').strip().lower()]
    if not pricing_available:
        return 'chưa có bảng giá cho mô hình này'
    cost, _ = resolve_cost(provider, model, 0, tokens_in=tokens_in, tokens_out=tokens_out)
    return f'${cost.quantize(COST_QUANT, rounding=ROUND_HALF_UP)}'


def _row_to_kwargs(row: dict) -> dict:
    """Chuan hoa 1 dong JSON. Nem ValueError neu thieu truong bat buoc."""
    provider = str(row.get('provider') or '').strip()
    model = str(row.get('model') or '').strip()
    if not provider or not model:
        raise ValueError('thieu provider/model')
    raw_from = str(row.get('effective_from') or '').strip()
    if not raw_from:
        raise ValueError('thieu effective_from')
    try:
        from django.utils.dateparse import parse_datetime

        effective_from = parse_datetime(raw_from)
        if effective_from is None:
            raise ValueError
    except ValueError:
        raise ValueError(f'effective_from khong hop le: {raw_from!r}')
    if timezone.is_naive(effective_from):
        effective_from = timezone.make_aware(effective_from, timezone.UTC)
    source = str(row.get('pricing_source') or AICostRate.PricingSourceChoices.MANUAL).strip()
    if source not in AICostRate.PricingSourceChoices.values:
        raise ValueError(f'pricing_source khong hop le: {source!r}')
    return {
        'provider': provider[:32],
        'model': model[:64],
        'usd_per_1k_input': _to_decimal(row.get('usd_per_1k_input')),
        'usd_per_1k_output': _to_decimal(row.get('usd_per_1k_output')),
        'effective_from': effective_from,
        'pricing_source': source,
    }


def import_pricing_file(path: str) -> dict:
    """AC5 - import tu file JSON, idempotent.

    `update_or_create` theo `(provider, model, effective_from)` nen chay lai
    khong tao dong trung. Dong **da ton tai** khong bi ghi de (bao `skipped`)
    vi bao cao da snapshot gia cua no - doi gia la thay doi lich su, phai co
    `effective_from` moi (AC3).
    """
    with open(path, 'r', encoding='utf-8') as handle:
        payload = json.load(handle)
    if isinstance(payload, dict):
        payload = payload.get('rates') or payload.get('models') or []
    if not isinstance(payload, list):
        raise ValueError('file gia phai la JSON array, hoac object co key "rates"')

    stats = {'created': 0, 'updated': 0, 'skipped': 0, 'invalid': 0}
    for row in payload:
        try:
            kwargs = _row_to_kwargs(row)
        except ValueError as exc:
            stats['invalid'] += 1
            logger.warning('dong gia khong hop le bi bo qua: %s (%s)', exc, row)
            continue
        _, created = AICostRate.objects.get_or_create(
            provider=kwargs['provider'],
            model=kwargs['model'],
            effective_from=kwargs['effective_from'],
            defaults={
                'usd_per_1k_input': kwargs['usd_per_1k_input'],
                'usd_per_1k_output': kwargs['usd_per_1k_output'],
                'pricing_source': kwargs['pricing_source'],
            },
        )
        stats['created' if created else 'skipped'] += 1
    logger.info('import_pricing_file %s: %s', path, stats)
    return stats