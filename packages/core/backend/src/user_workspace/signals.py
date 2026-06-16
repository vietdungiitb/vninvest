from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from market_data.global_symbol_registry import (
    sync_holding_demand_for_portfolio_symbol,
    sync_price_alert_demand,
    sync_tracked_symbol_demand,
    sync_watchlist_item_demand,
)

from .models import PriceAlert, TrackedSymbol, Transaction, WatchlistItem


@receiver(post_save, sender=WatchlistItem)
def sync_watchlist_item_registry_on_save(sender, instance, **kwargs):
    sync_watchlist_item_demand(instance, is_active=True)


@receiver(post_delete, sender=WatchlistItem)
def sync_watchlist_item_registry_on_delete(sender, instance, **kwargs):
    sync_watchlist_item_demand(instance, is_active=False)


@receiver(post_save, sender=TrackedSymbol)
def sync_tracked_symbol_registry_on_save(sender, instance, **kwargs):
    sync_tracked_symbol_demand(instance)


@receiver(post_delete, sender=TrackedSymbol)
def sync_tracked_symbol_registry_on_delete(sender, instance, **kwargs):
    sync_tracked_symbol_demand(instance, is_active=False)


@receiver(post_save, sender=PriceAlert)
def sync_price_alert_registry_on_save(sender, instance, **kwargs):
    sync_price_alert_demand(instance)


@receiver(post_delete, sender=PriceAlert)
def sync_price_alert_registry_on_delete(sender, instance, **kwargs):
    sync_price_alert_demand(instance, is_active=False)


@receiver(pre_save, sender=Transaction)
def capture_previous_transaction_symbol(sender, instance, **kwargs):
    if not instance.pk:
        return
    previous = sender.objects.filter(pk=instance.pk).values('symbol').first()
    if previous is not None:
        instance._registry_previous_symbol = previous['symbol']


@receiver(post_save, sender=Transaction)
def sync_transaction_registry_on_save(sender, instance, **kwargs):
    sync_holding_demand_for_portfolio_symbol(instance.portfolio, instance.symbol)
    previous_symbol = getattr(instance, '_registry_previous_symbol', None)
    if previous_symbol and str(previous_symbol).upper().strip() != str(instance.symbol).upper().strip():
        sync_holding_demand_for_portfolio_symbol(instance.portfolio, previous_symbol)


@receiver(post_delete, sender=Transaction)
def sync_transaction_registry_on_delete(sender, instance, **kwargs):
    sync_holding_demand_for_portfolio_symbol(instance.portfolio, instance.symbol)


from .models import Portfolio, Watchlist, ScreenerRule

@receiver(pre_save, sender=Portfolio)
@receiver(pre_save, sender=Watchlist)
@receiver(pre_save, sender=TrackedSymbol)
@receiver(pre_save, sender=PriceAlert)
@receiver(pre_save, sender=ScreenerRule)
def auto_populate_tenant_from_user(sender, instance, **kwargs):
    if not getattr(instance, 'tenant_id', None) and getattr(instance, 'user', None):
        user = instance.user
        tenant = getattr(user, 'core_tenant', None)
        if tenant is None:
            profile = getattr(user, 'core_profile', None)
            tenant = getattr(profile, 'tenant', None)
        if tenant is not None:
            instance.tenant = tenant


@receiver(pre_save, sender=Transaction)
def auto_populate_transaction_tenant(sender, instance, **kwargs):
    if not getattr(instance, 'tenant_id', None) and getattr(instance, 'portfolio', None):
        instance.tenant = instance.portfolio.tenant