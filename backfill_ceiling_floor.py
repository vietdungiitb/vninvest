#!/usr/bin/env python
"""Backfill ceiling/floor in SymbolSnapshot from DailyPrice."""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from datetime import timedelta, date
from decimal import Decimal
from django.utils.timezone import now
from market_serving.models import SymbolSnapshot
from market_data.models import DailyPrice

today = date.today()
yesterday = today - timedelta(days=1)

# Get all DailyPrice symbols
symbols = DailyPrice.objects.filter(date=today).values_list('symbol', flat=True).distinct()
print(f"Found {len(symbols)} symbols in DailyPrice for today")

updated = 0
for symbol in symbols:
    # Get yesterday's close as reference price
    prev_daily = DailyPrice.objects.filter(symbol=symbol, date=yesterday).first()
    if not prev_daily:
        # Try 2 days ago
        two_days_ago = today - timedelta(days=2)
        prev_daily = DailyPrice.objects.filter(symbol=symbol, date=two_days_ago).first()
    
    if prev_daily:
        reference_price = prev_daily.close
        ceiling = reference_price * Decimal('1.07')
        floor = reference_price * Decimal('0.93')
        
        # Update or create snapshot with reference prices
        snap, created = SymbolSnapshot.objects.get_or_create(
            symbol=symbol,
            session_date=today,
            defaults={
                'price': reference_price,  # Use reference as placeholder
                'reference_price': reference_price,
                'ceiling': ceiling,
                'floor': floor,
                'market_status': 'closed',
                'source': 'backfill',
                'volume': 0,
            }
        )
        
        if not created:
            # Update existing
            snap.reference_price = reference_price
            snap.ceiling = ceiling
            snap.floor = floor
            snap.save()
        
        updated += 1
        if updated <= 5:
            print(f"  {symbol}: ref={reference_price}, ceil={ceiling}, floor={floor}")

print(f"\nBackfilled {updated} symbols")
