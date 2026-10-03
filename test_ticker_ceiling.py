#!/usr/bin/env python
"""Test realtime ticker with ceiling/floor fields."""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
c = APIClient()
c.force_authenticate(user=user)

# Check realtime ticker with new fields
r = c.get('/api/realtime/tickers/?symbols=VPB,VCB,ACB')
print('=== Realtime Ticker with Ceiling/Floor ===')
print('Status:', r.status_code)

for sym, data in r.data.items():
    print(f'\n{sym}:')
    print(f'  Price: {data.get("price")}')
    print(f'  Reference (nền): {data.get("reference_price")}')
    print(f'  Ceiling (trần): {data.get("ceiling")}')
    print(f'  Floor (sàn): {data.get("floor")}')
    print(f'  Volume: {data.get("volume")}')
