from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
c = APIClient()
c.force_authenticate(user=user)

print('\n=== TEST API ENDPOINTS FOR BCM STOCK ===\n')

# Test chart endpoint
print('1️⃣  Chart endpoint (days=30):')
r = c.get('/api/stock-management/stocks/BCM/chart/?days=30')
print(f'   Status: {r.status_code}')
if r.status_code == 200:
    print(f'   Response keys: {list(r.data.keys())}')
    if 'kline' in r.data:
        klines = r.data['kline']
        print(f'   Kline records: {len(klines)}')
        if klines:
            print(f'   First: {klines[0]}')
            print(f'   Last: {klines[-1]}')
else:
    print(f'   Error: {r.data}')

print()

# Test daily prices endpoint  
print('2️⃣  Daily prices endpoint:')
r2 = c.get('/api/market-data/daily-prices/BCM/?limit=30')
print(f'   Status: {r2.status_code}')
if r2.status_code == 200:
    if isinstance(r2.data, dict):
        print(f'   Response: {r2.data}')
    else:
        print(f'   Records: {len(r2.data) if isinstance(r2.data, list) else "N/A"}')
else:
    print(f'   Error: {r2.data}')

print()

# Test public daily prices
print('3️⃣  Public daily prices:')
r3 = c.get('/api/market-data/daily-prices/?symbol=BCM&limit=30')
print(f'   Status: {r3.status_code}')
if r3.status_code == 200:
    print(f'   Response: {r3.data if isinstance(r3.data, dict) else f"List of {len(r3.data)}" }')
else:
    print(f'   Error: {r3.data}')

print()

# Check what routes are available
print('4️⃣  Testing generic market data endpoints:')
r4 = c.get('/core/v1/market-data/daily-prices/')
print(f'   /core/v1/market-data/daily-prices/ : {r4.status_code}')

print()
