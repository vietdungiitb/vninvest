#!/usr/bin/env python
"""Test price materialization from DailyPrice."""
import os
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
sys.path.insert(0, '/app/src')

import django
django.setup()

from market_serving.vnbroker_materializer import materialize_symbol_snapshot_from_vnbroker
from market_serving.models import SymbolSnapshot
from datetime import date

print("=" * 60)
print("TEST: Materialize Symbol Snapshot from DailyPrice")
print("=" * 60)

result = materialize_symbol_snapshot_from_vnbroker()
print(f"Result: {result}")

# Check VPB snapshot after materialization
vpb = SymbolSnapshot.objects.filter(symbol='VPB', session_date=date.today()).first()
if vpb:
    print(f"\nVPB Snapshot:")
    print(f"  Price: {vpb.price}")
    print(f"  Reference: {vpb.reference_price}")
    print(f"  Ceiling: {vpb.ceiling}")
    print(f"  Floor: {vpb.floor}")
    print(f"  Price in range? {vpb.floor <= vpb.price <= vpb.ceiling}")
else:
    print("VPB snapshot not found after materialization")
