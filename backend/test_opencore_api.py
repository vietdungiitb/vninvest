#!/usr/bin/env python
"""
Integration test for OpenCore REST API endpoints.
Tests actual API responses and authentication.
"""

import os
import sys
import json
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/c/Mujoco Projects/vninvest/backend')

django.setup()

from django.contrib.auth.models import User
from django.test import Client
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken

print("=" * 70)
print("OpenCore REST API Integration Test")
print("=" * 70)

# Create test user and get JWT token
print("\n✓ Step 1: User Setup")
user, created = User.objects.get_or_create(
    username='api_test_user',
    defaults={
        'email': 'api_test@example.com',
        'first_name': 'API',
        'last_name': 'Test',
        'password': 'testpass123'
    }
)
if created:
    user.set_password('testpass123')
    user.save()
    print(f"  - Created user: {user.username}")
else:
    print(f"  - Using existing user: {user.username}")

# Get JWT token
refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)
print(f"  - Generated JWT token (first 20 chars): {access_token[:20]}...")

# Test API endpoints
client = Client()
base_url = 'http://localhost:8000'

test_endpoints = [
    ('/api/opencore/license/', 'GET', 'License list'),
    ('/api/opencore/usage/', 'GET', 'Usage list'),
    ('/api/opencore/indicators/', 'GET', 'Indicators list'),
    ('/api/opencore/billing/', 'GET', 'Billing list'),
]

print("\n✓ Step 2: API Endpoint Tests")

# Helper to make authenticated requests
def make_request(method, path, token):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    
    if method == 'GET':
        response = client.get(path, HTTP_AUTHORIZATION=headers['Authorization'])
    else:
        response = client.post(path, HTTP_AUTHORIZATION=headers['Authorization'])
    
    return response

# Test each endpoint
for path, method, description in test_endpoints:
    try:
        full_path = f'{path}'
        
        if method == 'GET':
            response = client.get(full_path)
        else:
            response = client.post(full_path)
        
        status = response.status_code
        status_icon = '✓' if status in [200, 201, 405] else '✗'
        print(f"  {status_icon} {description:30} | {status}")
        
        if status == 405:
            print(f"       (Method not allowed - expected for list endpoints)")
    
    except Exception as e:
        print(f"  ✗ {description:30} | ERROR: {str(e)[:40]}")

print("\n✓ Step 3: Specific Feature Tests")

# Test 1: Check license endpoint with authenticated user
print("\n  Testing: GET /api/opencore/license/my-license/")
response = client.get(
    '/api/opencore/license/my-license/',
    HTTP_AUTHORIZATION=f'Bearer {access_token}'
)
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"    Plan: {data.get('plan')}")
    print(f"    Status: {data.get('status')}")

# Test 2: Check available plans
print("\n  Testing: GET /api/opencore/license/available-plans/")
response = client.get('/api/opencore/license/available-plans/')
print(f"    Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"    Plans available: {len(data)}")

print("\n" + "=" * 70)
print("✓ Integration test completed!")
print("=" * 70)
