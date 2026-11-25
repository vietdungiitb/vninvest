"""M4 — lập kế hoạch persist (pure logic). KHÔNG ghi DB ở module này.

Map dòng CafeF sang giá trị DailyPrice đích; xử lý 3 trường hợp:
matched (update) / db-only (keep + reset adj_close) / cafef-only (insert).
"""
from decimal import Decimal

_Q10 = Decimal('0.0000000001')

FIELDS = ('close', 'adj_close', 'open', 'high', 'low', 'volume', 'value',
          'change_pct', 'adj_factor', 'price_source')


def _to_decimal(value):
    if value is None:
        return None
    return Decimal(str(value)).quantize(Decimal('0.01'))


def classify_row(old: dict | None, new: dict | None, source: str = 'cafef') -> dict:
    """Trả plan cho 1 cặp (symbol,date). `old` = DailyPrice, `new` = CafefDailyPrice."""
    if old is not None and new is not None:
        close = _to_decimal(new['close_raw'])
        adj = _to_decimal(new['close_adjusted'])
        factor = None
        if close and close != 0 and adj is not None:
            factor = (adj / close).quantize(_Q10)
        return {
            'action': 'update',
            'close_new': close,
            'adj_close_new': adj,
            'open_new': _to_decimal(new.get('open_raw', close)),
            'high_new': _to_decimal(new.get('high_raw', close)),
            'low_new': _to_decimal(new.get('low_raw', close)),
            'volume_new': int(new.get('volume') or 0),
            'value_new': int(new.get('value') or 0) or None,
            'change_pct_new': new.get('change_pct'),
            'adj_factor': factor,
            'price_source': source,
        }

    if old is not None and new is None:
        # DB-only: giữ close thô cũ, dọn adj_close sai (double-adjust),
        # đánh dấu để nightly guard (M3) mở rộng sau.
        return {
            'action': 'keep_unmapped',
            'close_new': old.get('close'),
            'adj_close_new': None,
            'price_source': 'unmapped_cafef',
        }

    # CafeF-only: INSERT dòng mới.
    close = _to_decimal(new['close_raw'])
    adj = _to_decimal(new['close_adjusted'])
    factor = None
    if close and close != 0 and adj is not None:
        factor = (adj / close).quantize(_Q10)
    return {
        'action': 'insert',
        'symbol': new['symbol'],
        'date': new['date'],
        'close_new': close,
        'adj_close_new': adj,
        'open_new': _to_decimal(new.get('open_raw', close)),
        'high_new': _to_decimal(new.get('high_raw', close)),
        'low_new': _to_decimal(new.get('low_raw', close)),
        'volume_new': int(new.get('volume') or 0),
        'value_new': int(new.get('value') or 0) or None,
        'change_pct_new': new.get('change_pct'),
        'adj_factor': factor,
        'price_source': source,
    }


def build_migration_plan(exchange: str, year: int, matched: dict,
                         db_only: dict, cafef_only: dict) -> dict:
    """Tổng hợp số lượng + danh sách key INSERT (dùng rollback ở S6)."""
    return {
        'exchange': exchange,
        'year': year,
        'matched_count': len(matched),
        'update_count': len(matched),
        'keep_unmapped_count': len(db_only),
        'insert_count': len(cafef_only),
        'inserted_keys': sorted(f'{s}:{d.isoformat()}' for s, d in cafef_only),
    }
