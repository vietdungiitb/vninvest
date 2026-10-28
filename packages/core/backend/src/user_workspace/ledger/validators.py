"""
LED-04 — validator tài chính.

Nguyên tắc: **từ chối dữ liệu sai, không sửa dữ liệu sai.** Bản cũ clamp
oversell bằng `min()` (xem `holdings.py` lịch sử) nên một lệnh bán 2000 khi chỉ
giữ 1000 trở thành lệnh bán 1000 "thành công" — người dùng tin là đã bán hết
nhưng thực tế còn hàng. Với dữ liệu tài chính, im lặng sửa là cái chết âm thầm
tệ nhất.

Vì vậy validator ở đây **chỉ sinh hai loại kết quả**:

1. `errors[]` → API trả `422` kèm `field` cụ thể (AC5). Dùng cho cái mà chính
   người gõ có thể sửa ngay: giá 0, số lượng 0, phí âm, lô không hợp lệ.
2. `warnings[]` → vẫn ghi, nhưng gắn `reconciliation_required=True`. Dùng cho
   cái mà hệ thống không được tự ý quyết: bán vượt số đang giữ.

Ranh giới: validator này **không** truy vấn DB. Nó nhận sẵn `held_quantity`
từ tầng trên. Nhờ vậy chạy được không cần database — giống `holdings.py`.
"""
from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError

#: Khớp `VN_SPOT_RULES.lotSize` của widget (`vninvestcharts-widget`).
#: Không hardcode 100 ở nhiều nơi — nếu widget đổi, chỗ này là nơi đổi.
VN_SPOT_LOT_SIZE = 100

#: Mã bắt đầu bằng chữ này trên UPCoM. Không dùng để suy ra thị trường (xem
#: `LedgerEntry.market`) — chỉ để gợi ý khi `market` chưa được khai báo.
UPCOM_PREFIX = 'UPCOM'


class MarketRules:
    """Luật lô theo thị trường.

    `UNKNOWN` cố ý **không** áp luật lô 100: một danh mục nhập tay mà chưa khai
    báo thị trường thì từ chối vì lô là hành vi chặn hàng thật. Khi đó ta cảnh
    báo `market_unknown` để người dùng khai báo, thay vì âm thầm cho qua (sai)
    hoặc từ chối (chặn oan). D-35 xử lý đúng ở tầng UI: chặn crypto trước khi
    nó lọt vào đây.
    """

    __slots__ = ('enforce_lot', 'lot_size')

    def __init__(self, lot_size=None, enforce_lot=False):
        self.lot_size = lot_size
        self.enforce_lot = enforce_lot

    def lot_error(self, quantity):
        return (
            self.lot_size is not None
            and self.enforce_lot
            and quantity is not None
            and quantity > 0
            and Decimal(quantity) % Decimal(self.lot_size) != 0
        )


MARKET_RULES = {
    'VN_SPOT': MarketRules(lot_size=VN_SPOT_LOT_SIZE, enforce_lot=True),
    'VN_FLOOR': MarketRules(lot_size=1, enforce_lot=False),
    'FOREIGN': MarketRules(lot_size=1, enforce_lot=False),
    'CRYPTO': MarketRules(lot_size=1, enforce_lot=False),
    'UNKNOWN': MarketRules(lot_size=None, enforce_lot=False),
}

_TRADE_TYPES = ('BUY', 'SELL')
_CASH_TYPES = ('DIVIDEND', 'FEE', 'TAX', 'DEPOSIT', 'WITHDRAWAL', 'INTEREST')


def rules_for_market(market):
    return MARKET_RULES.get((market or 'UNKNOWN').upper(), MARKET_RULES['UNKNOWN'])


