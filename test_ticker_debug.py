#!/usr/bin/env python
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from portfolio.market_data_service import MarketDataService
import json

svc = MarketDataService()
for sym in ['VIC', 'MBB', 'TPB']:
    result = svc.get_realtime_ticker(sym)
    print(f"{sym}:")
    print(f"  change_pct: {result.get('change_pct')}")
    print(f"  prev_price: {result.get('prev_price')}")
    print(f"  current_price: {result.get('current_price')}")
    print(f"  reference_price: {result.get('reference_price')}")
    print(f"  source: {result.get('source')}")
    print()
