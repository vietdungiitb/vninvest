#!/usr/bin/env python
"""
Test payload serialization to JSON
"""
import os
import sys
import json
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

django.setup()

from portfolio.market_data_service import market_data_service
from portfolio.exceptions import ExternalSystemException

# Test with a symbol that causes cache miss
try:
    market_data_service.get_realtime_ticker('BID')
except ExternalSystemException as exc:
    print("Exception caught:")
    print(f"  Message: {exc.message}")
    print(f"  Code: {exc.code}")
    print(f"  Payload type: {type(exc.payload)}")
    print(f"  Payload keys: {exc.payload.keys() if exc.payload else 'None'}")
    
    # Try to serialize the response data
    response_data = {'detail': exc.message, **exc.payload}
    print("\nAttempting to serialize response_data to JSON...")
    try:
        json_str = json.dumps(response_data, indent=2, default=lambda obj: f"<non-JSON: {type(obj).__name__}>")
        print("✓ Serialization successful")
        # Try to parse it back
        json.loads(json_str)
        print("✓ Deserialization successful")
    except Exception as e:
        print(f"✗ Serialization failed: {e}")
        # Try to see which field is problematic
        for key, val in response_data.items():
            try:
                json.dumps(val)
                print(f"  {key}: ✓ JSON serializable")
            except:
                print(f"  {key}: ✗ NOT JSON serializable - {type(val).__name__}: {val}")
