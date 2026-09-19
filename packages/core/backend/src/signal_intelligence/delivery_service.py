from __future__ import annotations

from datetime import datetime

from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from identity_access.models import UserProfile
from user_workspace.models import TrackedSymbol, Transaction, WatchlistItem

from .models import UnifiedAlert, UserAlertDelivery, UserAlertPreference


def resolve_user_delivery_symbols(user) -> list[str]:
    symbols = set()
    if user is None or not getattr(user, 'is_authenticated', False):
        return []

    watchlist_symbols = WatchlistItem.objects.filter(watchlist__user=user).values_list('symbol', flat=True).distinct()
    tracked_symbols = TrackedSymbol.objects.filter(user=user).values_list('symbol', flat=True).distinct()
    holding_symbols = Transaction.objects.filter(portfolio__user=user).values_list('symbol', flat=True).distinct()

    for symbol in watchlist_symbols:
        if symbol:
            symbols.add(str(symbol).upper())
    for symbol in tracked_symbols:
        if symbol:
            symbols.add(str(symbol).upper())
    for symbol in holding_symbols:
        if symbol:
            symbols.add(str(symbol).upper())
    return sorted(symbols)


def resolve_user_whale_threshold_vnd(user) -> int:
    profile = getattr(user, 'core_profile', None)
    if isinstance(profile, UserProfile) and profile.whale_alert_threshold is not None:
        try:
            return max(int(profile.whale_alert_threshold), 1) * 1_000_000
        except (TypeError, ValueError):
            return 500_000_000
    return 500_000_000


def _delivery_state_rank(state: str) -> int:
    rank = {
        UserAlertDelivery.DeliveryStateChoices.NEW: 1,
        UserAlertDelivery.DeliveryStateChoices.SEEN: 2,
        UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED: 3,
        UserAlertDelivery.DeliveryStateChoices.MUTED: 4,
        UserAlertDelivery.DeliveryStateChoices.SUPPRESSED: 5,
    }
    return rank.get(state, 0)


def _allowed_transition(current_state: str, target_state: str) -> bool:
    if target_state == current_state:
        return True
    if current_state in {UserAlertDelivery.DeliveryStateChoices.MUTED, UserAlertDelivery.DeliveryStateChoices.SUPPRESSED}:
        return target_state in {UserAlertDelivery.DeliveryStateChoices.MUTED, UserAlertDelivery.DeliveryStateChoices.SUPPRESSED}
    return _delivery_state_rank(target_state) >= _delivery_state_rank(current_state)


def apply_user_delivery_policy(*, user, queryset: QuerySet[UnifiedAlert]) -> QuerySet[UnifiedAlert]:
    user_symbols = resolve_user_delivery_symbols(user)
    if not user_symbols:
        return queryset.none()

    scoped = queryset.filter(symbol__in=user_symbols)
    whale_threshold = resolve_user_whale_threshold_vnd(user)
    scoped = scoped.exclude(
        alert_type__in={UnifiedAlert.AlertTypeChoices.WHALE, UnifiedAlert.AlertTypeChoices.DARK_FLOW},
        value__isnull=False,
        value__lt=whale_threshold,
    )

    now = timezone.now()
    active_preferences = UserAlertPreference.objects.filter(user=user).filter(
        Q(mute_until__isnull=False, mute_until__gt=now) | Q(cooldown_seconds__gt=0)
    )
    if not active_preferences.exists():
        return scoped

    suppression_q = Q()
    for preference in active_preferences:
        if preference.symbol and preference.alert_family:
            suppression_q |= Q(symbol__iexact=preference.symbol, alert_type=preference.alert_family)
        elif preference.symbol:
            suppression_q |= Q(symbol__iexact=preference.symbol)
        elif preference.alert_family:
            suppression_q |= Q(alert_type=preference.alert_family)

    if suppression_q:
        scoped = scoped.exclude(suppression_q)
    return scoped


@transaction.atomic
def sync_user_delivery_rows(*, user, alerts: list[UnifiedAlert]) -> None:
    if user is None or not getattr(user, 'is_authenticated', False):
        return
    if not alerts:
        return

    now = timezone.now()
    alert_ids = [alert.pk for alert in alerts]
    existing_rows = {
        row.alert_id: row
        for row in UserAlertDelivery.objects.select_for_update().filter(user=user, alert_id__in=alert_ids)
    }

    to_create = []
    to_update = []
    for alert in alerts:
        row = existing_rows.get(alert.pk)
        if row is None:
            to_create.append(
                UserAlertDelivery(
                    user=user,
                    alert=alert,
                    delivery_state=UserAlertDelivery.DeliveryStateChoices.NEW,
                    metadata={'source': 'user_delivery_projection'},
                )
            )
            continue

        if row.delivery_state == UserAlertDelivery.DeliveryStateChoices.SUPPRESSED:
            row.delivery_state = UserAlertDelivery.DeliveryStateChoices.NEW
            row.suppression_reason = ''
            row.delivered_at = now
            row.metadata = {**(row.metadata or {}), 'source': 'user_delivery_projection'}
            to_update.append(row)

    if to_create:
        UserAlertDelivery.objects.bulk_create(to_create)
    if to_update:
        UserAlertDelivery.objects.bulk_update(to_update, ['delivery_state', 'suppression_reason', 'delivered_at', 'metadata', 'updated_at'])


@transaction.atomic
def transition_delivery_state(*, user, alert: UnifiedAlert, target_state: str, suppression_reason: str = '') -> UserAlertDelivery:
    row, _ = UserAlertDelivery.objects.select_for_update().get_or_create(
        user=user,
        alert=alert,
        defaults={'delivery_state': UserAlertDelivery.DeliveryStateChoices.NEW, 'metadata': {'source': 'state_transition'}},
    )

    if not _allowed_transition(row.delivery_state, target_state):
        return row

    row.delivery_state = target_state
    row.metadata = {**(row.metadata or {}), 'source': 'state_transition'}
    if target_state == UserAlertDelivery.DeliveryStateChoices.SEEN and row.seen_at is None:
        row.seen_at = timezone.now()
    if target_state == UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED:
        if row.seen_at is None:
            row.seen_at = timezone.now()
        row.acknowledged_at = timezone.now()
    if target_state in {UserAlertDelivery.DeliveryStateChoices.MUTED, UserAlertDelivery.DeliveryStateChoices.SUPPRESSED}:
        row.suppression_reason = suppression_reason
    row.save()
    return row


def mark_delivery_seen(*, user, alert: UnifiedAlert) -> UserAlertDelivery:
    return transition_delivery_state(user=user, alert=alert, target_state=UserAlertDelivery.DeliveryStateChoices.SEEN)


def acknowledge_delivery(*, user, alert: UnifiedAlert) -> UserAlertDelivery:
    return transition_delivery_state(user=user, alert=alert, target_state=UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)


@transaction.atomic
def upsert_user_alert_preference(
    *,
    user,
    symbol: str,
    alert_family: str,
    mute_until: datetime | None,
    cooldown_seconds: int = 0,
    channel_policy: dict | None = None,
    metadata: dict | None = None,
) -> UserAlertPreference:
    preference, _ = UserAlertPreference.objects.update_or_create(
        user=user,
        symbol=(symbol or '').upper(),
        alert_family=alert_family,
        defaults={
            'mute_until': mute_until,
            'cooldown_seconds': max(int(cooldown_seconds or 0), 0),
            'channel_policy': channel_policy or {},
            'metadata': metadata or {},
        },
    )
    return preference
