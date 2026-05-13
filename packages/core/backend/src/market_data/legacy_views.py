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
from vninvest_core.utils.legacy_bridge import legacy_bridge_response


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


def _legacy_bridge_or_none_on_unavailable(request, legacy_path: str, *, unavailable_message: str):
    bridged_response = legacy_bridge_response(
        request,
        legacy_path,
        unavailable_message=unavailable_message,
    )
    if bridged_response is None:
        return None
    response_payload = getattr(bridged_response, 'data', None)
    if (
        bridged_response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        and isinstance(response_payload, dict)
        and response_payload.get('status') == 'bridge_unavailable'
    ):
        return None
    return bridged_response


# ---------------------------------------------------------------------------
# Stock-management stubs (not yet migrated to core)
# ---------------------------------------------------------------------------


class StockManagementGroupsView(APIView):
    """GET /api/stock-management/groups/ — returns core watchlist-backed market groups."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bridged_response = _legacy_bridge_or_none_on_unavailable(
            request,
            request.path,
            unavailable_message='Legacy securities-group bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response

        from user_workspace.models import Watchlist

        watchlists = list(Watchlist.objects.filter(user=request.user).prefetch_related('items'))
        watchlists.sort(
            key=lambda watchlist: (
                _STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP.get(watchlist.name, {}).get('order', 999),
                watchlist.name.lower(),
                watchlist.pk or 0,
            )
        )
        data = [_build_stock_management_group_payload(watchlist, index) for index, watchlist in enumerate(watchlists)]
        return Response(data)



class StockManagementSeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        bridged_response = _legacy_bridge_or_none_on_unavailable(
            request,
            request.path,
            unavailable_message='Legacy securities-seed bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response

        from user_workspace.models import Watchlist, WatchlistItem

        created_groups = []
        updated_groups = []
        added_symbols = 0

        for group_data in _STOCK_MANAGEMENT_DEFAULT_GROUPS:
            watchlist, created = Watchlist.objects.get_or_create(
                user=request.user,
                name=group_data['name'],
                defaults={
                    'description': group_data['description'],
                    'is_default': False,
                },
            )

            updated_fields = []
            if watchlist.description != group_data['description']:
                watchlist.description = group_data['description']
                updated_fields.append('description')
            if watchlist.is_default:
                watchlist.is_default = False
                updated_fields.append('is_default')
            if updated_fields:
                watchlist.save(update_fields=updated_fields)

            group_added_symbols = 0
            for symbol in group_data['symbols']:
                item, item_created = WatchlistItem.objects.get_or_create(
                    watchlist=watchlist,
                    symbol=symbol.upper().strip(),
                    defaults={'note': ''},
                )
                if item_created:
                    group_added_symbols += 1

            added_symbols += group_added_symbols
            if created:
                created_groups.append({'group': watchlist.name, 'symbols': len(group_data['symbols'])})
            elif updated_fields or group_added_symbols:
                updated_groups.append({'group': watchlist.name, 'new_symbols': group_added_symbols})

        message_parts = []
        if created_groups:
            message_parts.append(f'đã tạo {len(created_groups)} nhóm mặc định')
        if updated_groups:
            message_parts.append(f'cập nhật {len(updated_groups)} nhóm')
        if added_symbols:
            message_parts.append(f'thêm {added_symbols} mã')
        if not message_parts:
            message_parts.append('không có thay đổi')

        return Response({
            'created': created_groups,
            'updated': updated_groups,
            'added_symbols': added_symbols,
            'message': ', '.join(message_parts).capitalize() + '.',
        })



class StockManagementSyncView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        bridged_response = legacy_bridge_response(
            request,
            request.path,
            unavailable_message='Legacy securities-sync bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)





class TrackedSymbolsView(APIView):
    """GET/POST /api/stock-management/tracked-symbols/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bridged_response = legacy_bridge_response(
            request,
            '/api/stock-management/tracked-symbols/',
            unavailable_message='Legacy tracked-symbol bridge hiện không khả dụng.',
        )
        if bridged_response is not None and bridged_response.status_code < 500:
            return bridged_response
        return _empty_list()

    def post(self, request):
        bridged_response = legacy_bridge_response(
            request,
            '/api/stock-management/tracked-symbols/',
            unavailable_message='Legacy tracked-symbol bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class TrackedSymbolDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        bridged_response = legacy_bridge_response(
            request,
            f'/api/stock-management/tracked-symbols/{pk}/',
            unavailable_message='Legacy tracked-symbol detail bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        bridged_response = legacy_bridge_response(
            request,
            f'/api/stock-management/tracked-symbols/{pk}/',
            unavailable_message='Legacy tracked-symbol detail bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response(status=status.HTTP_204_NO_CONTENT)



class TrackedSymbolBulkThresholdView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        bridged_response = legacy_bridge_response(
            request,
            '/api/stock-management/tracked-symbols/bulk-threshold/',
            unavailable_message='Legacy tracked-symbol bulk bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class PriceAlertsView(APIView):
    """GET/POST /api/stock-management/price-alerts/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bridged_response = _legacy_bridge_or_none_on_unavailable(
            request,
            '/api/stock-management/price-alerts/',
            unavailable_message='Legacy price-alert bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return _empty_list()

    def post(self, request):
        bridged_response = legacy_bridge_response(
            request,
            '/api/stock-management/price-alerts/',
            unavailable_message='Legacy price-alert bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class PriceAlertDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        bridged_response = legacy_bridge_response(
            request,
            f'/api/stock-management/price-alerts/{pk}/',
            unavailable_message='Legacy price-alert detail bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        bridged_response = legacy_bridge_response(
            request,
            f'/api/stock-management/price-alerts/{pk}/',
            unavailable_message='Legacy price-alert detail bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response(status=status.HTTP_204_NO_CONTENT)



class PriceAlertTriggerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        bridged_response = legacy_bridge_response(
            request,
            f'/api/stock-management/price-alerts/{pk}/mark-triggered/',
            unavailable_message='Legacy price-alert trigger bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


