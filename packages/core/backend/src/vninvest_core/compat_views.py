"""
Compatibility shim views for legacy frontend API paths.

These views map legacy `/api/<legacy-path>/` routes to either:
  - Existing core domain views (real data), or
  - Graceful stub responses (empty lists / minimal objects) for features not yet
    fully migrated to packages/core.

IMPORTANT: Every stub here is a placeholder.  As more domain functionality is
migrated, replace the stub with the real core view.
"""
from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_list():
    return Response([], status=status.HTTP_200_OK)


def _empty_paginated(request=None):
    return Response({"count": 0, "results": [], "next": None, "previous": None})


# ---------------------------------------------------------------------------
# Admin-Ops stubs (not yet migrated to core)
# ---------------------------------------------------------------------------

class AdminOpsStatsView(APIView):
    """GET /api/admin-ops/stats/ — minimal stats from core DB."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from user_workspace.models import Portfolio, Transaction
        from identity_access.models import CoreTenant

        stats = {
            "portfolios": Portfolio.objects.count(),
            "transactions": Transaction.objects.count(),
            "tenants": CoreTenant.objects.count(),
            "users": User.objects.count(),
        }
        return Response(stats)


class AdminOpsRuntimeKPIView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response({"status": "ok", "note": "core-native runtime"})


class AdminOpsSystemAiSettingsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from advisory.models import SystemAISettings
        qs = SystemAISettings.objects.filter(is_active=True).first()
        if qs:
            return Response({
                "id": qs.pk,
                "name": qs.name,
                "ai_model": qs.ai_model,
                "max_tokens": qs.max_tokens,
                "temperature": qs.temperature,
                "is_active": qs.is_active,
            })
        return Response({})

    def put(self, request):
        return Response({"detail": "Use /admin/ to manage AI settings."}, status=status.HTTP_400_BAD_REQUEST)


class AdminOpsVnstockConfigCurrentView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        from market_data.models import VnstockRuntimeConfig
        cfg = VnstockRuntimeConfig.objects.filter(is_active=True).first()
        if cfg:
            return Response({
                "id": cfg.pk,
                "name": cfg.name,
                "data_source": cfg.data_source,
                "max_workers": cfg.max_workers,
                "request_delay_ms": cfg.request_delay_ms,
                "max_retries": cfg.max_retries,
                "batch_size": cfg.batch_size,
                "is_active": cfg.is_active,
            })
        return Response({})

    def patch(self, request):
        return Response({"detail": "Use /admin/ to manage vnstock config."}, status=status.HTTP_400_BAD_REQUEST)


class AdminOpsVnstockConfigChangelogView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return _empty_paginated()


class AdminOpsVnstockBenchmarkView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response({"status": "not_available"})

    def post(self, request):
        return Response({"status": "not_available"})


class AdminOpsStubActionView(APIView):
    """Generic stub for admin-ops actions not yet migrated."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, **kwargs):
        return Response({"status": "ok", "results": [], "count": 0})

    def post(self, request, **kwargs):
        return Response({"status": "accepted", "task_id": None})

    def put(self, request, **kwargs):
        return Response({"status": "accepted"})


# ---------------------------------------------------------------------------
# Stock-management stubs (not yet migrated to core)
# ---------------------------------------------------------------------------

class StockManagementGroupsView(APIView):
    """GET /api/stock-management/groups/ — returns empty list until groups are migrated."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return _empty_list()


class TrackedSymbolsView(APIView):
    """GET/POST /api/stock-management/tracked-symbols/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return _empty_list()

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


class StockManagementStubView(APIView):
    """Stub for stock-management endpoints not yet migrated."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        return Response([])

    def post(self, request, **kwargs):
        return Response({"detail": "Feature not yet available in SaaS."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


# ---------------------------------------------------------------------------
# Portfolio-compat stubs for complex analytics not yet migrated
# ---------------------------------------------------------------------------

class PortfolioAnalyticsStubView(APIView):
    """Stub for portfolio analytics endpoints not yet migrated (holdings, summary, chart…)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, **kwargs):
        return Response({})

    def post(self, request, **kwargs):
        return Response({})


# ---------------------------------------------------------------------------
# Watchlist compat — maps /api/portfolio/watchlist/groups/ to core watchlists
# ---------------------------------------------------------------------------

class LegacyWatchlistGroupListView(APIView):
    """GET/POST /api/portfolio/watchlist/groups/ → core user_workspace.Watchlist"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from user_workspace.models import Watchlist
        watchlists = Watchlist.objects.filter(user=request.user).order_by('name')
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
        watchlist = serializer.save(user=request.user)
        return Response(WatchlistSerializer(watchlist).data, status=status.HTTP_201_CREATED)


class LegacyWatchlistGroupDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get(self, request, pk):
        from user_workspace.models import Watchlist
        try:
            return Watchlist.objects.get(pk=pk, user=request.user)
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


class LegacyWatchlistItemCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, group_id):
        from user_workspace.models import Watchlist, WatchlistItem
        try:
            watchlist = Watchlist.objects.get(pk=group_id, user=request.user)
        except Watchlist.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        symbol = request.data.get("symbol", "").strip().upper()
        if not symbol:
            return Response({"detail": "symbol required."}, status=status.HTTP_400_BAD_REQUEST)
        item, _ = WatchlistItem.objects.get_or_create(watchlist=watchlist, symbol=symbol)
        return Response({"id": item.pk, "symbol": item.symbol}, status=status.HTTP_201_CREATED)


class LegacyWatchlistItemDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        from user_workspace.models import WatchlistItem
        try:
            item = WatchlistItem.objects.get(pk=pk, watchlist__user=request.user)
            item.delete()
        except WatchlistItem.DoesNotExist:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Portfolio userconfig compat
# ---------------------------------------------------------------------------

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
# Misc stubs
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
