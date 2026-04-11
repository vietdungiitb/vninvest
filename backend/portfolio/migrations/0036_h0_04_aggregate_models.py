# Generated migration for Sprint H0 (F4: Holistic Advisory Foundation)
# PR-4: Migration skeleton for AdvisoryAggregateSnapshot + AuditLog models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('portfolio', '0035_sprint34_orderflowsignal_event_id_severity'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdvisoryAggregateSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=10, verbose_name='Mã chứng khoán')),
                ('snapshot_seq', models.PositiveIntegerField(db_index=True, verbose_name='Sequence number for ordering')),
                ('state_json', models.JSONField(default=dict, verbose_name='Aggregate state snapshot (immutable)')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Thời điểm snapshot')),
                ('expires_at', models.DateTimeField(blank=True, db_index=True, null=True, verbose_name='TTL expiry (30d retention policy)')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='advisory_aggregate_snapshots', to=settings.AUTH_USER_MODEL, verbose_name='Người dùng')),
            ],
            options={
                'verbose_name': 'Advisory Aggregate Snapshot',
                'verbose_name_plural': 'Advisory Aggregate Snapshots',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AdvisoryAggregateAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=10, verbose_name='Mã chứng khoán')),
                ('before_state_json', models.JSONField(default=dict, verbose_name='Trạng thái trước')),
                ('after_state_json', models.JSONField(default=dict, verbose_name='Trạng thái sau')),
                ('reason', models.CharField(
                    choices=[
                        ('new_whale_event', 'New whale signal'),
                        ('dark_flow_detected', 'Dark flow detection'),
                        ('threshold_updated', 'Threshold override changed'),
                        ('manual_refresh', 'User requested refresh'),
                        ('auto_generation', 'Automatic generation'),
                        ('state_compaction', 'State cleanup/compaction'),
                    ],
                    db_index=True,
                    max_length=30,
                    verbose_name='Lý do thay đổi'
                )),
                ('actor', models.CharField(
                    choices=[
                        ('system', 'Automated system'),
                        ('user', 'User action'),
                        ('scheduler', 'Periodic job'),
                    ],
                    default='system',
                    max_length=20,
                    verbose_name='Người/hệ thống thực hiện'
                )),
                ('actor_id', models.CharField(blank=True, default='', max_length=100, verbose_name='Actor identifier (user_id, job_id, etc.)')),
                ('metadata_json', models.JSONField(default=dict, verbose_name='Additional context (token_cost, latency_ms, etc.)')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Thời điểm audit')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='advisory_audit_logs', to=settings.AUTH_USER_MODEL, verbose_name='Người dùng')),
            ],
            options={
                'verbose_name': 'Advisory Aggregate Audit Log',
                'verbose_name_plural': 'Advisory Aggregate Audit Logs',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='advisoryaggregatesnapshot',
            index=models.Index(fields=['user', 'symbol', '-created_at'], name='idx_snap_user_symbol_date'),
        ),
        migrations.AddIndex(
            model_name='advisoryaggregatesnapshot',
            index=models.Index(fields=['user', 'expires_at'], name='idx_snap_user_expires'),
        ),
        migrations.AddConstraint(
            model_name='advisoryaggregatesnapshot',
            constraint=models.UniqueConstraint(fields=('user', 'symbol', 'snapshot_seq'), name='unique_snap_user_symbol_seq'),
        ),
        migrations.AddIndex(
            model_name='advisoryaggregateauditlog',
            index=models.Index(fields=['user', 'symbol', '-created_at'], name='idx_audit_user_symbol_date'),
        ),
        migrations.AddIndex(
            model_name='advisoryaggregateauditlog',
            index=models.Index(fields=['reason', 'created_at'], name='idx_audit_reason_date'),
        ),
        migrations.AddIndex(
            model_name='advisoryaggregateauditlog',
            index=models.Index(fields=['user', '-created_at'], name='idx_audit_user_created'),
        ),
    ]
