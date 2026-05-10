"""
Compatibility shim views for legacy frontend API paths.

These views map legacy `/api/<legacy-path>/` routes to either:
  - Existing core domain views (real data), or
  - Graceful stub responses (empty lists / minimal objects) for features not yet
    fully migrated to packages/core.

IMPORTANT: Every stub here is a placeholder.  As more domain functionality is
migrated, replace the stub with the real core view.
"""
import base64
import hashlib
import json
from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.db.models import Max, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.legacy_http_bridge import legacy_bridge_response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_list():
    return Response([], status=status.HTTP_200_OK)


def _empty_paginated(request=None):
    return Response({"count": 0, "results": [], "next": None, "previous": None})


_STOCK_MANAGEMENT_DEFAULT_GROUPS = [
    {
        "name": "Ngân hàng",
        "group_type": "SECTOR",
        "description": "Nhóm ngân hàng",
        "color": "#3b82f6",
        "order": 1,
        "symbols": ['ACB', 'BID', 'CTG', 'EIB', 'HDB', 'LPB', 'MBB', 'MSB', 'OCB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VIB', 'VPB'],
    },
    {
        "name": "Bất động sản",
        "group_type": "SECTOR",
        "description": "Nhóm bất động sản",
        "color": "#f59e0b",
        "order": 2,
        "symbols": ['BCM', 'CEO', 'DIG', 'DXG', 'KBC', 'KDH', 'NLG', 'NVL', 'PDR', 'SJS', 'TDH', 'VHM', 'VIC', 'VRE'],
    },
    {
        "name": "Thép & Vật liệu",
        "group_type": "SECTOR",
        "description": "Nhóm thép và vật liệu xây dựng",
        "color": "#ef4444",
        "order": 3,
        "symbols": ['BMP', 'HPG', 'HSG', 'NKG', 'TLH', 'VGC', 'VIS'],
    },
    {
        "name": "Dầu khí",
        "group_type": "SECTOR",
        "description": "Nhóm dầu khí và năng lượng",
        "color": "#8b5cf6",
        "order": 4,
        "symbols": ['GAS', 'OIL', 'PLX', 'PVD', 'PVS', 'PVT'],
    },
    {
        "name": "Công nghệ",
        "group_type": "SECTOR",
        "description": "Nhóm công nghệ và viễn thông",
        "color": "#22c55e",
        "order": 5,
        "symbols": ['CMG', 'ELC', 'FPT', 'SAM', 'VGI'],
    },
    {
        "name": "Bán lẻ & Tiêu dùng",
        "group_type": "SECTOR",
        "description": "Nhóm bán lẻ và hàng tiêu dùng",
        "color": "#ec4899",
        "order": 6,
        "symbols": ['MSN', 'MWG', 'PNJ', 'SAB', 'VNM'],
    },
    {
        "name": "VN30",
        "group_type": "MARKET_CAP",
        "description": "Top 30 cổ phiếu vốn hóa lớn nhất HOSE",
        "color": "#6366f1",
        "order": 7,
        "symbols": ['ACB', 'BID', 'CTG', 'DGC', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'LPB', 'MBB', 'MSN', 'MWG', 'PLX', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB', 'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VPL', 'VRE'],
    },
]

_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = {group['name']: group for group in _STOCK_MANAGEMENT_DEFAULT_GROUPS}
_STOCK_MANAGEMENT_COLOR_PALETTE = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#ec4899', '#6366f1']


def _build_stock_management_item_payload(item):
    return {
        'id': item.pk,
        'symbol': item.symbol,
        'note': getattr(item, 'note', '') or '',
        'current_price': None,
        'prev_price': None,
        'change_value': None,
        'change_pct': None,
        'last_date': None,
    }


def _build_stock_management_group_payload(watchlist, index: int):
    template = _STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP.get(watchlist.name) or {}
    color = template.get('color') or _STOCK_MANAGEMENT_COLOR_PALETTE[index % len(_STOCK_MANAGEMENT_COLOR_PALETTE)]
    group_type = template.get('group_type') or 'CUSTOM'
    order = template.get('order') or (index + 1)
    return {
        'id': watchlist.pk,
        'name': watchlist.name,
        'group_type': group_type,
        'description': watchlist.description,
        'color': color,
        'order': order,
        'items': [_build_stock_management_item_payload(item) for item in watchlist.items.all()],
    }


# ---------------------------------------------------------------------------
# Stock-management stubs (not yet migrated to core)
# ---------------------------------------------------------------------------


class GenericEmptyListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        return _empty_list()

    def post(self, request, **kwargs):
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class GenericEmptyStaffView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, **kwargs):
        return _empty_list()

    def post(self, request, **kwargs):
        return Response({"status": "accepted"})

    def put(self, request, **kwargs):
        return Response({"status": "accepted"})

