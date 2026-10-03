#!/usr/bin/env python
import os
import sys
import django
import json
import subprocess

sys.path.insert(0, '/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

# Create test user
user, _ = User.objects.get_or_create(username='test_api', defaults={'email': 'test@test.com'})
token = str(RefreshToken.for_user(user).access_token)

# Test endpoints
test_symbols = ['BID', 'PVT', 'HPG', 'MSN', 'MWG', 'BCM']

print("Testing realtime ticker API endpoints...")
print("=" * 80)

for symbol in test_symbols:
    url = f"http://localhost:8000/api/realtime/ticker/{symbol}/"
    cmd = f'curl -s -H "Authorization: Bearer {token}" "{url}"'
    
    print(f"\n{symbol}:")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/app')
    
    try:
        data = json.loads(result.stdout)
        print(f"  Status: OK (from response)")
        if 'detail' in data:
            print(f"  Error: {data.get('detail')}")
        if 'source' in data:
            print(f"  Source: {data.get('source')}")
            print(f"  Current price: {data.get('current_price')}")
            print(f"  Cache state: {data.get('cache_state')}")
    except:
        print(f"  Response: {result.stdout[:200]}")

print("\n" + "=" * 80)
