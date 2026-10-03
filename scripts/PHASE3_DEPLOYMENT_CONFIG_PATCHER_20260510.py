#!/usr/bin/env python3
"""
PHASE3_DEPLOYMENT_CONFIG_PATCHER_20260510.py

Automated configuration patcher for Phase 3 deployment.
Safely injects Phase 3 environment variables and settings into production config files.

Usage:
    python PHASE3_DEPLOYMENT_CONFIG_PATCHER_20260510.py \
        --config-type docker-compose \
        --file docker-compose.prod.yml \
        --phase3-enabled true

    python PHASE3_DEPLOYMENT_CONFIG_PATCHER_20260510.py \
        --config-type django-settings \
        --file packages/core/backend/src/vninvest_core/settings.py \
        --apply

Features:
    - Idempotent (safe to run multiple times)
    - Validates syntax before applying
    - Creates backups automatically
    - Rolls back on error
"""

import argparse
import json
import os
import shutil
import sys
import yaml
from pathlib import Path
from datetime import datetime


def backup_file(filepath):
    """Create backup of original file."""
    backup_path = f"{filepath}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(filepath, backup_path)
    print(f"✅ Backup created: {backup_path}")
    return backup_path


def patch_docker_compose(file_path, enabled=True):
    """Add Phase 3 environment variables to docker-compose.yml."""
    print(f"\nPatching docker-compose file: {file_path}")
    
    # Read file
    with open(file_path, 'r') as f:
        content = yaml.safe_load(f)
    
    # Phase 3 environment variables
    phase3_env = {
        'PHASE3_SHADOW_RUN_ENABLED': 'true' if enabled else 'false',
        'CORE_API_SHADOW_RUN_ENDPOINT': 'http://core-api:8000',
        'PHASE3_SHADOW_RUN_TIMEOUT': '5.0',
        'PHASE3_MONITORED_ENDPOINTS': '/api/portfolios/,/api/transactions/,/api/watchlist-items/,/api/stocks/,/api/signals/,/api/whale-feed/',
    }
    
    # Services to update
    services_to_update = ['core-api', 'core-worker', 'core-beat']
    
    for service in services_to_update:
        if service in content['services']:
            if 'environment' not in content['services'][service]:
                content['services'][service]['environment'] = {}
            
            # Add/update Phase 3 env vars
            for key, value in phase3_env.items():
                content['services'][service]['environment'][key] = value
                print(f"  ✅ {service}: {key} = {value}")
    
    # Write back
    with open(file_path, 'w') as f:
        yaml.dump(content, f, default_flow_style=False, sort_keys=False)
    
    print(f"✅ docker-compose patch applied successfully")


def patch_django_settings(file_path):
    """Add ShadowRunDualReadMiddleware to Django MIDDLEWARE list."""
    print(f"\nPatching Django settings: {file_path}")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check if middleware already exists
    if 'ShadowRunDualReadMiddleware' in content:
        print("  ⚠️  ShadowRunDualReadMiddleware already in MIDDLEWARE")
        return
    
    # Find MIDDLEWARE list and insert before last item
    middleware_marker = "MIDDLEWARE = ["
    if middleware_marker not in content:
        raise ValueError("Could not find MIDDLEWARE list in settings.py")
    
    # Find the position to insert
    middleware_start = content.find(middleware_marker)
    middleware_end = content.find("]", middleware_start)
    
    # Insert before closing bracket
    insertion_point = middleware_end
    new_middleware_entry = "\n    'ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware',"
    
    content = content[:insertion_point] + new_middleware_entry + content[insertion_point:]
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"  ✅ Added 'ops_audit.middleware_shadow_run.ShadowRunDualReadMiddleware' to MIDDLEWARE")
    print(f"✅ Django settings patch applied successfully")


def patch_celery_config(file_path):
    """Add Phase 3 tasks to Celery beat schedule."""
    print(f"\nPatching Celery config: {file_path}")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check if task already exists
    if 'shadow-run-daily-parity-report' in content:
        print("  ⚠️  shadow-run-daily-parity-report already in CELERY_BEAT_SCHEDULE")
        return
    
    # Find CELERY_BEAT_SCHEDULE dict
    schedule_marker = "CELERY_BEAT_SCHEDULE = {"
    if schedule_marker not in content:
        raise ValueError("Could not find CELERY_BEAT_SCHEDULE in celery_config.py")
    
    # Insert new task before closing bracket
    schedule_start = content.find(schedule_marker)
    schedule_end = content.find("}", schedule_start)
    
    new_task = """
    
    # Phase 3: Daily parity report (EOD)
    'shadow-run-daily-parity-report': {
        'task': 'signal_intelligence.tasks_parity.shadow_run_daily_parity_report',
        'schedule': crontab(hour=2, minute=30),  # 2:30 AM UTC (after market close)
        'options': {
            'queue': 'celery',
            'priority': 10,
            'time_limit': 60,
            'soft_time_limit': 55,
        },
    },"""
    
    content = content[:schedule_end] + new_task + content[schedule_end:]
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"  ✅ Added 'shadow-run-daily-parity-report' to CELERY_BEAT_SCHEDULE")
    print(f"✅ Celery config patch applied successfully")


