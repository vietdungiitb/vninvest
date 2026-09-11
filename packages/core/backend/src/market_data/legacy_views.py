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

# Backwards compatibility — re-exported from default_groups (fallback only)
_STOCK_MANAGEMENT_DEFAULT_GROUPS = get_default_groups()
_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = get_group_lookup()
_STOCK_MANAGEMENT_COLOR_PALETTE = get_color_palette()


def _load_legacy_group_meta_map():
    """Load group display metadata — CachedSymbolGroup (DB) preferred, fallback to default_groups."""
    try:
        from service_ops.models import CachedSymbolGroup
        groups = CachedSymbolGroup.objects.filter(is_active=True).values(
            'group_name', 'group_type', 'color', 'display_order',
        )
        if groups:
            return {
                g['group_name']: {
                    'group_type': g['group_type'],
                    'color': g['color'],
                    'display_order': g['display_order'],
                }
                for g in groups
            }
    except Exception:
        pass
    return {
        g['name']: {
            'group_type': g.get('group_type', 'CUSTOM'),
            'color': g.get('color', ''),
            'display_order': g.get('order', 999),
        }
        for g in _STOCK_MANAGEMENT_DEFAULT_GROUPS
    }


# ---------------------------------------------------------------------------
# Stock-management stubs (not yet migrated to core)
# ---------------------------------------------------------------------------


class StockManagementGroupsView(APIView):
    """GET /api/stock-management/groups/ — returns core watchlist-backed market groups."""
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        from service_ops.models import CachedSymbolGroup

        meta_map = _load_legacy_group_meta_map()
        groups = list(CachedSymbolGroup.objects.filter(is_active=True).prefetch_related('members'))
        groups.sort(
            key=lambda g: (
                meta_map.get(g.group_name, {}).get('display_order', 999),
                (g.group_name or '').lower(),
                g.pk or 0,
            )
        )
        data = []
        for index, g in enumerate(groups):
            template = meta_map.get(g.group_name) or {}
            color = template.get('color') or _STOCK_MANAGEMENT_COLOR_PALETTE[index % len(_STOCK_MANAGEMENT_COLOR_PALETTE)]
            group_type = g.group_type or template.get('group_type') or 'CUSTOM'
            order = g.display_order or template.get('order') or (index + 1)
            data.append({
                'id': g.pk,
                'name': g.group_name,
                'group_type': group_type,
                'description': g.description,
                'color': color,
                'order': order,
                'items': [_build_stock_management_item_payload(m) for m in g.members.all()],
            })
        return Response(data)



class StockManagementSeedView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def post(self, request):
        # Delegate to seed_default_watchlist_groups — uses CachedSymbolGroup (SSOT) not default_groups.py
        from market_data.stock_mgmt_native_views import seed_default_watchlist_groups

        result = seed_default_watchlist_groups(request.user, force_recreate=True)

        message_parts = []
        if result['created']:
            message_parts.append(f"đã tạo {len(result['created'])} nhóm mặc định")
        if result['updated']:
            message_parts.append(f"cập nhật {len(result['updated'])} nhóm")
        if result['added_symbols']:
            message_parts.append(f"thêm {result['added_symbols']} mã")
        if not message_parts:
            message_parts.append('không có thay đổi')

        return Response({
            'created': result['created'],
            'updated': result['updated'],
            'added_symbols': result['added_symbols'],
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


