"""
LED-03 — NAV engine.

Vì sao cần module này: `ledger/holdings.py` tính được vị thế (số lượng, giá vốn,
P&L), nhưng **NAV** là một câu hỏi khác — "tôi có bao nhiêu tiền hôm nay" — và
nó cần thứ mà holdings không có: một số dư mở đầu.

`nav: null` trong `holdings.py` không phải lỗi kỹ thuật. Nó là **câu trả lời
đúng**: không có `opening_balance` thì mọi con số tiền mặt đều lệch đúng một
hằng số bằng số dư tài khoản lúc bắt đầu ghi — mà hằng số đó không ai biết.
Trả 0 sẽ tệ hơn trả null: 0 là một con số người dùng sẽ tin.

Công thức (LED-03 R2), ghi ở đây và test lại bằng 3 case tính tay:

    cash = opening_balance + Σ CashFlow.amount
    nav  = stock_value + cash - debt

`CashFlow.amount` có dấu (dương = vào, âm = ra), xem `models.CashFlow`.

Quy tắc bất di bất dịch của wave này — **không trả 0 giả**:
thiếu `opening_balance` ⇒ `nav = None` + `nav_reason` khác rỗng.
"""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

#: Đổi khi ngữ nghĩa thuật toán NAV đổi. Nằm trong `ValuationSnapshot` và trong
#: `meta.calculation_version` để con số trả về luôn truy vết được bằng quy tắc nào.
CALCULATION_VERSION = 'nav-wa-v1'

MONEY_EXP = Decimal('0.01')
MONEY_ROUNDING = ROUND_HALF_UP

#: Lý do NAV = null. Giá trị này đi thẳng ra API nên phải ổn định — đổi nó là
#: đổi contract.
NAV_REASON_NO_OPENING_BALANCE = 'no_opening_balance'
NAV_REASON_NO_POSITIONS = 'no_positions'

NAV_REASON_TEXT = {
    NAV_REASON_NO_OPENING_BALANCE: (
        'Chưa có số dư tiền mặt mở đầu. NAV cần biết số dư tài khoản trước khi hệ '
        'thống bắt đầu ghi sổ; đặt số dư mở đầu cho danh mục thì NAV mới tính được.'
    ),
    NAV_REASON_NO_POSITIONS: 'Chưa có vị thế nào để định giá.',
}


def money(value):
    """Lượng tiền báo cáo: Decimal 2 chữ số, ROUND_HALF_UP."""
    if value is None:
        return None
    return Decimal(value).quantize(MONEY_EXP, rounding=MONEY_ROUNDING)


def to_decimal(value, default=Decimal('0')):
    if value is None:
        return default
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default


def sum_cash_flows(cash_flows) -> Decimal:
    """Tổng dòng tiền có dấu.

    `cash_flows` là iterable các object có `.amount`. Dùng generator được vì
    queryset của Django lười — vòng lặp bên dưới chỉ chạy một lần.
    """
    total = Decimal('0')
    for flow in cash_flows:
        total += to_decimal(getattr(flow, 'amount', None))
    return total


def compute_nav(*, stock_value, cash_flow_total, opening_balance, debt=Decimal('0'),
                currency='VND', calculation_version=CALCULATION_VERSION):
    """Tính NAV theo LED-03 R2. Trả dict, không raise.

    Tham số:
    - `stock_value`: tổng giá trị thị trường của các vị thế đang mở.
    - `cash_flow_total`: đã gọi qua `sum_cash_flows()`.
    - `opening_balance`: `Portfolio.opening_balance`. **None nghĩa là chưa biết.**
    - `debt`: 0 với cash account. Margin defer sang LIV-03 (LED-03 PB3).

    Trả về `nav=None` + `nav_reason` khi thiếu dữ liệu, theo LED-03 R5.
    """
    stock = to_decimal(stock_value)
    flows = to_decimal(cash_flow_total)
    owed = to_decimal(debt)

    if opening_balance is None:
        # R5: KHÔNG bịa. Số 0 ở đây là một lời nói dối người dùng.
        return {
            'nav': None,
            'nav_reason': NAV_REASON_NO_OPENING_BALANCE,
            'nav_reason_text': NAV_REASON_TEXT[NAV_REASON_NO_OPENING_BALANCE],
            'cash': None,
            'stock_value': money(stock),
            'debt': money(owed),
            'opening_balance': None,
            'currency': currency,
            'calculation_version': calculation_version,
        }

    opening = to_decimal(opening_balance)
    cash = opening + flows
    nav = stock + cash - owed

    return {
        'nav': money(nav),
        'nav_reason': '',
        'nav_reason_text': '',
        'cash': money(cash),
        'stock_value': money(stock),
        'debt': money(owed),
        'opening_balance': money(opening),
        'currency': currency,
        'calculation_version': calculation_version,
    }
