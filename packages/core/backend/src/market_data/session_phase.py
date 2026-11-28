"""SSOT phân loại phiên khớp lệnh & hướng aggressor (S2 / REQ-BE-M02 + G-3b).

Quy tắc vi mô sàn VN (RFC §2.1):
  - Chỉ CONTINUOUS (09:15–11:30 & 13:00–14:30 ICT) mới có aggressor BUY/SELL.
  - ATO (09:00:00–09:14:59), ATC (14:30:01–14:59:59) và PUT_THROUGH là khớp
    hai chiều ⇒ side BẮT BUỘC UNKNOWN, giá trị đi vào `auction_value` (S5).

Dùng chung ở cả 3 write-path: live adapter, backfill DNSE, hydrate warm.
Không import Django model — module thuần để tránh import cycle.
"""
from __future__ import annotations

from datetime import datetime, time, timezone as dt_timezone

import pytz

_VN_TZ = pytz.timezone('Asia/Ho_Chi_Minh')

ATO = 'ATO'
CONTINUOUS = 'CONTINUOUS'
ATC = 'ATC'
PUT_THROUGH = 'PUT_THROUGH'
UNKNOWN = 'UNKNOWN'

_AUCTION_PHASES = frozenset({ATO, ATC, PUT_THROUGH})


def _to_ict(timestamp: datetime) -> datetime:
    """Chuyển mọi timestamp (naive/aware) về giờ VN để so khung giờ market."""
    if timestamp.tzinfo is None:
        return pytz.utc.localize(timestamp).astimezone(_VN_TZ)
    return timestamp.astimezone(_VN_TZ)


def resolve_session_phase(timestamp: datetime | None, match_type: str | None) -> str:
    """Ưu tiên `match_type` từ provider; nếu thiếu则用 khung giờ ICT (G-3b)."""
    raw = str(match_type or '').strip().lower().replace('-', '_').replace(' ', '_')
    if raw.startswith('ato') or '_ato' in raw:
        return ATO
    if raw.startswith('atc') or '_atc' in raw:
        return ATC
    if 'put_through' in raw or raw.startswith('pt') or 'thoa_thuan' in raw:
        return PUT_THROUGH
    if raw.startswith('buy') or raw.startswith('sell') or raw == 'normalmatch':
        # Giá trị không mang thông tin phiên — rơi xuống fallback giờ.
        pass

    if timestamp is None:
        return UNKNOWN
    wall = _to_ict(timestamp)
    clock = wall.timetz().replace(tzinfo=None)
    if time(9, 0, 0) <= clock <= time(9, 14, 59):
        return ATO
    if time(14, 30, 1) <= clock <= time(14, 59, 59):
        return ATC
    if time(9, 15, 0) <= clock <= time(11, 30, 0) or time(13, 0, 0) <= clock <= time(14, 30, 0):
        return CONTINUOUS
    return UNKNOWN


def normalize_tick_side(
    side: str | None,
    timestamp: datetime | None,
    match_type: str | None,
) -> tuple[str, str]:
    """Trả về `(side_chuan, session_phase)`. Aggressor chỉ tồn tại ở CONTINUOUS."""
    phase = resolve_session_phase(timestamp, match_type)
    if phase in _AUCTION_PHASES:
        return UNKNOWN, phase

    raw_side = str(side or '').strip().upper()
    if raw_side in ('BUY', 'SELL'):
        return raw_side, phase if phase == CONTINUOUS else UNKNOWN
    # Một số provider g aggressor vào match_type (legacy live path).
    raw_match = str(match_type or '').strip().lower()
    if raw_match.startswith('buy'):
        return 'BUY', phase if phase == CONTINUOUS else UNKNOWN
    if raw_match.startswith('sell'):
        return 'SELL', phase if phase == CONTINUOUS else UNKNOWN
    return UNKNOWN, phase
