import os
import django
import sys
import pandas as pd
import numpy as np

# Setup django
sys.path.append('c:\\Mujoco Projects\\vninvest\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from portfolio.models import IntradayTick, DailyPrice
from django.db.models import F, FloatField, ExpressionWrapper, Case, When
from datetime import date, timedelta

symbol = 'DXG'
cutoff = date.today() - timedelta(days=90)
whale_threshold_vnd = 500_000_000

whale_ticks_qs = list(
    IntradayTick.objects
    .filter(
        symbol=symbol,
        trade_date__gte=cutoff,
    )
    .annotate(
        matched_value=ExpressionWrapper(
            Case(
                When(price__gte=1000, then=F('price') * F('volume')),
                default=F('price') * 1000 * F('volume'),
                output_field=FloatField(),
            ),
            output_field=FloatField()
        )
    )
    .filter(matched_value__gte=whale_threshold_vnd)
    .values('trade_date', 'trade_time', 'side', 'price', 'volume', 'matched_value')
    .order_by('trade_date', 'trade_time', 'matched_value')
)

print(f"Ticks found: {len(whale_ticks_qs)}")

if whale_ticks_qs:
    frame = pd.DataFrame.from_records(whale_ticks_qs)
    print(f"DataFrame shape: {frame.shape}")
    
    from portfolio.views_dark_money_history import _normalize_tick_side
    frame['stored_side'] = frame['side'].map(_normalize_tick_side)
    print("Stored sides count:", frame['stored_side'].value_counts().to_dict())
    
    # Simulation of inferred_side logic
    frame['inferred_side'] = frame['stored_side']
    # If no ref prices, it stays stored_side
    
    frame = frame[frame['inferred_side'].isin(['buy', 'sell'])]
    print(f"After side filter: {len(frame)}")
    
    if not frame.empty:
        frame['price_volume_sum'] = frame['price'] * frame['volume']
        grouped = (
            frame.groupby(['trade_date', 'inferred_side'], as_index=False)
            .agg({
                'matched_value': 'sum',
                'volume': 'sum',
                'price_volume_sum': 'sum',
                'side': 'size' # count
            })
        )
        print(f"Grouped results: {len(grouped)}")
from portfolio.models import OrderFlowSignal
print(f"OrderFlowSignal count for DXG: {OrderFlowSignal.objects.filter(symbol=symbol).count()}")
if OrderFlowSignal.objects.filter(symbol=symbol).exists():
    print("Latest OrderFlowSignal:", OrderFlowSignal.objects.filter(symbol=symbol).latest('id').signal_type)
