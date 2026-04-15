#!/usr/bin/env python
"""
Test realtime ticker API endpoint with Django test client
"""
import os
import sys
import django
import json
from django.contrib.auth.models import User

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

django.setup()

from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

# Create or get a test user
user, created = User.objects.get_or_create(
    username='test_ticker_api',
    defaults={'email': 'test@example.com'}
)

# Generate JWT token
refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)

# Create test client
client = Client()
headers = {'HTTP_AUTHORIZATION': f'Bearer {access_token}'}

# Test symbols
test_symbols = ['BID', 'PVT', 'HPG']

print("Testing realtime ticker API endpoints...")
print("=" * 80)

for symbol in test_symbols:
    url = f'/api/realtime/ticker/{symbol}/'
    print(f"\nTesting GET {url}")
    print("-" * 40)
    
    try:
        response = client.get(url, **headers)
        print(f"Status code: {response.status_code}")
        print(f"Content-Type: {response.get('Content-Type')}")
        
        if response.status_code >= 200 and response.status_code < 300:
            print("✓ 2xx Success")
        elif response.status_code >= 400 and response.status_code < 500:
            print("⚠ 4xx Client Error")
        elif response.status_code >= 500:
            print("✗ 5xx Server Error")
            
        # Try to parse response
        try:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
        except:
            print(f"Response body: {response.content[:500]}")
            
    except Exception as e:
        print(f"✗ Request failed: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 80)
