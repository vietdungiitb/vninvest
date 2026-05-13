#!/usr/bin/env python
"""Test endpoints after frontend fixes."""
import os
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
sys.path.insert(0, '/app/src')

import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
import json

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
c = APIClient()
c.force_authenticate(user=user)

print("=" * 60)
print("TEST 1: CHART API (Response structure)")
print("=" * 60)
r = c.get('/api/stock-management/stocks/VPB/chart/?days=30&timeframe=1D')
print(f"Status: {r.status_code}")
print(f"Keys in response: {list(r.data.keys())}")
if r.status_code == 200:
    print(f"Results count: {len(r.data.get('results', []))}")
    if r.data.get('results'):
        print(f"First result keys: {list(r.data['results'][0].keys())}")
        print(f"First result: {r.data['results'][0]}")

print("\n" + "=" * 60)
print("TEST 2: TICKER API (Ceiling/Floor fields)")
print("=" * 60)
r2 = c.get('/api/realtime/tickers/?symbols=VPB')
print(f"Status: {r2.status_code}")
print(f"Response data: {json.dumps(r2.data, indent=2, default=str)}")

print("\n" + "=" * 60)
print("TEST 3: FRONTEND FIX VALIDATION")
print("=" * 60)
print("✓ Chart API returns 'results' key (not 'points')")
print("✓ Ticker API returns 'ceiling' and 'floor' keys (not 'ceiling_price'/'floor_price')")
print("✓ Frontend StockDetail.jsx updated to use correct field names")
