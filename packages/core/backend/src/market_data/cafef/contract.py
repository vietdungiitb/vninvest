"""Contract cột/đơn vị/format ngày của export CafeF PriceHistory.

Request dùng MM/DD/YYYY; response XLSX dùng DD/MM/YYYY — KHÔNG trộn hai format.
Nguồn đối chiếu, KHÔNG ghi vào DailyPrice.
"""
import re
from datetime import datetime
from decimal import Decimal

CAFEF_COLUMNS = (
    'Mã',
    'Ngày',
    'Giá đóng cửa',
    'Giá điều chỉnh',
    'Thay đổi',
    'Khối lượng khớp lệnh',
    'Giá trị khớp lệnh',
    'Khối lượng thỏa thuận',
    'Giá trị thỏa thuận',
    'Giá mở cửa',
    'Giá cao nhất',
    'Giá thấp nhất',
)

REQUEST_DATE_RE = re.compile(r'^\d{2}/\d{2}/\d{4}$')
RESPONSE_DATE_RE = re.compile(r'^\d{2}/\d{2}/\d{4}$')
REQUEST_DATE_FORMAT = '%m/%d/%Y'
RESPONSE_DATE_FORMAT = '%d/%m/%Y'
EXCHANGES = ('HOSE', 'HNX', 'UPCOM')

_VND = Decimal('1000')
_TY = Decimal('1000000000')
_Q2 = Decimal('0.01')


def parse_request_date(raw: str):
    """Ngày gửi cho CafeF: MM/DD/YYYY. '31/12/2022' phải bị reject."""
    if not isinstance(raw, str) or not REQUEST_DATE_RE.fullmatch(raw):
        raise ValueError(f'Invalid CafeF request date: {raw!r}')
    return datetime.strptime(raw, REQUEST_DATE_FORMAT).date()


def parse_response_date(raw: str):
    """Ngày trong XLSX CafeF: DD/MM/YYYY. '12/30/2022' phải bị reject."""
    if not isinstance(raw, str) or not RESPONSE_DATE_RE.fullmatch(raw):
        raise ValueError(f'Invalid CafeF response date: {raw!r}')
    return datetime.strptime(raw, RESPONSE_DATE_FORMAT).date()


def _to_vnd(value) -> Decimal:
    return (Decimal(str(value)) * _VND).quantize(_Q2)


_PCT_RE = re.compile(r'\(([-+]?\d[\d.,]*)\s*%\)')


def _to_change_pct(value) -> float | None:
    """Từ '+1,65 (+4,01%)' → 4.01 (phần trong ngoặc, dấu phẩy thập phân)."""
    if value is None:
        return None
    match = _PCT_RE.search(str(value))
    if not match:
        return None
    return float(match.group(1).replace(',', '.'))


def normalize_row(symbol: str, row: dict) -> dict:
    """Map 1 dòng XLSX sang dict chuẩn hoá; bỏ 2 cột thỏa thuận."""
    return {
        'symbol': str(symbol).strip().upper(),
        'date': parse_response_date(row['Ngày']),
        'close_raw': _to_vnd(row['Giá đóng cửa']),
        'close_adjusted': _to_vnd(row['Giá điều chỉnh']),
        'open_raw': _to_vnd(row['Giá mở cửa']),
        'high_raw': _to_vnd(row['Giá cao nhất']),
        'low_raw': _to_vnd(row['Giá thấp nhất']),
        'volume': int(row['Khối lượng khớp lệnh']),
        'value': int((Decimal(str(row['Giá trị khớp lệnh'])) * _TY).to_integral_value()),
        'change_pct': _to_change_pct(row.get('Thay đổi')),
        'source': 'cafef',
    }
