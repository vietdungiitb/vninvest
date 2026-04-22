import os
import django
import sys

# Setup django
sys.path.append('c:\\Mujoco Projects\\vninvest\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from portfolio.views_dark_money_history import dark_money_history_api
from rest_framework.test import APIRequestFactory
from portfolio.models import IntradayTick, User
from rest_framework.request import Request

factory = APIRequestFactory()
request = factory.get('/api/stock-management/stocks/DXG/dark-money-history/', {'period': '3M', 'interval': '1D'})
user = User.objects.filter(is_superuser=True).first()
from django.db.models import F, FloatField, ExpressionWrapper, Case, When
import datetime

cutoff = datetime.date.today() - datetime.timedelta(days=90)
raw_ticks = IntradayTick.objects.filter(symbol='DXG', trade_date__gte=cutoff).annotate(
    mv=ExpressionWrapper(
        Case(
            When(price__gte=1000, then=F('price') * F('volume')),
            default=F('price') * 1000 * F('volume'),
            output_field=FloatField(),
        ),
        output_field=FloatField()
    )
).filter(mv__gte=500_000_000)
print(f"Raw Whale Ticks Count: {raw_ticks.count()}")

from portfolio.services import WhaleSignalEngine
threshold, source = WhaleSignalEngine.resolve_threshold_vnd(user, 'DXG')
print(f"Threshold used: {threshold} (source: {source})")

from rest_framework.test import force_authenticate
force_authenticate(request, user=user)

response = dark_money_history_api(request, symbol='DXG')
print(f"Response status: {response.status_code}")
if response.status_code != 200:
    print(f"Error data: {response.data}")

print(f"Whale signals count: {len(response.data.get('whale_signals', []))}")
print(f"Dark flow series count: {len(response.data.get('dark_flow_series', []))}")
print(f"SMFI: {response.data.get('smart_money_flow_index')}")
if response.data.get('dark_flow_series'):
    print("Dark flow series sample:", response.data['dark_flow_series'][0])

if response.data.get('whale_signals'):
    print("First whale signal sample:", response.data['whale_signals'][0])
else:
    print("Whale signals list is empty in response.")
