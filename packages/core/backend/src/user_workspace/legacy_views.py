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
from .permissions import TenantScopePermission


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_list():
    return Response([], status=status.HTTP_200_OK)

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


class LegacyWatchlistGroupDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def _get(self, request, pk):
        from user_workspace.models import Watchlist
        try:
            return Watchlist.objects.get(pk=pk, user=request.user, tenant=request.tenant)
        except Watchlist.DoesNotExist:
            return None

    def get(self, request, pk):
        from user_workspace.serializers import WatchlistSerializer
        w = self._get(request, pk)
        if w is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(WatchlistSerializer(w).data)

    def patch(self, request, pk):
        from user_workspace.serializers import WatchlistSerializer
        w = self._get(request, pk)
        if w is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WatchlistSerializer(w, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        w = self._get(request, pk)
        if w is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        w.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)



class LegacyWatchlistGroupListView(APIView):
    """GET/POST /api/portfolio/watchlist/groups/ → core user_workspace.Watchlist"""
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        from user_workspace.models import Watchlist
        watchlists = Watchlist.objects.filter(user=request.user, tenant=request.tenant).order_by('name')
        data = [
            {
                "id": w.pk,
                "name": w.name,
                "description": w.description,
                "is_default": w.is_default,
                "items": [
                    {"id": item.pk, "symbol": item.symbol, "note": item.note}
                    for item in w.items.all()
                ],
            }
            for w in watchlists
        ]
        return Response(data)

    def post(self, request):
        from user_workspace.models import Watchlist
        from user_workspace.serializers import WatchlistSerializer
        serializer = WatchlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        watchlist = serializer.save(user=request.user, tenant=request.tenant)
        return Response(WatchlistSerializer(watchlist).data, status=status.HTTP_201_CREATED)



class LegacyWatchlistItemCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def post(self, request, group_id):
        from user_workspace.models import Watchlist, WatchlistItem
        try:
            watchlist = Watchlist.objects.get(pk=group_id, user=request.user, tenant=request.tenant)
        except Watchlist.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        symbol = request.data.get("symbol", "").strip().upper()
        if not symbol:
            return Response({"detail": "symbol required."}, status=status.HTTP_400_BAD_REQUEST)
        item, _ = WatchlistItem.objects.get_or_create(watchlist=watchlist, symbol=symbol)
        return Response({"id": item.pk, "symbol": item.symbol}, status=status.HTTP_201_CREATED)



class LegacyWatchlistItemDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def delete(self, request, pk):
        from user_workspace.models import WatchlistItem
        try:
            item = WatchlistItem.objects.get(pk=pk, watchlist__user=request.user, watchlist__tenant=request.tenant)
            item.delete()
        except WatchlistItem.DoesNotExist:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Portfolio userconfig compat
# ---------------------------------------------------------------------------


class PortfolioAnalyticsStubView(APIView):
    """Stub for portfolio object analytics endpoints (summary, chart, equity-curve…) not yet migrated."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        return Response({})

    def post(self, request, **kwargs):
        return Response({})


# ---------------------------------------------------------------------------
# Watchlist compat — maps /api/portfolio/watchlist/groups/ to core watchlists
# ---------------------------------------------------------------------------


class PortfolioListAnalyticsStubView(APIView):
    """Stub for portfolio list endpoints (holdings, technicals) not yet migrated."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        return _empty_list()

    def post(self, request, **kwargs):
        return Response({})



class PortfolioUserConfigView(APIView):
    """GET/PUT /api/portfolio/userconfig/ → core identity_access.UserProfile"""
    permission_classes = [permissions.IsAuthenticated]

    def _get_profile(self, user):
        from identity_access.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        profile = self._get_profile(request.user)
        return Response({
            "id": profile.pk,
            "language": profile.language,
            "theme": profile.theme,
            "whale_alert_threshold": str(profile.whale_alert_threshold),
            "preferences": profile.preferences,
        })

    def put(self, request):
        profile = self._get_profile(request.user)
        data = request.data
        if "language" in data:
            profile.language = data["language"]
        if "theme" in data:
            profile.theme = data["theme"]
        if "whale_alert_threshold" in data:
            profile.whale_alert_threshold = data["whale_alert_threshold"]
        if "preferences" in data and isinstance(data["preferences"], dict):
            profile.preferences.update(data["preferences"])
        profile.save()
        return Response({
            "id": profile.pk,
            "language": profile.language,
            "theme": profile.theme,
            "whale_alert_threshold": str(profile.whale_alert_threshold),
            "preferences": profile.preferences,
        })


# ---------------------------------------------------------------------------
# Stock Management Native Compat
# ---------------------------------------------------------------------------

class SecuritiesGroupListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        from user_workspace.models import Watchlist
        watchlists = Watchlist.objects.filter(user=request.user, tenant=request.tenant).order_by('name')
        if not watchlists.exists():
            # Seed default groups if none exist for new users in SaaS mode
            return Response(_STOCK_MANAGEMENT_DEFAULT_GROUPS)
        
        data = [_build_stock_management_group_payload(w, i) for i, w in enumerate(watchlists)]
        return Response(data)

class SecuritiesGroupDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]
    def get(self, request, group_id):
        from user_workspace.models import Watchlist
        try:
            w = Watchlist.objects.get(pk=group_id, user=request.user, tenant=request.tenant)
            return Response(_build_stock_management_group_payload(w, 0))
        except Watchlist.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

class TrackedSymbolListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # In core-api, tracked symbols are just items in watchlists.
        # We can aggregate them or just return an empty list for now to satisfy UI.
        return Response([])

class SecuritiesSyncView(APIView):
    permission_classes = [permissions.IsAdminUser]
    def post(self, request):
        # Native sync is handled by AdminOpsMarketGroupsSyncView
        return Response({"ok": True, "message": "Native sync triggered via Admin Ops."})

class BulkTechnicalBySymbolsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # Trả về empty technicals để UI không crash
        return Response({})

class PriceAlertRuleListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return Response([])

class SecuritiesSeedView(APIView):
    permission_classes = [permissions.IsAdminUser]
    def post(self, request):
        return Response({"ok": True, "message": "Native seeding skipped."})

