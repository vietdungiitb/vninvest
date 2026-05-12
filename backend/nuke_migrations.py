#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
os.environ['DJANGO_DEBUG'] = 'true'

django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # First, get count of all portfolio migrations
    cursor.execute("SELECT COUNT(*) FROM django_migrations WHERE app = 'portfolio'")
    print(f"Total portfolio migrations in DB: {cursor.fetchone()[0]}")
    
    # Delete everything between 0040 and 0066 (the problematic range)
    cursor.execute("""
        SELECT COUNT(*) FROM django_migrations
        WHERE app = 'portfolio'
        AND id BETWEEN 200 AND 210
    """)
    print(f"Migrations in ID range 200-210 to delete: {cursor.fetchone()[0]}")
    
    cursor.execute("""
        DELETE FROM django_migrations
        WHERE app = 'portfolio'
        AND id BETWEEN 200 AND 210
    """)
    print(f"Deleted {cursor.rowcount} entries")
    
    # Verify
    cursor.execute("""
        SELECT COUNT(*) FROM django_migrations WHERE app = 'portfolio'
    """)
    print(f"Remaining portfolio migrations: {cursor.fetchone()[0]}")
