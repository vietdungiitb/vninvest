"""
Single Source of Truth for Stock Management Default Groups.

This module consolidates the hardcoded default groups that were previously
duplicated across 5 different files. All legacy views should import from here.
"""

from typing import Any

# ──────────────────────────────────────────────────────────────────────────────
# Default Groups Definition
# ──────────────────────────────────────────────────────────────────────────────

STOCK_MANAGEMENT_DEFAULT_GROUPS: list[dict[str, Any]] = [
    {
        "name": "Ngân hàng",
        "group_type": "SECTOR",
        "description": "Nhóm ngân hàng",
        "color": "#3b82f6",
        "order": 1,
        "symbols": [
            "ACB",
            "BID",
            "CTG",
            "EIB",
            "HDB",
            "LPB",
            "MBB",
            "MSB",
            "OCB",
            "SHB",
            "SSB",
            "STB",
            "TCB",
            "TPB",
            "VCB",
            "VIB",
            "VPB",
        ],
    },
    {
        "name": "Bất động sản",
        "group_type": "SECTOR",
        "description": "Nhóm bất động sản",
        "color": "#f59e0b",
        "order": 2,
        "symbols": [
            "BCM",
            "CEO",
            "DIG",
            "DXG",
            "KBC",
            "KDH",
            "NLG",
            "NVL",
            "PDR",
            "SJS",
            "TDH",
            "VHM",
            "VIC",
            "VRE",
        ],
    },
    {
        "name": "Thép & Vật liệu",
        "group_type": "SECTOR",
        "description": "Nhóm thép và vật liệu xây dựng",
        "color": "#ef4444",
        "order": 3,
        "symbols": ["BMP", "HPG", "HSG", "NKG", "TLH", "VGC", "VIS"],
    },
    {
        "name": "Dầu khí",
        "group_type": "SECTOR",
        "description": "Nhóm dầu khí và năng lượng",
        "color": "#8b5cf6",
        "order": 4,
        "symbols": ["GAS", "OIL", "PLX", "PVD", "PVS", "PVT"],
    },
    {
        "name": "Công nghệ",
        "group_type": "SECTOR",
        "description": "Nhóm công nghệ và viễn thông",
        "color": "#22c55e",
        "order": 5,
        "symbols": ["CMG", "ELC", "FPT", "SAM", "VGI"],
    },
    {
        "name": "Bán lẻ & Tiêu dùng",
        "group_type": "SECTOR",
        "description": "Nhóm bán lẻ và hàng tiêu dùng",
        "color": "#ec4899",
        "order": 6,
        "symbols": ["MSN", "MWG", "PNJ", "SAB", "VNM"],
    },
    {
        "name": "VN30",
        "group_type": "MARKET_CAP",
        "description": "Top 30 cổ phiếu vốn hóa lớn nhất HOSE",
        "color": "#6366f1",
        "order": 7,
        "symbols": [
            "ACB",
            "BID",
            "CTG",
            "DGC",
            "FPT",
            "GAS",
            "GVR",
            "HDB",
            "HPG",
            "LPB",
            "MBB",
            "MSN",
            "MWG",
            "PLX",
            "SAB",
            "SHB",
            "SSB",
            "SSI",
            "STB",
            "TCB",
            "TPB",
            "VCB",
            "VHM",
            "VIB",
            "VIC",
            "VJC",
            "VNM",
            "VPB",
            "VPL",
            "VRE",
        ],
    },
    {
        "name": "VN100",
        "group_type": "MARKET_CAP",
        "description": "Top 100 cổ phiếu vốn hóa lớn nhất HOSE",
        "color": "#14b8a6",
        "order": 8,
        "symbols": [
            "ACB", "BID", "CTG", "DGC", "FPT", "GAS", "GVR", "HDB", "HPG", "LPB",
            "MBB", "MSN", "MWG", "PLX", "SAB", "SHB", "SSB", "SSI", "STB", "TCB",
            "TPB", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB", "VPL", "VRE",
            "BCM", "CEO", "DIG", "DXG", "KBC", "KDH", "NLG", "NVL", "PDR", "SJS",
            "TDH", "BMP", "HSG", "NKG", "TLH", "VGC", "VIS", "OIL", "PVD", "PVS",
            "PVT", "CMG", "ELC", "SAM", "VGI", "PNJ"
        ],
    },
    {
        "name": "HNX30",
        "group_type": "MARKET_CAP",
        "description": "Top 30 cổ phiếu thanh khoản và vốn hóa lớn nhất sàn HNX",
        "color": "#f43f5e",
        "order": 9,
        "symbols": ["CEO", "PVS", "SHS", "MBS", "IDC", "NTP", "TNG", "PVC", "PVI", "VCS"],
    },
    {
        "name": "HOSE",
        "group_type": "EXCHANGE",
        "description": "Toàn bộ cổ phiếu niêm yết trên sàn HOSE",
        "color": "#10b981",
        "order": 10,
        "symbols": [
            "ACB", "BCM", "BID", "BMP", "CTG", "DGC", "DIG", "DXG", "EIB", "ELC",
            "FPT", "GAS", "GVR", "HDB", "HPG", "HSG", "KBC", "KDH", "LPB", "MBB",
            "MSB", "MSN", "MWG", "NKG", "NLG", "NVL", "OCB", "PDR", "PLX", "PNJ",
            "PVD", "PVT", "SAB", "SHB", "SJS", "SSB", "SSI", "STB", "TCB", "TDH",
            "TLH", "TPB", "VCB", "VGC", "VHM", "VIB", "VIC", "VIS", "VJC", "VNM",
            "VND", "VPB", "VPL", "VRE"
        ],
    },
    {
        "name": "HNX",
        "group_type": "EXCHANGE",
        "description": "Toàn bộ cổ phiếu niêm yết trên sàn HNX",
        "color": "#6366f1",
        "order": 11,
        "symbols": ["CEO", "PVS", "SHS", "MBS", "IDC", "NTP", "TNG", "PVC", "PVI", "VCS"],
    },
    {
        "name": "UPCOM",
        "group_type": "EXCHANGE",
        "description": "Toàn bộ cổ phiếu niêm yết trên sàn UPCOM",
        "color": "#ec4899",
        "order": 12,
        "symbols": ["OIL", "VGI", "ACV", "VEA", "BSR", "MCH", "MVN", "VTP"],
    },
]

