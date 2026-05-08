from datetime import datetime, timezone

from django.urls import path
from rest_framework import permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from identity_access.authentication import CorePATAuthentication
from user_workspace import views as workspace_views


_PORTFOLIO_STORE = {}


def _store_key(user) -> str:
    return str(getattr(user, 'id', 'anonymous'))


def _portfolio_list_for(user) -> list:
    return _PORTFOLIO_STORE.setdefault(_store_key(user), [])


@api_view(['GET', 'POST'])
@authentication_classes([CorePATAuthentication])
@permission_classes([permissions.IsAuthenticated])
def portfolio_collection_view(request):
    user = request.user
    store = _portfolio_list_for(user)

    if request.method == 'GET':
        return Response(store, status=status.HTTP_200_OK)

    payload = request.data if isinstance(request.data, dict) else {}
    next_id = len(store) + 1
    now_iso = datetime.now(timezone.utc).isoformat()
    portfolio = {
        'id': next_id,
        'name': str(payload.get('name') or payload.get('title') or f'Danh mục {next_id}').strip(),
        'symbol': str(payload.get('symbol') or '').strip(),
        'currency': str(payload.get('currency') or 'VND').strip() or 'VND',
        'status': str(payload.get('status') or 'active').strip() or 'active',
        'created_at': now_iso,
        'updated_at': now_iso,
    }
    store.append(portfolio)
    return Response(portfolio, status=status.HTTP_201_CREATED)


# ──────────────────────────────────────────────────────────────────────────────
# SM-P4.2: Whale-alert compat (delegates to signal_intelligence core models)
# ──────────────────────────────────────────────────────────────────────────────

class CompatWhaleAlertsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from signal_intelligence.models import WhaleAlertCanonical
        from signal_intelligence.serializers import WhaleAlertCanonicalSerializer

        qs = WhaleAlertCanonical.objects.select_related('alert').order_by('-executed_at')
        symbol = request.query_params.get('symbol')
        session_date = request.query_params.get('session_date')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        if session_date:
            qs = qs.filter(session_date=session_date)
        return Response({'results': WhaleAlertCanonicalSerializer(qs[:200], many=True).data})


class CompatWhaleSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from signal_intelligence.models import UnifiedAlert
        from signal_intelligence.serializers import UnifiedAlertSerializer

        qs = UnifiedAlert.objects.filter(alert_type='whale').order_by('-triggered_at')
        symbol = request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return Response({'results': UnifiedAlertSerializer(qs[:50], many=True).data})


class CompatAdvisoryView(APIView):
    """GET /api/advisory/<symbol>/ → latest advisory from core advisory domain."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.models import AdvisoryRecord
        from advisory.serializers import AdvisoryRecordSerializer

        record = AdvisoryRecord.objects.filter(
            symbol=symbol.upper(), status='success'
        ).order_by('-generated_at').first()

        if record is None:
            return Response({'detail': f'Chưa có advisory cho {symbol}.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdvisoryRecordSerializer(record).data)


# URL patterns (mounted at /api/ in vninvest_core/urls.py)
urlpatterns = [
    path('portfolio/portfolios/', workspace_views.PortfolioListCreateView.as_view(), name='compat-portfolio-list'),
    path('portfolio/portfolios', workspace_views.PortfolioListCreateView.as_view(), name='compat-portfolio-list-noslash'),
    path('portfolio/portfolios/<int:portfolio_id>/', workspace_views.PortfolioDetailView.as_view(), name='compat-portfolio-detail'),
    path('portfolio/portfolios/<int:portfolio_id>', workspace_views.PortfolioDetailView.as_view(), name='compat-portfolio-detail-noslash'),
    path('portfolio/portfolios/<int:portfolio_id>/transactions/', workspace_views.TransactionListCreateView.as_view(), name='compat-portfolio-transactions'),
    path('portfolio/portfolios/<int:portfolio_id>/transactions', workspace_views.TransactionListCreateView.as_view(), name='compat-portfolio-transactions-noslash'),
    path('whale-alerts/', CompatWhaleAlertsView.as_view(), name='compat-whale-alerts'),
    path('whale-summary/', CompatWhaleSummaryView.as_view(), name='compat-whale-summary'),
    path('advisory/<str:symbol>/', CompatAdvisoryView.as_view(), name='compat-advisory'),
]

