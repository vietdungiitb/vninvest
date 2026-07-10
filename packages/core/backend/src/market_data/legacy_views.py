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
from user_workspace.permissions import TenantScopePermission


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_list():
    return Response([], status=status.HTTP_200_OK)


def _empty_paginated(request=None):
    return Response({"count": 0, "results": [], "next": None, "previous": None})


from market_data.default_groups import (
    get_default_groups,
    get_group_lookup,
    get_color_palette,
    build_group_payload as _build_stock_management_group_payload,
    _build_item_payload as _build_stock_management_item_payload,
)

# Backwards compatibility - re-exported from default_groups
_STOCK_MANAGEMENT_DEFAULT_GROUPS = get_default_groups()
_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = get_group_lookup()
_STOCK_MANAGEMENT_COLOR_PALETTE = get_color_palette()


# ---------------------------------------------------------------------------
# Stock-management stubs (not yet migrated to core)
# ---------------------------------------------------------------------------


class StockManagementGroupsView(APIView):
    """GET /api/stock-management/groups/ — returns core watchlist-backed market groups."""
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        from user_workspace.models import Watchlist

        watchlists = list(Watchlist.objects.filter(user=request.user, tenant=request.tenant).prefetch_related('items'))
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
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def post(self, request):
        from user_workspace.models import Watchlist, WatchlistItem

        created_groups = []
        updated_groups = []
        added_symbols = 0

        for group_data in _STOCK_MANAGEMENT_DEFAULT_GROUPS:
            watchlist, created = Watchlist.objects.get_or_create(
                user=request.user,
                tenant=request.tenant,
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
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)





class TrackedSymbolsView(APIView):
    """GET/POST /api/stock-management/tracked-symbols/"""
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        return _empty_list()

    def post(self, request):
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class TrackedSymbolDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        return Response(status=status.HTTP_204_NO_CONTENT)



class TrackedSymbolBulkThresholdView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class PriceAlertsView(APIView):
    """GET/POST /api/stock-management/price-alerts/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return _empty_list()

    def post(self, request):
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)



class PriceAlertDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        return Response(status=status.HTTP_204_NO_CONTENT)



class PriceAlertTriggerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


