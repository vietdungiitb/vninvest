"""Fetch XLSX lịch sử giá CafeF (request MM/DD/YYYY). Không ghi DB."""
from datetime import date
from urllib.parse import urlencode

import requests

BASE_URL = 'https://cafef.vn/du-lieu/Ajax/PageNew/DataHistory/PriceHistoryExport.ashx'
HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://cafef.vn/Lich-su-giao-dich-TPB-1.chn',
}


def build_export_url(exchange: str, start: date, end: date, symbol: str = 'ALL') -> str:
    params = {
        'ExchangeType': exchange,
        'Symbol': symbol,
        'StartDate': start.strftime('%m/%d/%Y'),
        'EndDate': end.strftime('%m/%d/%Y'),
    }
    return f'{BASE_URL}?{urlencode(params)}'


def resolve_end(year: int, today: date | None = None) -> date:
    """CafeF trả 503 cho EndDate trong tương lai — clamp về hôm nay."""
    today = today or date.today()
    return min(date(year, 12, 31), today)


def fetch_xlsx(exchange: str, year: int, symbol: str = 'ALL', timeout: int = 45) -> bytes:
    url = build_export_url(exchange, date(year, 1, 1), resolve_end(year), symbol)
    response = requests.get(url, timeout=timeout, headers=HEADERS)
    response.raise_for_status()
    content = response.content
    if not content.startswith(b'PK'):
        raise ValueError(f'CafeF export is not an XLSX for {exchange}/{year}/{symbol}')
    return content
