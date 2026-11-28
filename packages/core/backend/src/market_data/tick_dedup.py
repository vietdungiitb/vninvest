"""SSOT dedup_key cho IntradayTick — S3 / REQ-BE-M03 + G-2.

Provider DNSE/vnbroker KHONG co trade id (probe staging 2026-11-28: `HITS` chi
co `provider`/`side` trong DNSEQuote), nhung tape co do phan giai GIAY va co the
co 2-5 lenh lô lẻ khớp cùng giá trong cùng 1 giây. Hash phẳng se âm thầm drop
cac lenh that ⇒ hụt volume, vỡ I-2. Vi vay khoa gom `seq_in_key`: chi so lan xuat
hien cua tuple `(symbol,timestamp,price,volume,side,match_type,source)` trong
mot lan fetch day du/phiên (theo thu tu timestamp, on dinh khi retry).
"""
from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import datetime, timezone as dt_timezone
from decimal import Decimal
from typing import Any, Iterable


def _norm_datetime(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt_timezone.utc)
        return value.astimezone(dt_timezone.utc).isoformat()
    return str(value)


def _norm_price(value: Any) -> str:
    """Chuan hoa gia de key on dinh giua float (provider) va Decimal (DB)."""
    return format(Decimal(str(value or 0)).normalize(), 'f')


def build_dedup_key(
    *,
    symbol: str,
    timestamp: Any,
    price: Any,
    volume: Any,
    side: str,
    match_type: str,
    source: str,
    seq_in_key: int = 0,
) -> str:
    """Hash 64 ky tu, on dinh theo thu tu cac truong va so lan xuat hien."""
    parts = [
        str(symbol).strip().upper(),
        _norm_datetime(timestamp),
        _norm_price(price),
        str(int(volume or 0)),
        str(side).strip().upper(),
        str(match_type or ''),
        str(source or ''),
        str(int(seq_in_key)),
    ]
    return hashlib.sha256('|'.join(parts).encode('utf-8')).hexdigest()


def assign_dedup_keys(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gán `dedup_key` cho mỗi row, đánh số `seq_in_key` theo tuple trùng hoàn toàn.

    Rows phai duoc sap xep on dinh (timestamp, roi thu tu nhan tu provider) truoc
    khi goi. Khong mutate input; tra ve list dict moi.
    """
    materialized = [dict(row) for row in rows]
    # O3 (re-audit S3): sort on dinh theo timestamp (Python sort on dinh giu
    # thu tu provider khi cung timestamp), tranh seq_in_key doi khi provider
    # tra lai cac page theo thu tu khac nhau giua 2 lan retry.
    materialized.sort(key=lambda row: _norm_datetime(row.get('timestamp')))
    seen: dict[tuple, int] = defaultdict(int)
    for row in materialized:
        base = (
            str(row.get('symbol') or '').strip().upper(),
            _norm_datetime(row.get('timestamp')),
            str(Decimal(str(row.get('price') or 0))),
            str(int(row.get('volume') or 0)),
            str(row.get('side') or '').strip().upper(),
            str(row.get('match_type') or ''),
            str(row.get('source') or ''),
        )
        seq = seen[base]
        seen[base] += 1
        row['dedup_key'] = build_dedup_key(
            symbol=base[0],
            timestamp=base[1],
            price=base[2],
            volume=base[3],
            side=base[4],
            match_type=base[5],
            source=base[6],
            seq_in_key=seq,
        )
    return materialized
