"""
Advisory domain REST API views.

Endpoints:
  GET  /core/v1/advisory/latest/<symbol>/   — latest AdvisoryRecord for symbol+date
  POST /core/v1/advisory/refresh/<symbol>/  — request advisory generation
  GET  /core/v1/advisory/history/<symbol>/  — paginated AdvisoryRecord history
"""
from datetime import date as _date

from django.conf import settings as django_settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AdvisoryRecord, AdvisorySession
from .serializers import AdvisoryRecordSerializer


class AdvisoryLatestView(APIView):
    """Return the latest generated advisory for a symbol on a session date."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        session_date = request.query_params.get('date') or str(_date.today())
        advisory = (
            AdvisoryRecord.objects
            .filter(symbol=symbol, session_date=session_date, status='generated')
            .order_by('-generated_at', '-created_at')
            .first()
        )
        if advisory is None:
            return Response(
                {'detail': f'Chưa có advisory cho {symbol} ngày {session_date}.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(AdvisoryRecordSerializer(advisory).data)


class AdvisoryRefreshView(APIView):
    """
    Create a pending AdvisoryRecord to trigger async generation.

    Actual generation is handled by a Celery task (Phase 3 shadow run not yet cutover).
    Returns 202 with the pending record.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol):
        symbol = symbol.upper()
        session_date = str(_date.today())

        # SFI-B5: Token budget check — block request if today's sessions have exceeded budget.
        token_budget = getattr(django_settings, 'ADVISORY_TOKEN_BUDGET', 2000)
        tokens_used_today = (
            AdvisorySession.objects
            .filter(user=request.user, session_date=session_date)
            .values_list('tokens_used', flat=True)
        )
        total_tokens = sum(tokens_used_today)
        if total_tokens >= token_budget:
            return Response(
                {
                    'detail': f'Token budget ({token_budget}) đã được sử dụng hết trong ngày hôm nay.',
                    'tokens_used': total_tokens,
                    'token_budget': token_budget,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        record, created = AdvisoryRecord.objects.get_or_create(
            symbol=symbol,
            session_date=session_date,
            status='pending',
            defaults={
                'user': request.user,
                'ai_model': '',
            },
        )
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(AdvisoryRecordSerializer(record).data, status=code)


class AdvisoryHistoryView(APIView):
    """Paginated list of advisory records for a symbol (newest first)."""
    permission_classes = [permissions.IsAuthenticated]
    _PAGE_SIZE = 20

    def get(self, request, symbol):
        symbol = symbol.upper()
        qs = (
            AdvisoryRecord.objects
            .filter(symbol=symbol, status='generated')
            .order_by('-generated_at', '-pk')
        )
        session_date = request.query_params.get('session_date')
        if session_date:
            qs = qs.filter(session_date=session_date)

        # Simple page-based pagination
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        offset = (page - 1) * self._PAGE_SIZE
        results = qs[offset: offset + self._PAGE_SIZE]
        serializer = AdvisoryRecordSerializer(results, many=True)
        return Response({
            'results': serializer.data,
            'page': page,
            'page_size': self._PAGE_SIZE,
        })
