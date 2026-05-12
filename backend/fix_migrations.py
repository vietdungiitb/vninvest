#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
os.environ['DJANGO_DEBUG'] = 'true'

django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Find problematic migrations
    cursor.execute("""
        SELECT id, app, name FROM django_migrations 
        WHERE (app = 'portfolio' AND name IN ('0038_runtimevnbrokerconfig', '0039_sprint35_portfolio_news_digest'))
        ORDER BY id
    """)
    rows = cursor.fetchall()
    print("Found stale migrations:")
    for row in rows:
        print(f"  ID {row[0]}: {row[1]}.{row[2]}")
    
    # Delete stale entries
    if rows:
        cursor.execute("""
            DELETE FROM django_migrations
            WHERE (app = 'portfolio' AND name IN ('0038_runtimevnbrokerconfig', '0039_sprint35_portfolio_news_digest'))
        """)
        print(f"\nDeleted {cursor.rowcount} stale migration(s)")
    else:
        print("No stale migrations found")
