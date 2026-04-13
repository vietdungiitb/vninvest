from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers

from .models import Portfolio, SubAccount, Transaction


class TradingService:
    """Service boundary for Trading endpoints (portfolio/sub-account/transaction)."""

    @staticmethod
    def portfolio_queryset_for_user(user):
        from django.db.models import Count
        return Portfolio.objects.filter(user=user).annotate(
            transaction_count_annotated=Count('sub_accounts__transactions', distinct=True),
            subaccount_count_annotated=Count('sub_accounts', distinct=True)
        )

    @staticmethod
    @transaction.atomic
    def create_portfolio(serializer, user):
        return serializer.save(user=user)

    @staticmethod
    def sub_account_queryset_for_user(user):
        return SubAccount.objects.filter(portfolio__user=user).select_related('portfolio')

    @staticmethod
    @transaction.atomic
    def create_sub_account(serializer, user):
        if not user.portfolios.exists():
            raise serializers.ValidationError('User must have at least one Portfolio')
        portfolio = user.portfolios.first()
        return serializer.save(portfolio=portfolio)

    @staticmethod
    def transaction_queryset_for_user(user):
        return Transaction.objects.filter(sub_account__portfolio__user=user)

    @staticmethod
    def transaction_queryset_for_sub_account(user, sub_account_id):
        return Transaction.objects.filter(
            sub_account_id=sub_account_id,
            sub_account__portfolio__user=user,
        ).order_by('-date')

    @staticmethod
    @transaction.atomic
    def create_transaction(serializer, user, sub_account_id):
        sub_account = get_object_or_404(SubAccount, pk=sub_account_id, portfolio__user=user)
        return serializer.save(sub_account=sub_account)
