import os
import sys
import django
from django.utils import timezone
import datetime

# Setup Django
sys.path.append('c:\\Mujoco Projects\\vninvest\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from portfolio.models import PortfolioNewsDigest, WatchlistItem, UserConfig

def run_check():
    today = timezone.localdate()
    yesterday = today - datetime.timedelta(days=1)
    
    print(f"--- Digest Statistics ---")
    print(f"Today ({today}): {PortfolioNewsDigest.objects.filter(date=today).count()}")
    print(f"Yesterday ({yesterday}): {PortfolioNewsDigest.objects.filter(date=yesterday).count()}")
    
    print(f"\n--- Watchlist Statistics ---")
    total_items = WatchlistItem.objects.count()
    users_with_watchlist = WatchlistItem.objects.values_list('group__user_id', flat=True).distinct().count()
    print(f"Total WatchlistItems: {total_items}")
    print(f"Users with WatchlistItems: {users_with_watchlist}")
    
    print(f"\n--- User Config Statistics ---")
    total_configs = UserConfig.objects.count()
    configs_with_key = UserConfig.objects.exclude(ai_api_key='').count()
    print(f"Total UserConfigs: {total_configs}")
    print(f"UserConfigs with AI API Key: {configs_with_key}")
    
    if users_with_watchlist > 0:
        print(f"\n--- Sample User Watchlist (First User) ---")
        first_user_id = WatchlistItem.objects.values_list('group__user_id', flat=True).distinct().first()
        symbols = list(WatchlistItem.objects.filter(group__user_id=first_user_id).values_list('symbol', flat=True).distinct()[:10])
        print(f"User ID: {first_user_id}, Symbols: {symbols}")
        
        # Check if news exists for these symbols
        from portfolio.tasks_news_context import _fetch_news_context_for_advisory
        for sym in symbols[:3]:
            ctx = _fetch_news_context_for_advisory(sym, max_items=5)
            news_count = ctx.count('\n- ') if ctx else 0
            print(f"Symbol {sym}: {news_count} news items found")

if __name__ == "__main__":
    run_check()
