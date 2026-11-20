"""Parse số tiền cổ tức / tỉ lệ cổ phiếu từ event_title_vi của VCI (plan B)."""
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Literal

CASH_RE = re.compile(r'(?P<amount>\d[\d.,]*)\s*VND', re.IGNORECASE)
PERCENT_RE = re.compile(r'(?P<ratio>\d[\d.,]*)\s*%')

ParseStatus = Literal['structured', 'parsed_from_text', 'unparsed']


@dataclass(frozen=True)
class ParsedAmount:
    cash_amount: Decimal | None = None
    stock_ratio_pct: Decimal | None = None
    status: ParseStatus = 'unparsed'
    ambiguous_cash_pct: bool = False


def _normalize_number(raw: str) -> Decimal:
    """Chuyển '1,500' / '2.000' / '1,234.56' sang Decimal, không dùng float."""
    value = raw.strip()
    if ',' in value and '.' in value:
        decimal_sep = ',' if value.rfind(',') > value.rfind('.') else '.'
        thousand_sep = '.' if decimal_sep == ',' else ','
        value = value.replace(thousand_sep, '').replace(decimal_sep, '.')
    elif ',' in value or '.' in value:
        sep = ',' if ',' in value else '.'
        parts = value.split(sep)
        if len(parts) == 2 and len(parts[1]) == 3:
            value = parts[0] + parts[1]
        elif len(parts) > 2:
            value = ''.join(parts)
        else:
            value = value.replace(sep, '.')
    try:
        return Decimal(value)
    except InvalidOperation:
        return Decimal('0')


def parse_event_title(title: str, action_type: str) -> ParsedAmount:
    """Trích số tiền/tỉ lệ từ tiêu đề sự kiện. Không bao giờ suy diễn khi thiếu."""
    if not title:
        return ParsedAmount()

    cash_match = CASH_RE.search(title)
    pct_match = PERCENT_RE.search(title)
    cash = _normalize_number(cash_match.group('amount')) if cash_match else None
    ratio = _normalize_number(pct_match.group('ratio')) if pct_match else None

    # Cổ tức tính theo % trên mệnh giá KHÔNG phải cổ phiếu thưởng — không được gán nhầm.
    if action_type == 'DIV' and pct_match and cash is None:
        return ParsedAmount(status='unparsed', ambiguous_cash_pct=True)

    if cash is None and ratio is None:
        return ParsedAmount()

    return ParsedAmount(
        cash_amount=cash,
        stock_ratio_pct=ratio,
        status='parsed_from_text',
    )
