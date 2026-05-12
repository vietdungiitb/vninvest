#!/usr/bin/env python3
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
os.environ['DJANGO_DEBUG'] = 'true'

django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Delete ALL migrations between 0039 and 0077 that reference missing parent migrations
    cursor.execute("""
        SELECT id, app, name FROM django_migrations 
        WHERE app = 'portfolio' 
        AND name NOT IN (
            '0001_initial', '0002_auto_20200801_0014', '0003_auto_20200802_0027',
            '0004_auto_20200818_0114', '0005_auto_20200905_2356', '0006_auto_20210101_0000',
            '0007_auto_20210101_0001', '0008_auto_20210101_0002', '0009_auto_20210101_0003',
            '0010_auto_20210101_0004', '0011_auto_20210101_0005', '0012_auto_20210101_0006',
            '0013_auto_20210101_0007', '0014_auto_20210101_0008', '0015_auto_20210101_0009',
            '0016_auto_20210101_0010', '0017_auto_20210101_0011', '0018_auto_20210101_0012',
            '0019_auto_20210101_0013', '0020_auto_20210101_0014', '0021_auto_20210101_0015',
            '0022_auto_20210101_0016', '0023_auto_20210101_0017', '0024_auto_20210101_0018',
            '0025_auto_20210101_0019', '0026_auto_20210101_0020', '0027_auto_20210101_0021',
            '0028_auto_20210101_0022', '0029_auto_20210101_0023', '0030_auto_20210101_0024',
            '0031_auto_20210101_0025', '0032_auto_20210101_0026', '0033_auto_20210101_0027',
            '0034_auto_20210101_0028', '0035_auto_20210101_0029', '0036_auto_20210101_0030',
            '0037_initial', '0038_initial', '0039_initial', '0040_initial', 
            '0041_initial', '0042_initial', '0043_initial', '0044_initial', '0045_initial',
            '0046_initial', '0047_initial', '0048_initial', '0049_initial', '0050_initial',
            '0051_initial', '0052_initial', '0053_initial', '0054_initial', '0055_initial',
            '0056_initial', '0057_initial', '0058_initial', '0059_initial', '0060_initial',
            '0061_initial', '0062_initial', '0063_initial', '0064_initial', '0065_initial',
            '0066_userconfig_ai_prompt_config_and_more', 
            '0067_coretenant', 
            '0068_rename_portfolio_c_status_4cc731_idx_portfolio_c_status_3f2e9e_idx',
            '0069_partition_intradaytick',
            '0070_allow_null_whale_alert_threshold_million',
            '0071_rename_vnstock_to_vnbroker_config',
            '0072_add_dnse_credential_fixed',
            '0073_subaccount_external_sync_fields',
            '0074_account_snapshot_sync_fields',
            '0075_account_snapshot_defaults',
            '0076_transaction_reconciliation_fields',
            '0077_runtimevnbrokerconfig_source_config'
        )
        AND id > 200
        AND id < 250
        ORDER BY id DESC
    """)
    bad_rows = cursor.fetchall()
    
    if bad_rows:
        print("Problematic migrations found:")
        for row in bad_rows:
            print(f"  ID {row[0]}: {row[1]}.{row[2]}")
        
        # Delete these
        cursor.execute("""
            DELETE FROM django_migrations
            WHERE app = 'portfolio' 
            AND id > 200 AND id < 250
            AND name NOT IN (
                '0066_userconfig_ai_prompt_config_and_more', '0067_coretenant',
                '0068_rename_portfolio_c_status_4cc731_idx_portfolio_c_status_3f2e9e_idx',
                '0069_partition_intradaytick', '0070_allow_null_whale_alert_threshold_million',
                '0071_rename_vnstock_to_vnbroker_config', '0072_add_dnse_credential_fixed',
                '0073_subaccount_external_sync_fields', '0074_account_snapshot_sync_fields',
                '0075_account_snapshot_defaults', '0076_transaction_reconciliation_fields',
                '0077_runtimevnbrokerconfig_source_config'
            )
        """)
        print(f"\nDeleted {cursor.rowcount} bad migration entries")
    else:
        print("No bad migrations in the 200-250 range")
