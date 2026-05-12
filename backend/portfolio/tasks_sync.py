from __future__ import annotations

import os
import sys
from celery import shared_task
from django.conf import settings

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import Watchlist
    _watchlist_model = Watchlist
except (ImportError, RuntimeError):
    from portfolio.models import WatchlistGroup as Watchlist  # noqa: F401 - fallback
    _watchlist_model = Watchlist

from portfolio.models import TrackedSymbol


@shared_task(bind=True, name='portfolio.tasks.sync_user_watch_assets', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_user_watch_assets(self, user_id: int, days: int | None = None) -> dict:
    from portfolio import tasks as tasks_facade

    sync_days = int(days or getattr(settings, 'WATCHLIST_SYNC_DAYS', 5))
    results = tasks_facade.sync_watchlist_prices(user_id=user_id, days=sync_days)
    return {
        'status': 'ok',
        'user_id': user_id,
        'days': sync_days,
        'symbols': len(results),
        'synced': results,
    }


@shared_task(bind=True, name='portfolio.tasks.sync_all_watch_assets', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_all_watch_assets(self, days: int | None = None) -> dict:
    from portfolio import tasks as tasks_facade

    sync_days = int(days or getattr(settings, 'WATCHLIST_SYNC_DAYS', 5))
    user_ids = sorted({
        *TrackedSymbol.objects.values_list('user_id', flat=True),
        *_watchlist_model.objects.values_list('user_id', flat=True),
    })
    user_ids = [user_id for user_id in user_ids if user_id]

    synced_users = []
    total_symbols = 0
    for user_id in user_ids:
        results = tasks_facade.sync_watchlist_prices(user_id=user_id, days=sync_days)
        total_symbols += len(results)
        synced_users.append({'user_id': user_id, 'symbols': len(results)})

    return {
        'status': 'ok',
        'days': sync_days,
        'users': synced_users,
        'total_users': len(synced_users),
        'total_symbols': total_symbols,
    }