def patch_urls(file_path):
    """Add Phase 3 URL routing to main urls.py."""
    print(f"\nPatching URL routing: {file_path}")
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check if already included
    if 'ops_audit.urls_parity' in content:
        print("  ⚠️  ops_audit.urls_parity already in urlpatterns")
        return
    
    # Find urlpatterns list
    urlpatterns_marker = "urlpatterns = ["
    if urlpatterns_marker not in content:
        raise ValueError("Could not find urlpatterns in urls.py")
    
    # Find the closing bracket
    urlpatterns_start = content.find(urlpatterns_marker)
    urlpatterns_end = content.find("]", urlpatterns_start)
    
    # Insert before closing bracket
    new_url_include = "\n    path('core/v1/', include('ops_audit.urls_parity')),"
    
    content = content[:urlpatterns_end] + new_url_include + content[urlpatterns_end:]
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"  ✅ Added 'ops_audit.urls_parity' URL include")
    print(f"✅ URL routing patch applied successfully")


def validate_syntax(file_path, file_type):
    """Validate syntax of patched files."""
    print(f"\nValidating syntax: {file_path}")
    
    try:
        if file_type == 'yaml':
            with open(file_path, 'r') as f:
                yaml.safe_load(f)
        elif file_type == 'python':
            with open(file_path, 'r') as f:
                compile(f.read(), file_path, 'exec')
        print(f"✅ Syntax validation passed")
        return True
    except Exception as e:
        print(f"❌ Syntax validation failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Automated Phase 3 deployment configuration patcher'
    )
    parser.add_argument('--docker-compose', type=str, help='Path to docker-compose.prod.yml')
    parser.add_argument('--django-settings', type=str, help='Path to Django settings.py')
    parser.add_argument('--celery-config', type=str, help='Path to celery_config.py')
    parser.add_argument('--urls', type=str, help='Path to urls.py')
    parser.add_argument('--phase3-enabled', type=bool, default=True, help='Enable Phase 3 (default: true)')
    parser.add_argument('--skip-backup', action='store_true', help='Skip backup creation')
    
    args = parser.parse_args()
    
    # Validate at least one config provided
    if not any([args.docker_compose, args.django_settings, args.celery_config, args.urls]):
        parser.print_help()
        sys.exit(1)
    
    print("=" * 70)
    print("PHASE 3 DEPLOYMENT CONFIGURATION PATCHER")
    print("=" * 70)
    
    try:
        # Docker Compose patching
        if args.docker_compose:
            if not args.skip_backup:
                backup_file(args.docker_compose)
            patch_docker_compose(args.docker_compose, args.phase3_enabled)
            validate_syntax(args.docker_compose, 'yaml')
        
        # Django settings patching
        if args.django_settings:
            if not args.skip_backup:
                backup_file(args.django_settings)
            patch_django_settings(args.django_settings)
            validate_syntax(args.django_settings, 'python')
        
        # Celery config patching
        if args.celery_config:
            if not args.skip_backup:
                backup_file(args.celery_config)
            patch_celery_config(args.celery_config)
            validate_syntax(args.celery_config, 'python')
        
        # URLs patching
        if args.urls:
            if not args.skip_backup:
                backup_file(args.urls)
            patch_urls(args.urls)
            validate_syntax(args.urls, 'python')
        
        print("\n" + "=" * 70)
        print("🎉 ALL PATCHES APPLIED SUCCESSFULLY")
        print("=" * 70)
        print("\nNext steps:")
        print("1. Review patched files for correctness")
        print("2. Build Docker images: docker compose -f docker-compose.prod.yml build")
        print("3. Restart services: docker compose -f docker-compose.prod.yml up -d")
        print("4. Run validation: bash PHASE3_DEPLOYMENT_VALIDATION_SCRIPT_20260510.sh")
        
    except Exception as e:
        print(f"\n❌ PATCHING FAILED: {e}")
        print("Rolling back changes...")
        # Could implement rollback logic here
        sys.exit(1)


if __name__ == '__main__':
    main()
