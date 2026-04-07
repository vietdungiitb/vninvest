from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError

from .models import SubAccount
from .serializers import (
    PortfolioSerializer,
    SubAccountSerializer,
    TradingSubAccountCreateRequestSerializer,
    TransactionSerializer,
)
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

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        request_serializer = TradingSubAccountCreateRequestSerializer(data=payload)
        request_serializer.is_valid(raise_exception=True)

        requested_portfolio_id = request_serializer.validated_data.get('portfolio')
        owned_portfolios = TradingService.portfolio_queryset_for_user(request.user)
        has_owned_portfolio = owned_portfolios.exists()

        if not has_owned_portfolio:
            raise DRFValidationError('User must have at least one Portfolio')
        elif requested_portfolio_id is not None:
            if not owned_portfolios.filter(id=requested_portfolio_id).exists():
                raise DRFValidationError({'portfolio': ['Portfolio khong thuoc nguoi dung hien tai.']})
            payload['portfolio'] = requested_portfolio_id
        elif not payload.get('portfolio'):
            fallback_portfolio = owned_portfolios.first()
            if fallback_portfolio:
                payload['portfolio'] = fallback_portfolio.id

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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
