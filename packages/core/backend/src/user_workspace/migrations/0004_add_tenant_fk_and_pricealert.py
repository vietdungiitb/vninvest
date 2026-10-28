# Generated migration for T10: Data isolation audit + tenant FK addition

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0004_tenantmember_tenantinvite'),  # Latest identity_access migration
        ('user_workspace', '0003_dnse_lightspeed_credential_v2'),
    ]

    operations = [
        # Add tenant FK to Portfolio
        migrations.AddField(
            model_name='portfolio',
            name='tenant',
            field=models.ForeignKey(
                blank=True,
                help_text='Tenant owner of this portfolio. Must be set after migration.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='core_portfolios',
                to='identity_access.coretenant',
                verbose_name='Người dùng SaaS (Tenant)',
            ),
        ),
        # Add tenant FK to Watchlist
        migrations.AddField(
            model_name='watchlist',
            name='tenant',
            field=models.ForeignKey(
                blank=True,
                help_text='Tenant owner of this watchlist. Must be set after migration.',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='core_watchlists',
                to='identity_access.coretenant',
                verbose_name='Người dùng SaaS (Tenant)',
            ),
        ),
        # Create new PriceAlert model
        migrations.CreateModel(
            name='PriceAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('alert_type', models.CharField(
                    choices=[('ABOVE', 'Giá vượt quá'), ('BELOW', 'Giá giảm dưới'), ('EQUAL', 'Bằng giá')],
                    default='ABOVE',
                    max_length=10,
                    verbose_name='Loại cảnh báo',
                )),
                ('price_threshold', models.DecimalField(decimal_places=2, max_digits=18, verbose_name='Ngưỡng giá (VNĐ)')),
                ('status', models.CharField(
                    choices=[('ACTIVE', 'Đang hoạt động'), ('TRIGGERED', 'Đã kích hoạt'), ('EXPIRED', 'Hết hạn'), ('DISABLED', 'Vô hiệu')],
                    db_index=True,
                    default='ACTIVE',
                    max_length=10,
                    verbose_name='Trạng thái',
                )),
                ('is_enabled', models.BooleanField(db_index=True, default=True, verbose_name='Bật/Tắt')),
                ('notify_email', models.BooleanField(default=True, verbose_name='Thông báo qua email')),
                ('notify_sms', models.BooleanField(default=False, verbose_name='Thông báo qua SMS')),
                ('notify_push', models.BooleanField(default=False, verbose_name='Thông báo Push')),
                ('last_triggered_at', models.DateTimeField(blank=True, null=True, verbose_name='Lần kích hoạt cuối')),
                ('legacy_rule_id', models.IntegerField(blank=True, db_index=True, null=True, verbose_name='ID Rule cũ')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(
                    blank=True,
                    help_text='Tenant owner of this price alert. Must be set after migration.',
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='core_price_alerts',
                    to='identity_access.coretenant',
                    verbose_name='Người dùng SaaS (Tenant)',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='core_price_alerts',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Người dùng',
                )),
            ],
            options={
                'verbose_name': 'Cảnh báo giá',
                'verbose_name_plural': 'Cảnh báo giá',
                'ordering': ['-created_at'],
            },
        ),
        # Add indexes for PriceAlert
        migrations.AddIndex(
            model_name='pricealert',
            index=models.Index(fields=['user', 'symbol', 'status'], name='user_workspace_pricealert_user_symbol_status_idx'),
        ),
        migrations.AddIndex(
            model_name='pricealert',
            index=models.Index(fields=['tenant', 'symbol', 'status'], name='user_workspace_pricealert_tenant_symbol_status_idx'),
        ),
    ]
