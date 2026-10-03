#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
django.setup()

from django.db import models
from portfolio.models import Portfolio, Transaction, WatchlistGroup, PriceAlertRule

# Check if these models have tenant FK
print("=== Data Model Tenant FK Isolation Audit ===\n")

models_to_check = [
    ('Portfolio', Portfolio),
    ('Transaction', Transaction),
    ('WatchlistGroup', WatchlistGroup),
    ('PriceAlertRule', PriceAlertRule),
]

for name, model_class in models_to_check:
    print(f"{name}:")
    fields = [f for f in model_class._meta.get_fields()]
    
    has_tenant_fk = False
    for f in fields:
        if 'tenant' in f.name.lower() and hasattr(f, 'model'):
            print(f"  ✓ Has tenant FK: {f.name}")
            has_tenant_fk = True
    
    has_user_fk = False
    for f in fields:
        if f.name == 'user' and hasattr(f, 'model'):
            print(f"  → Has user FK (indirect tenant via User→CoreTenant)")
            has_user_fk = True
    
    if not has_tenant_fk and not has_user_fk:
        print(f"  ✗ No tenant isolation FK found")
    
    print()
