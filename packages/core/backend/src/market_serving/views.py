from rest_framework import generics, permissions
from rest_framework.exceptions import NotFound

from .models import SessionFacts, SymbolSnapshot
from .serializers import SessionFactsSerializer, SymbolSnapshotSerializer


class SymbolSnapshotListView(generics.ListAPIView):
    serializer_class = SymbolSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SymbolSnapshot.objects.all().order_by('-session_date', 'symbol')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs


class SymbolSnapshotDetailView(generics.RetrieveAPIView):
    serializer_class = SymbolSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        symbol = self.kwargs['symbol'].upper()
        try:
            return SymbolSnapshot.objects.filter(symbol=symbol).order_by('-session_date').first() or \
                   (_ for _ in ()).throw(NotFound(f'No snapshot found for {symbol}'))
        except Exception:
            raise NotFound(f'No snapshot found for {symbol}')


class SessionFactsListView(generics.ListAPIView):
    serializer_class = SessionFactsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SessionFacts.objects.all().order_by('-session_date', 'symbol')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs


class SessionFactsDetailView(generics.RetrieveAPIView):
    serializer_class = SessionFactsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        symbol = self.kwargs['symbol'].upper()
        obj = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date').first()
        if not obj:
            raise NotFound(f'No session facts found for {symbol}')
        return obj
