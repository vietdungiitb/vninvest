import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='ServiceDefinition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('service_key', models.CharField(max_length=80, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('domain', models.CharField(choices=[('vnbroker', 'VNBroker Data'), ('prefetch', 'Prefetch & Cache'), ('signals', 'Signal Intelligence'), ('screener', 'Global Screener'), ('matrix', 'Symbol Matrix'), ('platform', 'Platform Internal')], max_length=40)),
                ('description', models.TextField(blank=True)),
                ('owner_team', models.CharField(default='core', max_length=80)),
                ('tags', models.JSONField(default=list)),
                ('is_active', models.BooleanField(default=True)),
                ('is_deprecated', models.BooleanField(default=False)),
                ('deprecation_note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Service Definition',
                'verbose_name_plural': 'Service Definitions',
                'ordering': ['domain', 'service_key'],
            },
        ),
        migrations.CreateModel(
            name='OwnershipRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(max_length=40, unique=True)),
                ('owner_team', models.CharField(max_length=80)),
                ('write_mode', models.CharField(choices=[('canonical', 'Canonical Writer'), ('native-write', 'Native Write'), ('bridge-write', 'Bridge Write'), ('read-only', 'Read Only'), ('deprecated', 'Deprecated')], max_length=40)),
                ('write_surface', models.CharField(blank=True, max_length=200)),
                ('locked_fields', models.JSONField(default=list)),
                ('compatibility_domains', models.JSONField(default=list)),
                ('deprecation_notes', models.TextField(blank=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Ownership Record',
                'verbose_name_plural': 'Ownership Records',
                'ordering': ['domain'],
            },
        ),
        migrations.CreateModel(
            name='ServiceHealth',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('healthy', 'Healthy'), ('degraded', 'Degraded'), ('unhealthy', 'Unhealthy'), ('unknown', 'Unknown'), ('maintenance', 'Maintenance')], default='unknown', max_length=20)),
                ('last_check_at', models.DateTimeField(auto_now=True)),
                ('last_success_at', models.DateTimeField(blank=True, null=True)),
                ('consecutive_failures', models.IntegerField(default=0)),
                ('avg_response_ms', models.FloatField(blank=True, null=True)),
                ('detail', models.JSONField(default=dict)),
                ('service', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='health', to='service_ops.servicedefinition')),
            ],
            options={
                'verbose_name': 'Service Health',
                'verbose_name_plural': 'Service Health Records',
            },
        ),
        migrations.CreateModel(
            name='ServiceConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('config_schema_version', models.CharField(default='1.0', max_length=20)),
                ('config_payload', models.JSONField()),
                ('applied_by', models.CharField(blank=True, max_length=120)),
                ('applied_at', models.DateTimeField(auto_now_add=True)),
                ('change_reason', models.TextField(blank=True)),
                ('is_current', models.BooleanField(db_index=True, default=True)),
                ('service', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='configs', to='service_ops.servicedefinition')),
            ],
            options={
                'verbose_name': 'Service Config',
                'verbose_name_plural': 'Service Configs',
                'ordering': ['-applied_at'],
            },
        ),
        migrations.CreateModel(
            name='ServiceRunLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('celery_task_id', models.CharField(blank=True, db_index=True, max_length=200)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('running', 'Running'), ('success', 'Success'), ('partial', 'Partial Success'), ('failed', 'Failed'), ('skipped', 'Skipped')], default='queued', max_length=20)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('duration_seconds', models.FloatField(blank=True, null=True)),
                ('input_summary', models.JSONField(default=dict)),
                ('output_summary', models.JSONField(default=dict)),
                ('error_detail', models.TextField(blank=True)),
                ('service', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='run_logs', to='service_ops.servicedefinition')),
            ],
            options={
                'verbose_name': 'Service Run Log',
                'verbose_name_plural': 'Service Run Logs',
                'ordering': ['-started_at'],
            },
        ),
        migrations.CreateModel(
            name='ConfigChangeAudit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('apply', 'Config Applied'), ('preview', 'Preview Generated'), ('rollback', 'Config Rolled Back'), ('force_apply', 'Force Applied')], max_length=20)),
                ('actor', models.CharField(max_length=120)),
                ('actor_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('before_snapshot', models.JSONField(blank=True, null=True)),
                ('after_snapshot', models.JSONField(blank=True, null=True)),
                ('change_summary', models.TextField(blank=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('request_id', models.CharField(blank=True, max_length=64)),
                ('service', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='change_audits', to='service_ops.servicedefinition')),
            ],
            options={
                'verbose_name': 'Config Change Audit',
                'verbose_name_plural': 'Config Change Audits',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='servicedefinition',
            index=models.Index(fields=['domain', 'is_active'], name='service_ops_domain_is_active_idx'),
        ),
        migrations.AddIndex(
            model_name='serviceconfig',
            index=models.Index(fields=['service', 'is_current'], name='service_ops_config_current_idx'),
        ),
        migrations.AddIndex(
            model_name='servicerunlog',
            index=models.Index(fields=['service', 'status'], name='service_ops_runlog_status_idx'),
        ),
        migrations.AddIndex(
            model_name='servicerunlog',
            index=models.Index(fields=['service', 'started_at'], name='service_ops_runlog_started_idx'),
        ),
        migrations.AddIndex(
            model_name='servicehealth',
            index=models.Index(fields=['status'], name='service_ops_health_status_idx'),
        ),
        migrations.AddIndex(
            model_name='configchangeaudit',
            index=models.Index(fields=['service', 'timestamp'], name='service_ops_audit_svc_ts_idx'),
        ),
        migrations.AddIndex(
            model_name='configchangeaudit',
            index=models.Index(fields=['actor', 'timestamp'], name='service_ops_audit_actor_ts_idx'),
        ),
    ]
