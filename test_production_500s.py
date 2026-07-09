#!/usr/bin/env python
import os
import sys
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
sys.path.insert(0, '/app/src')

import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
if not user:
    # Create a dummy superuser if not exists
    user = User.objects.create_superuser('admin_test', 'admin@test.com', 'admin_password')

c = APIClient()
c.force_authenticate(user=user)

endpoints = [
    '/core/v1/realtime/tickers/?symbols=MBB,SAB,PLX,SHB,SSB,STB,SSI,ACB,FPT,MWG,MSN,MSB,TPB,TCB,VCB,VPB',
    '/core/v1/realtime/whale-feed-aggregate/VIC/?session_date=2024-08-29',
    '/core/v1/advisory/latest/VIC/?date=2024-08-29',
    '/core/v1/advisory/latest/VIC/?date=2022-01-06',
    '/core/v1/realtime/whale-feed-aggregate/VIC/?session_date=2022-01-06'
]

for url in endpoints:
    print(f"\nTesting URL: {url}")
    try:
        r = c.get(url)
        print(f"Status Code: {r.status_code}")
        if r.status_code == 500:
            print("ERROR 500 Response Data:")
            print(r.content[:500])
        else:
            print(f"Response: {list(r.data.keys()) if hasattr(r, 'data') and isinstance(r.data, dict) else r.content[:200]}")
    except Exception as e:
        print(f"Exception raised: {e}")
        import traceback
        traceback.print_exc()
