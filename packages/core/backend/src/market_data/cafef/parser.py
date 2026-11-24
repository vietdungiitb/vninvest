"""Parse XLSX CafeF sang dict chuẩn hoá; bỏ dòng không parse được kèm lý do."""
import io

import pandas as pd

from .contract import normalize_row


def parse_xlsx_rows(payload: bytes, with_rejected: bool = False):
    frame = pd.read_excel(io.BytesIO(payload), engine='openpyxl', dtype=str).dropna(how='all')
    rows = []
    rejected = []
    for record in frame.to_dict('records'):
        try:
            rows.append(normalize_row(record.get('Mã', ''), record))
        except (ValueError, KeyError, TypeError) as exc:
            rejected.append({'raw': record, 'reason': str(exc)})
    return (rows, rejected) if with_rejected else rows
