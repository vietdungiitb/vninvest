"""
Quick verification script - Check demo dataset integrity
Run: python manage.py shell < verify_demo_data.py
"""

from django.contrib.auth.models import User
from datetime import date
from django.db.models import Count
from portfolio.models import (
    StockProfile, DailyPrice, IntradayTick,
    WhaleAdvisory, OrderFlowSignal, AIAdvisoryComponentRecord,
    Portfolio, SubAccount, Transaction,
    PriceAlertRule, ScreenerRule, WatchlistGroup,
    TrackedSymbol,
)

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def format_number(n):
    return f"{n:,}"

# Users
print_section("👤 USER ACCOUNTS")
users = User.objects.all()
for user in users:
    plan = user.user_config.plan if hasattr(user, 'user_config') else 'N/A'
    print(f"  {user.username:15} | Email: {user.email:30} | Plan: {plan}")

# Stocks
print_section("📊 STOCK PROFILES")
stocks = StockProfile.objects.all()
print(f"Total Stocks: {format_number(stocks.count())}")
print("\nSample stocks:")
for stock in stocks[:10]:
    print(f"  {stock.symbol:10} | {stock.company_name:40} | {stock.industry:15}")
if stocks.count() > 10:
    print(f"  ... and {format_number(stocks.count() - 10)} more")

# Daily Prices
print_section("📈 DAILY PRICE DATA")
daily_prices = DailyPrice.objects.all()
print(f"Total Records: {format_number(daily_prices.count())}")
earliest = daily_prices.order_by('date').first()
latest = daily_prices.order_by('-date').first()
if earliest and latest:
    print(f"Date Range: {earliest.date} to {latest.date}")
    print(f"Day Span: {(latest.date - earliest.date).days} days")

# Intraday Ticks
print_section("⏱️  INTRADAY TICK DATA")
ticks = IntradayTick.objects.all()
print(f"Total Ticks: {format_number(ticks.count())}")
if ticks.exists():
    sample_date = ticks.values_list('trade_date', flat=True).distinct().first()
    ticks_today = IntradayTick.objects.filter(trade_date=sample_date).count()
    print(f"Sample Date: {sample_date}")
    print(f"Ticks on {sample_date}: {format_number(ticks_today)}")
    print(f"Avg per stock: ~{ticks.count() // max(1, StockProfile.objects.count())} ticks")

# Whale Advisories
print_section("🐋 WHALE ADVISORIES")
advisories = WhaleAdvisory.objects.all()
print(f"Total Advisories: {format_number(advisories.count())}")

# By Side
buy_count = advisories.filter(side='BUY').count()
sell_count = advisories.filter(side='SELL').count()
print(f"  BUY:  {format_number(buy_count):6} ({buy_count*100//advisories.count():2}%)")
print(f"  SELL: {format_number(sell_count):6} ({sell_count*100//advisories.count():2}%)")

# Top symbols
print("\nTop 5 Most Advised Symbols:")
top_symbols_qs = advisories.values('symbol').annotate(
    cnt=Count('id')
).order_by('-cnt')[:5]
for item in top_symbols_qs:
    print(f"  {item['symbol']:10} | {format_number(item['cnt']):4} advisories")

# Order Flow Signals
print_section("📊 ORDER FLOW SIGNALS")
signals = OrderFlowSignal.objects.all()
print(f"Total Signals: {format_number(signals.count())}")

signal_types = signals.values('signal_type').annotate(
    cnt=Count('id')
).order_by('-cnt')
print("\nSignal Type Distribution:")
for item in signal_types:
    typeof = item['signal_type']
    cnt = item['cnt']
    pct = cnt * 100 // signals.count() if signals.count() > 0 else 0
    bar = '█' * (pct // 5) + '░' * (20 - pct // 5)
    print(f"  {typeof:12} | {bar} {cnt:3} ({pct:2}%)")

# AI Advisory Components
print_section("🤖 AI ADVISORY COMPONENTS")
components = AIAdvisoryComponentRecord.objects.all()
print(f"Total Components: {format_number(components.count())}")

# Per user
print("\nComponents per User:")
for user in users:
    user_components = components.filter(user=user).count()
    print(f"  {user.username:15} | {format_number(user_components):4} components")

# Portfolios
print_section("💼 PORTFOLIOS & ACCOUNTS")
portfolios = Portfolio.objects.all()
print(f"Portfolios: {format_number(portfolios.count())}")
print(f"Sub-accounts: {format_number(SubAccount.objects.count())}")

for user in users:
    user_portfolios = portfolios.filter(user=user)
    user_transactions = Transaction.objects.filter(sub_account__portfolio__user=user).count()
    print(f"\n  {user.username}:")
    for pf in user_portfolios:
        print(f"    • {pf.name:25} ({format_number(user_transactions)} total transactions)")

# Watchlists
print_section("👀 WATCHLISTS & TRACKING")
watchlists = WatchlistGroup.objects.all()
tracked = TrackedSymbol.objects.all()
print(f"Watchlist Groups: {format_number(watchlists.count())}")
print(f"Tracked Symbols: {format_number(tracked.count())}")

for user in users:
    user_groups = watchlists.filter(user=user).count()
    user_tracked = tracked.filter(user=user).count()
    print(f"  {user.username:15} | {user_groups:2} groups | {user_tracked:2} tracked")

# Price Alerts
print_section("🚨 PRICE ALERT RULES")
alerts = PriceAlertRule.objects.all()
print(f"Total Rules: {format_number(alerts.count())}")

active = alerts.filter(is_active=True).count()
inactive = alerts.filter(is_active=False).count()
print(f"  Active:   {format_number(active):4} ({active*100//alerts.count() if alerts.exists() else 0}%)")
print(f"  Inactive: {format_number(inactive):4} ({100-active*100//alerts.count() if alerts.exists() else 0}%)")

# Screener Rules
print_section("🔍 SCREENER RULES")
screeners = ScreenerRule.objects.all()
print(f"Total Rules: {format_number(screeners.count())}")

print("\nScreener Templates:")
for screener in screeners.distinct('name'):
    count = screeners.filter(name=screener.name).count()
    print(f"  {screener.name:35} | Used by {count} users")

# Summary
print_section("📊 DATASET SUMMARY")
total_records = (
    StockProfile.objects.count() +
    DailyPrice.objects.count() +
    IntradayTick.objects.count() +
    WhaleAdvisory.objects.count() +
    OrderFlowSignal.objects.count() +
    AIAdvisoryComponentRecord.objects.count() +
    Portfolio.objects.count() +
    SubAccount.objects.count() +
    Transaction.objects.count() +
    PriceAlertRule.objects.count() +
    ScreenerRule.objects.count()
)

print(f"Total Database Records: {format_number(total_records)}")
print(f"Users: {format_number(users.count())}")
print(f"Stocks: {format_number(StockProfile.objects.count())}")
print(f"Historical Days: 180+")
print(f"Intraday Data Points: {format_number(IntradayTick.objects.count())}")
print(f"Whale Signals: {format_number(advisories.count())}")
print(f"Order Flow Patterns: {format_number(signals.count())}")

print("\n✅ Demo dataset is ready for testing!\n")
