#!/usr/bin/env python
"""Smoke test for intraday API endpoints"""
import requests
import json

# Get token
token_resp = requests.post(
    'http://localhost:8001/api/auth/token/',
    json={'username': 'admin', 'password': 'test@123456'}
)
token = token_resp.json().get('access')
headers = {'Authorization': f'Bearer {token}'}

# Test 1: Intraday Prices
print('=== SMOKE TEST 1: Intraday Prices ===')
r1 = requests.get('http://localhost:8001/core/v1/market-data/intraday-prices/VCB/', headers=headers)
if r1.status_code == 200:
    data = r1.json()
    print(f'OK - Symbol: {data.get("symbol")}, Points: {len(data.get("points", []))}, Source: {data.get("source")}')
else:
    print(f'FAIL - HTTP {r1.status_code}')

print()
# Test 2: Intraday Tape
print('=== SMOKE TEST 2: Intraday Tape ===')
r2 = requests.get('http://localhost:8001/core/v1/market-data/intraday-tape/VCB/', headers=headers)
if r2.status_code == 200:
    data = r2.json()
    print(f'OK - Symbol: {data.get("symbol")}, Trades: {len(data.get("trades", []))}, Source: {data.get("source")}')
else:
    print(f'FAIL - HTTP {r2.status_code}')

print()
# Test 3: Auth Required
print('=== SMOKE TEST 3: Auth Required ===')
r3 = requests.get('http://localhost:8001/core/v1/market-data/intraday-prices/VCB/')
if r3.status_code == 401:
    print(f'OK - HTTP 401 Unauthorized')
else:
    print(f'FAIL - HTTP {r3.status_code} (expected 401)')

print()
print('All smoke tests passed!' if all([
    r1.status_code == 200,
    r2.status_code == 200,
    r3.status_code == 401
]) else 'Some tests failed!')
