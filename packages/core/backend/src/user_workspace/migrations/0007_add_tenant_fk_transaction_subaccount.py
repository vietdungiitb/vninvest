# Generated manually for SAAS-TDB-P1-T01
# Adds tenant FK to Transaction and SubAccount models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0006_backfill_watchlist_tenant'),
        ('identity_access', '0004_tenantmember_tenantinvite'),
    ]

    operations = [
        # Step 1: Add tenant FK to Transaction
        migrations.AddField(
            model_name='transaction',
            name='tenant',
            field=models.ForeignKey(
                blank=True,
                help_text='Tenant owner. Set from portfolio.tenant or directly.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='transactions',
                to='identity_access.coretenant',
                verbose_name='Người dùng SaaS (Tenant)',
                db_index=True,
            ),
        ),
        
        # Step 2: Add tenant FK to SubAccount
        migrations.AddField(
            model_name='subaccount',
            name='tenant',
            field=models.ForeignKey(
                blank=True,
                help_text='Tenant owner. Set from portfolio.tenant or user primary tenant.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='sub_accounts',
                to='identity_access.coretenant',
                verbose_name='Người dùng SaaS (Tenant)',
                db_index=True,
            ),
        ),
        
        # Step 3: Add composite indexes for common query patterns
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(
                fields=['tenant', 'portfolio', 'date'],
                name='user_ws_tx_tenant_portfolio_date_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='subaccount',
            index=models.Index(
                fields=['tenant', 'user'],
                name='user_ws_subaccount_tenant_user_idx',
            ),
        ),
    ]