def _dec(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return None


def _error(field, code, message, **detail):
    item = {'field': field, 'code': code, 'message': message}
    if detail:
        item['detail'] = detail
    return item


def _warning(code, message, **detail):
    item = {'code': code, 'message': message}
    if detail:
        item['detail'] = detail
    return item


def validate_entry(*, entry_type, symbol, quantity, price, fee=None, tax=None,
                   market='UNKNOWN', held_quantity=None, source='manual'):
    """Kiểm tra một dòng sổ cái. Trả dict kết quả, không raise.

    Không raise vì lý do thực tế: cùng một hàm phải phục vụ hai lớp khác nhau —
    serializer (trả 422 về HTTP) và import/batch (gộp lỗi để báo một lần). Raise
    ở đây sẽ khiến tầng trên phải bắt lại, và bắt sai là mất cảnh báo.

    Trả về:
        {'errors': [...], 'warnings': [...], 'reconciliation_required': bool, 'ok': bool}
    """
    errors = []
    warnings = []
    reconciliation_required = False

    entry_type = (entry_type or '').upper()
    market = (market or 'UNKNOWN').upper()
    qty = _dec(quantity)
    px = _dec(price)
    fee_v = _dec(fee)
    tax_v = _dec(tax)

    if not entry_type:
        errors.append(_error('entry_type', 'entry_type_required', 'Thiếu loại dòng sổ cái.'))
    elif entry_type not in _TRADE_TYPES and entry_type not in _CASH_TYPES \
            and entry_type not in ('SPLIT', 'BONUS', 'ADJUSTMENT'):
        errors.append(_error(
            'entry_type', 'unknown_entry_type',
            f'Loại dòng không hợp lệ: {entry_type!r}.',
            allowed=list(_TRADE_TYPES) + list(_CASH_TYPES)
                      + ['SPLIT', 'BONUS', 'ADJUSTMENT'],
        ))

    if not (symbol or '').strip():
        # LED-04 PB2 của LED-01: symbol rỗng thì dòng đó không truy vết được.
        errors.append(_error('symbol', 'symbol_required', 'Thiếu mã cổ phiếu.'))

    # ── số lượng ────────────────────────────────────────────────────────
    if qty is None:
        errors.append(_error('quantity', 'quantity_not_a_number',
                             'Số lượng không phải là số.'))
    elif qty != qty.to_integral_value():
        # `LedgerEntry.quantity` là BigIntegerField. Số lượng phân số sẽ bị DB
        # từ chối hoặc bị làm tròn tùy backend — hai hành vi khác nhau cho cùng
        # một payload, và cả hai đều là lỗi. Bắt ở đây để lỗi có `field` và
        # trả 422 thay vì 500 từ tầng DB.
        errors.append(_error('quantity', 'quantity_not_integer',
                             'Số lượng phải là số nguyên.', value=str(qty)))
    elif qty < 0:
        errors.append(_error('quantity', 'quantity_negative',
                             'Số lượng không được âm.', value=str(qty)))
    elif entry_type in _TRADE_TYPES and qty == 0:
        errors.append(_error('quantity', 'quantity_zero',
                             'Số lượng phải > 0 với dòng MUA/BÁN.', value='0'))
    elif entry_type == 'DIVIDEND' and qty == 0:
        # Xem giải thích trong `models.LedgerEntry.clean()`: tài liệu slice ghi
        # "DIVIDEND ⇒ quantity = 0" nhưng D-06 và `holdings.py` dùng quantity là
        # số cổ phiếu nhận cổ tức. Số 0 ở đây là dữ liệu vô nghĩa.
        errors.append(_error('quantity', 'dividend_quantity_zero',
                             'Dòng cổ tức cần số cổ phiếu được trả cổ tức (> 0).',
                             value='0'))

    # ── giá ─────────────────────────────────────────────────────────────
    if px is None:
        errors.append(_error('price', 'price_not_a_number', 'Giá không phải là số.'))
    elif px < 0:
        errors.append(_error('price', 'price_negative', 'Giá không được âm.', value=str(px)))
    elif entry_type in _TRADE_TYPES and px == 0:
        errors.append(_error('price', 'price_zero',
                             'Giá phải > 0 với dòng MUA/BÁN.', value='0'))

    # ── phí / thuế ──────────────────────────────────────────────────────
    for field, value in (('fee', fee_v), ('tax', tax_v)):
        if value is None:
            continue
        if value < 0:
            errors.append(_error(field, f'{field}_negative',
                                 f'{field} không được âm.', value=str(value)))

    # ── luật lô ─────────────────────────────────────────────────────────
    rules = rules_for_market(market)
    if entry_type in _TRADE_TYPES and rules.lot_error(qty):
        errors.append(_error(
            'quantity', 'lot_size_violation',
            f'Số lượng phải là bội số của {rules.lot_size} '
            f'(quy định lô của {market}).',
            value=str(qty), lot_size=rules.lot_size, market=market,
        ))
    elif entry_type in _TRADE_TYPES and market == 'UNKNOWN' and qty is not None and qty > 0:
        warnings.append(_warning(
            'market_unknown',
            'Chưa khai báo thị trường nên không kiểm được quy định lô.',
            quantity=str(qty),
        ))

    # ── oversell: KHÔNG clamp (LED-04 R4) ───────────────────────────────
    if entry_type == 'SELL' and held_quantity is not None and qty is not None:
        held = _dec(held_quantity) or Decimal('0')
        if qty > held:
            reconciliation_required = True
            warnings.append(_warning(
                'oversell',
                'Bán vượt số lượng đang giữ. Dòng vẫn được ghi để đối soát với '
                'broker, nhưng phần vượt không được tính vào P&L.',
                requested_quantity=str(qty),
                held_quantity=str(held),
                excess_quantity=str(qty - held),
            ))

    return {
        'ok': not errors,
        'errors': errors,
        'warnings': warnings,
        'reconciliation_required': reconciliation_required,
    }


def as_drf_validation_error(result):
    """Chuyển `errors[]` sang lỗi DRF để API trả 422 kèm đúng `field` (AC5)."""
    if not result['errors']:
        return None
    field_map = {}
    for item in result['errors']:
        field = item.get('field') or 'non_field_errors'
        field_map.setdefault(field, []).append(item['message'])
    raise ValidationError(field_map)
