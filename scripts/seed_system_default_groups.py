#!/usr/bin/env python
"""
Seed System Default Groups into GlobalSymbolRegistry.

This script initializes the GlobalSymbolRegistry with system default groups
(VN30, VN100) and exchange groups (HOSE, HNX, UPCOM) by fetching symbols
from vnbroker and syncing them via the registry functions.

Usage:
    python scripts/seed_system_default_groups.py
    python scripts/seed_system_default_groups.py --full-market
"""

import os
import sys
import django
from typing import List

# Setup Django
backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'packages', 'core', 'backend')
sys.path.insert(0, os.path.join(backend_path, 'src'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
os.environ.setdefault('DJANGO_DEBUG', 'True')
django.setup()

from market_data.global_symbol_registry import (
    sync_system_default_symbol_group,
    sync_admin_group_symbol_set,
)
from market_data.vnbroker_adapter import fetch_symbol_group_members


def seed_system_defaults() -> dict:
    """Seed VN30 and VN100 system default groups."""
    results = {}
    
    for group_id in ('vn30', 'vn100'):
        print(f"Fetching symbols for {group_id.upper()}...")
        try:
            symbols = fetch_symbol_group_members(group_id.upper())
            if symbols:
                synced = sync_system_default_symbol_group(group_id, symbols)
                results[group_id] = {
                    "seeded": len(synced),
                    "symbols": symbols,
                }
                print(f"  [OK] Seeded {len(synced)} symbols for {group_id}")
            else:
                results[group_id] = {"seeded": 0, "warning": "No symbols returned"}
                print(f"  [WARN] No symbols returned for {group_id}")
        except Exception as e:
            results[group_id] = {"seeded": 0, "error": str(e)}
            print(f"  [ERROR] Failed to seed {group_id}: {e}")
    
    return results


def seed_exchange_groups() -> dict:
    """Seed exchange-based groups (HOSE, HNX, UPCOM)."""
    results = {}
    
    for exchange in ('HOSE', 'HNX', 'UPCOM'):
        print(f"Fetching symbols for {exchange}...")
        try:
            symbols = fetch_symbol_group_members(exchange)
            if symbols:
                synced = sync_admin_group_symbol_set(
                    group_name=exchange.lower(),
                    symbols=symbols,
                    group_type="EXCHANGE",
                    description=f"All symbols on {exchange}",
                )
                results[exchange] = {
                    "seeded": len(synced),
                    "symbols": symbols,
                }
                print(f"  [OK] Seeded {len(synced)} symbols for {exchange}")
            else:
                results[exchange] = {"seeded": 0, "warning": "No symbols returned"}
                print(f"  [WARN] No symbols returned for {exchange}")
        except Exception as e:
            results[exchange] = {"seeded": 0, "error": str(e)}
            print(f"  [ERROR] Failed to seed {exchange}: {e}")
    
    return results


def seed_index_groups() -> dict:
    """Seed index groups (VN30, VN100, VN50)."""
    results = {}
    
    for index_name in ('VN30', 'VN100', 'VN50'):
        print(f"Fetching symbols for index {index_name}...")
        try:
            symbols = fetch_symbol_group_members(index_name)
            if symbols:
                synced = sync_admin_group_symbol_set(
                    group_name=index_name.lower(),
                    symbols=symbols,
                    group_type="INDEX",
                    description=f"Index: {index_name}",
                )
                results[index_name] = {
                    "seeded": len(synced),
                    "symbols": symbols,
                }
                print(f"  [OK] Seeded {len(synced)} symbols for {index_name}")
            else:
                results[index_name] = {"seeded": 0, "warning": "No symbols returned"}
                print(f"  [WARN] No symbols returned for {index_name}")
        except Exception as e:
            results[index_name] = {"seeded": 0, "error": str(e)}
            print(f"  [ERROR] Failed to seed {index_name}: {e}")
    
    return results


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Seed system default groups into GlobalSymbolRegistry')
    parser.add_argument('--full-market', action='store_true', 
                        help='Also seed exchange and index groups (not just system defaults)')
    parser.add_argument('--exchanges-only', action='store_true',
                        help='Only seed exchange groups (HOSE, HNX, UPCOM)')
    parser.add_argument('--indexes-only', action='store_true',
                        help='Only seed index groups (VN30, VN100, VN50)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Seeding System Default Groups into GlobalSymbolRegistry")
    print("=" * 60)
    
    all_results = {}
    
    # Always seed system defaults (VN30, VN100)
    print("\n[1/3] Seeding System Default Groups (VN30, VN100)...")
    all_results['system_defaults'] = seed_system_defaults()
    
    if args.full_market or args.exchanges_only:
        print("\n[2/3] Seeding Exchange Groups (HOSE, HNX, UPCOM)...")
        all_results['exchanges'] = seed_exchange_groups()
    
    if args.full_market or args.indexes_only:
        print("\n[3/3] Seeding Index Groups (VN30, VN100, VN50)...")
        all_results['indexes'] = seed_index_groups()
    
    # Summary
    print("\n" + "=" * 60)
    print("SEEDING SUMMARY")
    print("=" * 60)
    
    total_seeded = 0
    for category, results in all_results.items():
        print(f"\n{category.upper()}:")
        for group, result in results.items():
            if 'error' in result:
                print(f"  {group}: [ERROR] {result['error']}")
            elif 'warning' in result:
                print(f"  {group}: [WARN] {result['warning']}")
            else:
                count = result.get('seeded', 0)
                total_seeded += count
                print(f"  {group}: [OK] {count} symbols")
    
    print(f"\nTotal symbols seeded: {total_seeded}")
    print("=" * 60)
    
    # Return non-zero exit code if any errors
    has_errors = any(
        'error' in result 
        for results in all_results.values() 
        for result in results.values()
    )
    
    if has_errors:
        print("\n[WARN] Some groups failed to seed. Check logs above.")
        sys.exit(1)
    else:
        print("\n[OK] All groups seeded successfully!")
        sys.exit(0)


if __name__ == '__main__':
    main()
