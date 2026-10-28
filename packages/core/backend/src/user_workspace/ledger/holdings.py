"""
PA-2 / P0-DATA-03 — thuật toán sổ cái cho danh mục (thuần, không DB).

Quyết định sản phẩm D-06 đã chốt tại
`docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md:107`:

- cost method = **weighted average**
- **cổ tức là cash flow**, KHÔNG giảm cost basis
- **phí + thuế BUY vốn vào cost basis**
- **phí + thuế SELL trừ khỏi realized P&L và cash**

Những lỗi cụ thể của `_compute_holdings` cũ
(`portfolio_analytics_views.py:30-61` @ trước PA-2) mà module này sửa:

| Sai lầm cũ | Vị trí | Cách sửa ở đây |
|---|---|---|
| DIVIDEND bị loại khỏi queryset nên không tăng holdings, không tăng tiền mặt, không vào cost basis — im lặng | `:38` | DIVIDEND là cash flow: `cash += price*quantity - fee - tax`, **không** đụng `quantity`/`avg_cost`/`total_cost` |
| BUY cộng `fee` vào cost basis nhưng **không** cộng `tax` | `:50` | `cost_in = price*qty + fee + tax` |
| SELL **không** trừ `fee`/`tax` (grep thân hàm: `t.tax` 0 lần) | `:53-59` | `realized = proceeds - avg_cost*qty - fee - tax`; `cash += proceeds - fee - tax` |
| Oversell clamp im lặng bằng `min()` / `max(0, …)`; SELL khi `quantity == 0` bị bỏ hoàn toàn, không exception, không log | `:54,57` | phát hiện, ghi `warnings[]` có cấu trúc + `reconciliation_required`, giữ phần bán được, **không** giả vờ phần vượt đã thành công |
| Hết hàng thì `total_cost = Decimal('0')` xoá cứng, mất realized P&L; cả helper lẫn 8 view không có khái niệm realized P&L | `:58-59` | `total_cost = 0` chỉ khi position đóng **và** realized P&L đã được ghi riêng vào `realized_by_symbol` + `realized_pnl` |
| dict chỉ có 3 key, không theo dõi tiền mặt ⇒ `PortfolioSummaryView` không có NAV tổng | `:45` | thêm `cash`, `realized_pnl`, `dividend_income`, `fees_paid`, `taxes_paid` |
| BUY với `quantity` âm/0: `if new_qty > 0` false ⇒ không cộng cost nhưng vẫn gán quantity | `:49,52` | mọi transaction có `quantity <= 0` đều bị từ chối + cảnh báo, **không** đụng cost basis |

Nguyên tắc: **không dùng số 0 giả.** Thiếu dữ liệu ⇒ `None` kèm lý do
(`*_reason`). Ví dụ `unrealized_pnl = None` vì cần giá market — thuật toán này
không query giá.
"""

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

# Đổi khi ngữ nghĩa thuật toán đổi — response trả kèm để truy vết được số liệu
# đã tính bằng quy tắc nào (audit P1-DATA-03 + §H3 `calculation_version`).
CALCULATION_VERSION = 'holdings-wa-v1'

# Tolerance tiền mặt chốt tại plan:638 (0.01 VND).
MONEY_EXP = Decimal('0.01')
MONEY_ROUNDING = ROUND_HALF_UP

# Quá hạn bao nhiêu ngày thì coi là snapshot sổ cái là cũ.
STALE_AFTER_DAYS = 7

BUY = 'BUY'
SELL = 'SELL'
DIVIDEND = 'DIVIDEND'

# `cash` chỉ gom từ transaction. Model `Portfolio` không có trường số dư mở
# đầu, nên con số này KHÔNG phải số dư tài khoản — phải nói thẳng thay vì
# trả về một số trông giống số dư.
CASH_BASIS_NOTE = (
    'cash = tổng dòng tiền gom từ Transaction (mua - bán + cổ tức - phí - thuế). '
    'Không có trường số dư mở đầu trên model Portfolio nên đây KHÔNG phải số dư '
    'tài khoản; NAV chuẩn cần balance tài khoản từ broker.'
)

UNREALIZED_REASON = (
    'Cần giá market theo từng mã. Thuật toán này không query giá — giá được áp '
    'ở tầng view (SymbolSnapshot.session_date = today).'
)

NAV_REASON = (
    'Chưa tính được: cần số dư tiền mặt mở đầu từ broker và giá market cho mọi '
    'mã. Số 0 ở đây sẽ là số giả.'
)


def money(value):
    """Lượng tiền báo cáo: Decimal 2 chữ số, ROUND_HALF_UP."""
    if value is None:
        return None
    return Decimal(value).quantize(MONEY_EXP, rounding=MONEY_ROUNDING)


def _to_decimal(value):
    """Decimal an toàn cho dữ liệu DB lẫn dữ liệu fixture (str/int/float)."""
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal('0')


