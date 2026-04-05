from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import SubAccount
from .serializers import PortfolioSerializer, SubAccountSerializer, TransactionSerializer
from .trading_service import TradingService


@method_decorator(csrf_exempt, name='dispatch')
class PortfolioListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TradingService.portfolio_queryset_for_user(self.request.user)

    def perform_create(self, serializer):
        TradingService.create_portfolio(serializer, self.request.user)


class PortfolioDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TradingService.portfolio_queryset_for_user(self.request.user)


class SubAccountListCreateView(generics.ListCreateAPIView):
    serializer_class = SubAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TradingService.sub_account_queryset_for_user(self.request.user)

    def perform_create(self, serializer):
        TradingService.create_sub_account(serializer, self.request.user)


class SubAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubAccountSerializer
    permission_classes = [IsAuthenticated]
    queryset = SubAccount.objects.select_related('portfolio')
    lookup_field = 'pk'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        return TradingService.sub_account_queryset_for_user(self.request.user)


@method_decorator(csrf_exempt, name='dispatch')
class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        sub_account_id = self.kwargs['sub_account_id']
        return TradingService.transaction_queryset_for_sub_account(self.request.user, sub_account_id)

    def perform_create(self, serializer):
        sub_account_id = self.kwargs['sub_account_id']
        TradingService.create_transaction(serializer, self.request.user, sub_account_id)


class TransactionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TradingService.transaction_queryset_for_user(self.request.user)
