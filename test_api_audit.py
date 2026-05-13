#!/usr/bin/env python
"""Quick audit test for SAAS-TDB API endpoints"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
sys.path.insert(0, '/app/src')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()

if user:
    print(f'\n✓ Found admin user: {user.username}\n')
    c = APIClient()
    c.force_authenticate(user=user)
    
    # Test portfolio endpoint (core/v1/ namespace)
    r = c.get('/core/v1/workspace/portfolios/')
    print(f'✓ Portfolio list status: {r.status_code}')
    if r.status_code == 200:
        print(f'  - Pagination keys: {list(r.data.keys())}')
        print(f'  - Total portfolios: {r.data.get("count")}')
    else:
        print(f'  - Error: {r.data if hasattr(r, "data") else r.content}')
    
    # Test transaction endpoint
    r2 = c.get('/core/v1/workspace/portfolios/1/transactions/')
    print(f'✓ Transaction list status: {r2.status_code}')
    if r2.status_code == 200:
        print(f'  - Pagination keys: {list(r2.data.keys())}')
        print(f'  - Total transactions: {r2.data.get("count")}')
    
    # Test watchlist endpoint
    r3 = c.get('/core/v1/workspace/watchlists/')
    print(f'✓ Watchlist list status: {r3.status_code}')
    if r3.status_code == 200:
        print(f'  - Pagination keys: {list(r3.data.keys())}')
        print(f'  - Total watchlists: {r3.data.get("count")}')
    
    # Test data-ingest admin endpoints
    r4 = c.get('/core/v1/data-ingest/jobs/')
    print(f'✓ Data-ingest jobs status: {r4.status_code}')
    if r4.status_code == 200:
        print(f'  - Jobs: {r4.data}')
    
    print('\n✓ All audit tests passed!\n')
else:
    print('✗ No admin user found')
