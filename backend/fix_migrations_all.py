#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
os.environ['DJANGO_DEBUG'] = 'true'

django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Find ALL stale/orphaned migrations
    cursor.execute("""
        SELECT id, app, name FROM django_migrations 
        WHERE app = 'portfolio' 
        ORDER BY id DESC
        LIMIT 15
    """)
    rows = cursor.fetchall()
    print("Recent portfolio migrations:")
    for row in rows:
        print(f"  ID {row[0]}: {row[1]}.{row[2]}")
    
    # Delete any migration referencing the missing 0039
    cursor.execute("""
        SELECT id, app, name FROM django_migrations 
        WHERE app = 'portfolio' AND (
            name LIKE '%sprint35%' OR name = '0039_sprint35_portfolio_news_digest' OR 
            name = '0040_add_system_setting'
        )
        ORDER BY id
    """)
    bad_rows = cursor.fetchall()
    
    if bad_rows:
        print("\nFound problematic migrations to remove:")
        for row in bad_rows:
            print(f"  ID {row[0]}: {row[1]}.{row[2]}")
        
        cursor.execute("""
            DELETE FROM django_migrations
            WHERE app = 'portfolio' AND (
                name LIKE '%sprint35%' OR 
                name = '0040_add_system_setting'
            )
        """)
        print(f"\nDeleted {cursor.rowcount} problematic migration(s)")
    else:
        print("\nNo problematic migrations found")