# ──────────────────────────────────────────────────────────────────────────────
# Derived Lookups (computed once at import time)
# ──────────────────────────────────────────────────────────────────────────────

_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP: dict[str, dict[str, Any]] = {
    group["name"]: group for group in STOCK_MANAGEMENT_DEFAULT_GROUPS
}

_STOCK_MANAGEMENT_COLOR_PALETTE: list[str] = [
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#22c55e",
    "#ec4899",
    "#6366f1",
    "#14b8a6",
    "#f43f5e",
    "#10b981",
]

_SYSTEM_DEFAULT_SYMBOL_GROUP_IDS: tuple[str, ...] = ("vn30", "vn100", "hnx30")


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def get_default_groups() -> list[dict[str, Any]]:
    """Return a deep copy of the default groups to prevent mutation."""
    import copy
    return copy.deepcopy(STOCK_MANAGEMENT_DEFAULT_GROUPS)


def get_group_lookup() -> dict[str, dict[str, Any]]:
    """Return the group name -> group data lookup map."""
    return _STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP


def get_color_palette() -> list[str]:
    """Return the color palette for groups."""
    return _STOCK_MANAGEMENT_COLOR_PALETTE


def get_system_default_group_ids() -> tuple[str, ...]:
    """Return the canonical system default group IDs."""
    return _SYSTEM_DEFAULT_SYMBOL_GROUP_IDS


def build_group_payload(watchlist, index: int) -> dict[str, Any]:
    """
    Build a standardized group payload for API responses.
    
    Used by legacy compat views to maintain consistent response format.
    """
    template = _STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP.get(watchlist.name) or {}
    color = template.get("color") or _STOCK_MANAGEMENT_COLOR_PALETTE[index % len(_STOCK_MANAGEMENT_COLOR_PALETTE)]
    group_type = template.get("group_type") or "CUSTOM"
    order = template.get("order") or (index + 1)
    return {
        "id": watchlist.pk,
        "name": watchlist.name,
        "group_type": group_type,
        "description": watchlist.description,
        "color": color,
        "order": order,
        "items": [_build_item_payload(item) for item in watchlist.items.all()],
    }


def _build_item_payload(item) -> dict[str, Any]:
    """Build a standardized item payload."""
    return {
        "id": item.pk,
        "symbol": item.symbol,
        "note": getattr(item, "note", "") or "",
        "current_price": None,
        "prev_price": None,
        "change_value": None,
        "change_pct": None,
        "last_date": None,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Backwards Compatibility Exports (for gradual migration)
# ──────────────────────────────────────────────────────────────────────────────

# These are exported so existing imports like:
#   from .default_groups import _STOCK_MANAGEMENT_DEFAULT_GROUPS
# continue to work during transition. New code should use the functions above.
_STOCK_MANAGEMENT_DEFAULT_GROUPS = STOCK_MANAGEMENT_DEFAULT_GROUPS
_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = _STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP
_STOCK_MANAGEMENT_COLOR_PALETTE = _STOCK_MANAGEMENT_COLOR_PALETTE
_SYSTEM_DEFAULT_SYMBOL_GROUP_IDS = _SYSTEM_DEFAULT_SYMBOL_GROUP_IDS
