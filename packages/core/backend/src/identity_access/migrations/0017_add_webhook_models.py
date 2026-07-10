# Generated manually for Phase 4 — Webhook models

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0016_login_attempt'),
    ]

    operations = [
        migrations.CreateModel(
            name='TenantWebhookConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(default='Default', max_length=128)),
                ('url', models.URLField(max_length=512)),
                ('secret', models.CharField(blank=True, default='', max_length=64)),
                ('events', models.JSONField(default=list)),
                ('is_active', models.BooleanField(default=True)),
                ('headers', models.JSONField(blank=True, default=dict)),
                ('retry_count', models.IntegerField(default=3)),
                ('timeout_seconds', models.IntegerField(default=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='webhook_configs', to='identity_access.coretenant')),
            ],
            options={
                'verbose_name': 'Tenant Webhook Config',
                'verbose_name_plural': 'Tenant Webhook Configs',
                'db_table': 'core_tenant_webhook_config',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='WebhookDelivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(max_length=64)),
                ('event_id', models.CharField(db_index=True, max_length=64)),
                ('payload', models.JSONField()),
                ('status', models.CharField(default='pending', max_length=16)),
                ('response_code', models.IntegerField(null=True)),
                ('response_body', models.TextField(blank=True, default='')),
                ('attempts', models.IntegerField(default=0)),
                ('next_retry_at', models.DateTimeField(null=True)),
                ('duration_ms', models.IntegerField(null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('config', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deliveries', to='identity_access.tenantwebhookconfig')),
            ],
            options={
                'verbose_name': 'Webhook Delivery',
                'verbose_name_plural': 'Webhook Deliveries',
                'db_table': 'core_webhook_delivery',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['config', 'created_at'], name='core_webhook_delivery_config_created_idx'),
                    models.Index(fields=['status', 'next_retry_at'], name='core_webhook_delivery_status_retry_idx'),
                ],
            },
        ),
    ]
