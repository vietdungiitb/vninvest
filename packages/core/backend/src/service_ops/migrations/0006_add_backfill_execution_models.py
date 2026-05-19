"""
B02 — Backfill Progress Persistence
Add BackfillExecutionRun and BackfillExecutionBatch models.
"""

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0005_add_dataops_domain_choice'),
    ]

    operations = [
        migrations.CreateModel(
            name='BackfillExecutionRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('run_id', models.CharField(db_index=True, max_length=120, unique=True)),
                ('job_key', models.CharField(blank=True, db_index=True, max_length=120)),
                ('service_run_log', models.OneToOneField(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='backfill_execution_run',
                    to='service_ops.servicerunlog',
                )),
                ('mode', models.CharField(
                    choices=[
                        ('daily_delta', 'Daily Delta'),
                        ('repair_missing', 'Repair Missing'),
                        ('deep_bootstrap', 'Deep Bootstrap'),
                        ('targeted_symbol_repair', 'Targeted Symbol Repair'),
                    ],
                    default='daily_delta',
                    max_length=40,
                )),
                ('trigger', models.CharField(
                    choices=[
                        ('beat_schedule', 'Beat Schedule'),
                        ('operator_run_now', 'Operator Run Now'),
                        ('auto_promotion_fast_path', 'Auto Promotion Fast Path'),
                        ('repair_guard', 'Repair Guard'),
                    ],
                    default='beat_schedule',
                    max_length=40,
                )),
                ('status', models.CharField(
                    choices=[
                        ('queued', 'Queued'),
                        ('running', 'Running'),
                        ('partial', 'Partial Success'),
                        ('success', 'Success'),
                        ('failed', 'Failed'),
                        ('aborted', 'Aborted'),
                    ],
                    db_index=True,
                    default='queued',
                    max_length=20,
                )),
                ('requested_days', models.IntegerField(default=0)),
                ('planned_symbols_count', models.IntegerField(default=0)),
                ('completed_symbols_count', models.IntegerField(default=0)),
                ('failed_symbols_count', models.IntegerField(default=0)),
                ('inserted_rows', models.IntegerField(default=0)),
                ('updated_rows', models.IntegerField(default=0)),
                ('skipped_existing_rows', models.IntegerField(default=0)),
                ('started_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('eta_seconds', models.FloatField(blank=True, null=True)),
                ('summary', models.JSONField(default=dict)),
                ('error_summary', models.TextField(blank=True)),
            ],
            options={
                'verbose_name': 'Backfill Execution Run',
                'verbose_name_plural': 'Backfill Execution Runs',
                'ordering': ['-started_at'],
                'indexes': [
                    models.Index(fields=['job_key', 'status'], name='svc_ber_jobkey_status_idx'),
                    models.Index(fields=['job_key', 'started_at'], name='svc_ber_jobkey_started_idx'),
                    models.Index(fields=['status', 'started_at'], name='svc_ber_status_started_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='BackfillExecutionBatch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('run', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='batches',
                    to='service_ops.backfillexecutionrun',
                )),
                ('provider', models.CharField(db_index=True, max_length=40)),
                ('batch_index', models.IntegerField(default=0)),
                ('state', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('running', 'Running'),
                        ('done', 'Done'),
                        ('failed', 'Failed'),
                        ('skipped', 'Skipped'),
                    ],
                    db_index=True,
                    default='pending',
                    max_length=20,
                )),
                ('current_symbol', models.CharField(blank=True, max_length=20)),
                ('symbols_count', models.IntegerField(default=0)),
                ('completed_symbols_count', models.IntegerField(default=0)),
                ('inserted_rows', models.IntegerField(default=0)),
                ('updated_rows', models.IntegerField(default=0)),
                ('skipped_existing_rows', models.IntegerField(default=0)),
                ('failed_symbols', models.JSONField(default=list)),
                ('latency_p50_ms', models.FloatField(default=0.0)),
                ('latency_p95_ms', models.FloatField(default=0.0)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'Backfill Execution Batch',
                'verbose_name_plural': 'Backfill Execution Batches',
                'ordering': ['batch_index'],
                'indexes': [
                    models.Index(fields=['run', 'state'], name='svc_beb_run_state_idx'),
                ],
                'unique_together': {('run', 'provider')},
            },
        ),
    ]
