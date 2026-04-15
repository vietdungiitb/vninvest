#!/usr/bin/env python
"""
Дiagnostic script to test realtime ticker API locally
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

django.setup()

from portfolio.market_data_service import market_data_service
from portfolio.exceptions import ExternalSystemException, MarketDataValidationException

# Test symbols that are failing in frontend
test_symbols = ['BID', 'PVT', 'HPG', 'HPG', 'MSN', 'MWG', 'BCM']

print("Testing realtime ticker API...")
print("=" * 80)

for symbol in test_symbols:
    print(f"\nTesting: {symbol}")
    print("-" * 40)
    try:
        result = market_data_service.get_realtime_ticker(symbol)
        print(f"✓ Success")
        print(f"  Current price: {result.get('current_price')}")
        print(f"  Source: {result.get('source')}")
        print(f"  Cache state: {result.get('cache_state')}")
        print(f"  Freshness seconds: {result.get('freshness_seconds')}")
    except MarketDataValidationException as e:
        print(f"✗ Validation error: {e.message}")
    except ExternalSystemException as e:
        print(f"✗ External system error: {e.message}")
        print(f"  Code: {e.code}")
    except Exception as e:
        print(f"✗ Unexpected error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 80)
print("Diagnostic complete")
