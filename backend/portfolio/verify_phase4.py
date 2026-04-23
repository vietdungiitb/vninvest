import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth.models import User
from portfolio.models import UserConfig, WhaleServiceJob
from django.test import override_settings

@override_settings(ALLOWED_HOSTS=['testserver'])
def verify():
    print("--- Verification Report: Phase 4 API Integration ---")
    client = APIClient()
    
    # 1. Setup User
    username = "test_api_user"
    User.objects.filter(username=username).delete()
    user = User.objects.create_user(username=username, password="password")
    UserConfig.objects.update_or_create(user=user, defaults={'plan': 'pro'})
    
    client.force_authenticate(user=user)
    
    # 2. Test Trigger API
    print("1. Testing /api/portfolio/whale-service/trigger/ ...")
    payload = {
        "service_type": "BACKFILL",
        "params": {
            "symbols": ["VNM"],
            "start_date": "2026-04-20",
            "end_date": "2026-04-20"
        }
    }
    resp = client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 201:
        print("   [OK] Job created successfully.")
        job_id = resp.data['job']['id']
    else:
        print(f"   [ERROR] Failed to create job: {resp.data}")
        return

    # 3. Test List API
    print("2. Testing /api/portfolio/whale-service/jobs/ ...")
    resp_list = client.get('/api/portfolio/whale-service/jobs/')
    print(f"   Status: {resp_list.status_code}, count: {len(resp_list.data)}")
    if resp_list.status_code == 200 and len(resp_list.data) >= 1:
        print("   [OK] List returned successfully.")
    else:
        print(f"   [ERROR] List failed!")

    # 4. Test Status API
    print(f"3. Testing /api/portfolio/whale-service/jobs/{job_id}/ ...")
    resp_status = client.get(f'/api/portfolio/whale-service/jobs/{job_id}/')
    print(f"   Status: {resp_status.status_code}, Job ID: {resp_status.data.get('id')}")
    if resp_status.status_code == 200 and resp_status.data.get('id') == job_id:
        print("   [OK] Status returned successfully.")
    else:
        print(f"   [ERROR] Status failed!")

    # 5. Test Permissions (Free User)
    print("4. Testing Permissions (Free User) ...")
    UserConfig.objects.filter(user=user).update(plan='free')
    
    user_free = User.objects.get(id=user.id)
    client_free = APIClient()
    client_free.force_authenticate(user=user_free)
    resp_forbidden = client_free.post('/api/portfolio/whale-service/trigger/', payload, format='json')
    print(f"   Free user trigger status: {resp_forbidden.status_code}")
    if resp_forbidden.status_code == 403:
        print("   [OK] Correctly blocked free user.")
    else:
        print(f"   [ERROR] Failed to block free user!")

    # Cleanup
    User.objects.filter(username=username).delete()
    WhaleServiceJob.objects.all().delete()
    print("   Cleaned up test data.")

if __name__ == "__main__":
    verify()
