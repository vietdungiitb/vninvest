import os
import django
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from portfolio.models import WhaleServiceJob
from portfolio.whale_service_manager import WhaleJobManager

def verify():
    print("--- Verification Report: Phase 2 Orchestration ---")
    
    params = {"symbol": "FPT", "user_id": 1}
    service_type = WhaleServiceJob.ServiceType.USER_REFRESH
    
    # 1. Test Creation & Idempotency
    print("1. Testing Creation & Idempotency...")
    job1, created1, status1 = WhaleJobManager.get_or_create_job(service_type, params)
    print(f"   Job 1: id={job1.id}, created={created1}, status={status1}")
    
    job2, created2, status2 = WhaleJobManager.get_or_create_job(service_type, params)
    print(f"   Job 2: id={job2.id}, created={created2}, status={status2}")
    
    if not created2 and job1.id == job2.id and status2 == 'duplicate':
        print("   [OK] Idempotency check passed.")
    else:
        print("   [ERROR] Idempotency check failed!")

    # 2. Test Lock Conflict (Different params but same lock key - if possible)
    # Actually for USER_REFRESH, idempotency and lock key are usually the same
    # Let's try GLOBAL_RECOMPUTE with overlapping symbols
    print("2. Testing Lock Conflict...")
    g_params1 = {"symbols": ["FPT", "VNM"]}
    g_service = WhaleServiceJob.ServiceType.GLOBAL_RECOMPUTE
    
    g_job1, g_created1, g_status1 = WhaleJobManager.get_or_create_job(g_service, g_params1)
    print(f"   Global Job 1: id={g_job1.id}, status={g_status1}")
    
    g_job2, g_created2, g_status2 = WhaleJobManager.get_or_create_job(g_service, g_params1)
    print(f"   Global Job 2: id={g_job2.id}, status={g_status2}")
    
    if g_status2 == 'duplicate':
         print("   [OK] Lock conflict / Duplicate check passed.")
    else:
         print("   [ERROR] Lock conflict check failed!")

    # 3. Test Status Transition (Start -> Heartbeat -> Finish)
    print("3. Testing Lifecycle...")
    task_id = "test-task-123"
    started, msg = WhaleJobManager.start_job(job1.id, task_id)
    print(f"   Start Job: {started}, {msg}")
    
    if started:
        # Check status in DB
        job1.refresh_from_db()
        print(f"   Status after start: {job1.status}")
        
        hb = WhaleJobManager.heartbeat(job1.id, task_id)
        print(f"   Heartbeat: {hb}")
        
        WhaleJobManager.update_progress(job1.id, 50.0, processed=10, total=20)
        job1.refresh_from_db()
        print(f"   Progress: {job1.progress_pct}%, Processed: {job1.processed_items}")
        
        finished = WhaleJobManager.finish_job(job1.id, task_id, WhaleServiceJob.StatusChoices.COMPLETED, "Done test")
        print(f"   Finish Job: {finished}")
        
        job1.refresh_from_db()
        print(f"   Final Status: {job1.status}")
        
        if job1.status == WhaleServiceJob.StatusChoices.COMPLETED:
            print("   [OK] Lifecycle passed.")
        else:
            print("   [ERROR] Lifecycle failed!")
    else:
        print("   [ERROR] Could not start job!")

    # Cleanup
    WhaleServiceJob.objects.all().delete()
    print("   Cleaned up test data.")

if __name__ == "__main__":
    verify()