def _warning(code, message, **detail):
    item = {'code': code, 'message': message}
    if detail:
        item['detail'] = detail
    return item


def _blank_symbol():
    return {
        'quantity': Decimal('0'),
        'total_cost': Decimal('0'),
        'avg_cost': Decimal('0'),
        'realized_pnl': Decimal('0'),
        'buy_quantity': Decimal('0'),
        'sell_quantity': Decimal('0'),
        'dividend_cash': Decimal('0'),
        'fees': Decimal('0'),
        'taxes': Decimal('0'),
    }


def compute_ledger(transactions, *, today=None, tenant_public_id=None, portfolio_id=None):
    """Dựng sổ cái từ iterable transaction đã sắp theo `(date, pk)`.

    Trả về dict gồm `holdings` (position đang mở — tương thích shape cũ),
    `realized_by_symbol`, tiền mặt, P&L đã thực hiện, `warnings[]` và `meta`
    provenance. Mọi con số tiền đều là `Decimal`; view quyết định round khi
    serialize.

    `transactions` chỉ cần có: `id`, `symbol`, `transaction_type`, `date`,
    `price`, `quantity`, `fee`, `tax`, `external_id`. Nhờ vậy golden fixture
    chạy được không cần database.
    """
    warnings = []
    symbols = {}
    cash = Decimal('0')
    realized_total = Decimal('0')
    dividend_income = Decimal('0')
    fees_paid = Decimal('0')
    taxes_paid = Decimal('0')
    external_flow_seen = False
    manual_only_seen = False
    as_of = None
    last_pk = 0

    # Materialize một lần: queryset có `len()` nhưng generator thì không, và ta
    # cần `transaction_count` cho provenance.
    rows = list(transactions)

    for t in rows:
        symbol = str(t.symbol or '').strip().upper()
        pk = getattr(t, 'id', None)
        if isinstance(pk, int):
            last_pk = max(last_pk, pk)
        tx_date = getattr(t, 'date', None)
        if tx_date is not None and (as_of is None or tx_date > as_of):
            as_of = tx_date

        if getattr(t, 'external_id', ''):
            external_flow_seen = True
        else:
            manual_only_seen = True

        if not symbol:
            warnings.append(_warning(
                'missing_symbol',
                'Bỏ qua giao dịch không có mã.',
                transaction_id=pk,
                transaction_type=getattr(t, 'transaction_type', None),
            ))
            continue

        position = symbols.setdefault(symbol, _blank_symbol())
        kind = getattr(t, 'transaction_type', None)
        price = _to_decimal(getattr(t, 'price', None))
        qty = _to_decimal(getattr(t, 'quantity', None))
        fee = _to_decimal(getattr(t, 'fee', None))
        tax = _to_decimal(getattr(t, 'tax', None))

        # quantity <= 0 ⇒ dữ liệu sai, từ chối và BÁO. Không clamp, không
        # cộng/trừ cost basis (lỗi cũ ở `:49,52`).
        if qty <= 0:
            warnings.append(_warning(
                'non_positive_quantity',
                'Bỏ qua giao dịch có số lượng <= 0 để không hỏng cost basis.',
                transaction_id=pk,
                symbol=symbol,
                transaction_type=kind,
                quantity=str(qty),
            ))
            continue

        if kind == BUY:
            fees_paid += fee
            taxes_paid += tax
            cost_in = price * qty + fee + tax
            cash -= cost_in
            position['buy_quantity'] += qty
            position['fees'] += fee
            position['taxes'] += tax

            new_qty = position['quantity'] + qty
            if position['quantity'] <= 0:
                # Trước đó không có position (hoặc đã âm do oversell) ⇒ mở
                # position mới, không trộn basis của một position âm.
                if position['quantity'] < 0:
                    warnings.append(_warning(
                        'buy_into_negative_position',
                        'Mua vào position âm (do oversell trước đó): reset cost basis.',
                        transaction_id=pk,
                        symbol=symbol,
                        previous_quantity=str(position['quantity']),
                    ))
                position['quantity'] = new_qty
                position['total_cost'] = cost_in
                position['avg_cost'] = cost_in / new_qty
            else:
                position['total_cost'] += cost_in
                position['quantity'] = new_qty
                position['avg_cost'] = position['total_cost'] / new_qty
            continue

        if kind == SELL:
            fees_paid += fee
            taxes_paid += tax
            position['sell_quantity'] += qty
            position['fees'] += fee
            position['taxes'] += tax

            sellable = min(qty, position['quantity']) if position['quantity'] > 0 else Decimal('0')
            if position['quantity'] <= 0:
                # Lỗi cũ (`:54,57`) bỏ trọn SELL này, không log, không cảnh báo.
                # Không gọi tên là "oversell" vì đây không phải bán vượt — chưa có
                # position nào để bán.
                cash += price * qty - fee - tax
                warnings.append(_warning(
                    'sell_without_position',
                    'Bán khi không có position: chỉ ghi nhận dòng tiền, không tính '
                    'P&L (không có cost basis để trừ).',
                    transaction_id=pk,
                    symbol=symbol,
                    quantity=str(qty),
                ))
                continue

            if qty > sellable:
                # Oversell: KHÔNG clamp im lặng nữa. Phần bán được vẫn tính để
                # số liệu còn truy vết được, phần vượt được báo cáo và đẩy sang
                # reconciliation thay vì bị nuốt mất.
                warnings.append(_warning(
                    'oversell',
                    'Bán vượt số lượng đang giữ. Phần vượt không được ghi nhận '
                    'vào P&L; cần đối soát với broker.',
                    transaction_id=pk,
                    symbol=symbol,
                    requested_quantity=str(qty),
                    sellable_quantity=str(sellable),
                    position_quantity_before=str(position['quantity']),
                    excess_quantity=str(qty - sellable),
                ))
            if sellable <= 0:
                cash += price * qty - fee - tax
                continue

            cost_out = position['avg_cost'] * sellable
            proceeds = price * sellable
            charges = fee + tax
            realized = proceeds - cost_out - charges
            position['realized_pnl'] += realized
            realized_total += realized
            cash += proceeds - charges
            position['quantity'] -= sellable
            position['total_cost'] -= cost_out
            if position['quantity'] == 0:
                # Xoá cost basis khi position đóng là đúng, NHƯNG realized P&L
                # đã được ghi ở trên nên không mất nữa (khác lỗi cũ `:58-59`).
                position['total_cost'] = Decimal('0')
                position['avg_cost'] = Decimal('0')
            continue

        if kind == DIVIDEND:
            # D-06: cổ tức là cash flow, KHÔNG giảm cost basis, KHÔNG tăng
            # quantity. `price` = cổ tức mỗi cổ phiếu, `quantity` = số cổ
            # phiếu được trả cổ tức.
            gross = price * qty
            dividend_income += gross
            fees_paid += fee
            taxes_paid += tax
            cash += gross - fee - tax
            position['dividend_cash'] += gross - fee - tax
            position['fees'] += fee
            position['taxes'] += tax
            continue

        warnings.append(_warning(
            'unknown_transaction_type',
            'Bỏ qua giao dịch có loại không hợp lệ.',
            transaction_id=pk,
            symbol=symbol,
            transaction_type=kind,
        ))

    open_positions = {
        symbol: position
        for symbol, position in symbols.items()
        if position['quantity'] > 0
    }
    realized_by_symbol = {
        symbol: money(position['realized_pnl'])
        for symbol, position in sorted(symbols.items())
        if position['realized_pnl'] != 0
    }

    source = 'unknown'
    if external_flow_seen and manual_only_seen:
        source = 'broker_sync+manual'
    elif external_flow_seen:
        source = 'broker_sync'
    elif manual_only_seen:
        source = 'manual'

    return {
        'calculation_version': CALCULATION_VERSION,
        'holdings': open_positions,
        'realized_by_symbol': realized_by_symbol,
        'cash': cash,
        'cash_complete': False,
        'cash_note': CASH_BASIS_NOTE,
        'realized_pnl': realized_total,
        'unrealized_pnl': None,
        'unrealized_pnl_reason': UNREALIZED_REASON,
        'nav': None,
        'nav_reason': NAV_REASON,
        'dividend_income': dividend_income,
        'fees_paid': fees_paid,
        'taxes_paid': taxes_paid,
        'transaction_count': len(rows),
        'warnings': warnings,
        'reconciliation_required': any(
            w['code'] in {
                'oversell', 'sell_without_position', 'non_positive_quantity',
                'missing_symbol', 'unknown_transaction_type',
                'buy_into_negative_position',
            }
            for w in warnings
        ),
        'meta': {
            'tenant_id': tenant_public_id,
            'portfolio_id': portfolio_id,
            'as_of': as_of,
            'as_of_reason': None if as_of is not None else 'no_transactions',
            'source': source,
            'stale': _is_stale(as_of, today),
            'stale_reason': _stale_reason(as_of, today),
            'calculation_version': CALCULATION_VERSION,
            'cost_method': 'weighted_average',
            'transaction_count': len(rows),
            'max_transaction_id': last_pk or None,
        },
    }


def _is_stale(as_of, today):
    if as_of is None:
        return True
    if today is None:
        return False
    return (today - as_of).days > STALE_AFTER_DAYS


def _stale_reason(as_of, today):
    if as_of is None:
        return 'no_transactions'
    if today is None:
        return None
    age = (today - as_of).days
    if age > STALE_AFTER_DAYS:
        return f'newest_transaction_is_{age}_days_old'
    return None
