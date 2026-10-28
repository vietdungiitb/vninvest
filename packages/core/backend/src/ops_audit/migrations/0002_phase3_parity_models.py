# Generated migration for Phase 3 Shadow Run parity models

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ops_audit', '0001_initial'),  # Adjust to latest ops_audit migration
    ]

    operations = [
        migrations.CreateModel(
            name='ParityLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('x_request_id', models.CharField(db_index=True, help_text='Propagated X-Request-ID across legacy + core', max_length=255)),
                ('endpoint', models.CharField(db_index=True, help_text='API endpoint path (e.g., /api/portfolios/)', max_length=255)),
                ('method', models.CharField(help_text='HTTP method (GET, POST, etc)', max_length=10)),
                ('tenant_id', models.CharField(blank=True, help_text='Tenant ID for multi-tenant isolation', max_length=255)),
                ('legacy_status', models.IntegerField(help_text='HTTP status from legacy backend')),
                ('legacy_response_time_ms', models.FloatField(help_text='Response time in milliseconds')),
                ('legacy_row_count', models.IntegerField(blank=True, help_text='Number of rows in legacy response', null=True)),
                ('legacy_payload_hash', models.CharField(help_text='SHA256 hash of response body', max_length=64)),
                ('core_status', models.IntegerField(help_text='HTTP status from core API')),
                ('core_response_time_ms', models.FloatField(help_text='Response time in milliseconds')),
                ('core_row_count', models.IntegerField(blank=True, help_text='Number of rows in core response', null=True)),
                ('core_payload_hash', models.CharField(help_text='SHA256 hash of response body', max_length=64)),
                ('parity_status', models.CharField(choices=[('match', 'Match'), ('warning', 'Warning'), ('mismatch', 'Mismatch'), ('error', 'Error')], help_text='match | warning | mismatch | error', max_length=20)),
                ('status_match', models.BooleanField(help_text='HTTP status codes match')),
                ('structure_match', models.BooleanField(help_text='JSON structure match')),
                ('row_count_match', models.BooleanField(help_text='Row counts match')),
                ('payload_match', models.BooleanField(help_text='Payload hash match (exact data match)')),
                ('latency_delta_ms', models.FloatField(help_text='core_response_time_ms - legacy_response_time_ms')),
                ('parity_score', models.FloatField(help_text='Parity score: 0.0 (complete mismatch) to 1.0 (perfect match)', validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('mismatch_reason', models.TextField(blank=True, help_text='Description of mismatch if parity_status != \'match\'')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                'db_table': 'ops_audit_parity_log',
            },
        ),
        migrations.CreateModel(
            name='ParityReport',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('endpoint', models.CharField(db_index=True, max_length=255)),
                ('report_date', models.DateField(auto_now_add=True, db_index=True, help_text='Date of report (UTC)')),
                ('total_requests', models.IntegerField(help_text='Total request pairs logged')),
                ('match_count', models.IntegerField(help_text='Requests with parity_status=\'match\'')),
                ('warning_count', models.IntegerField(help_text='Requests with parity_status=\'warning\'')),
                ('mismatch_count', models.IntegerField(help_text='Requests with parity_status=\'mismatch\'')),
                ('error_count', models.IntegerField(help_text='Requests with parity_status=\'error\'')),
                ('avg_parity_score', models.FloatField(help_text='Average parity_score across all requests', validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('min_parity_score', models.FloatField(help_text='Minimum parity_score for the day', validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('median_latency_delta_ms', models.FloatField(help_text='Median latency difference (core - legacy)')),
                ('parity_pass', models.BooleanField(help_text='True if avg_parity_score >= 0.99')),
                ('recommendation', models.CharField(choices=[('green', 'GREEN - Proceed to next day'), ('yellow', 'YELLOW - Extend shadow run 1 day'), ('red', 'RED - Abort, investigate, reschedule')], default='pending', help_text='go/no-go recommendation based on parity metrics', max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('computing', 'Computing'), ('complete', 'Complete'), ('error', 'Error')], default='pending', help_text='pending | computing | complete | error', max_length=20)),
                ('critical_failures', models.JSONField(default=dict, help_text='Summary of critical failures (status code mismatch, etc)')),
                ('notes', models.TextField(blank=True, help_text='Free-text notes from report generator')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'ops_audit_parity_report',
                'unique_together': {('endpoint', 'report_date')},
            },
        ),
        migrations.CreateModel(
            name='ParityPhaseCheckpoint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phase_name', models.CharField(default='Phase 3', help_text='Phase identifier', max_length=20)),
                ('phase_status', models.CharField(choices=[('pending', 'Pending - Waiting for day 1'), ('day1', 'Day 1 - In progress'), ('day1_complete', 'Day 1 - Complete'), ('day2', 'Day 2 - In progress'), ('day2_complete', 'Day 2 - Complete'), ('day3', 'Day 3 - In progress'), ('day3_complete', 'Day 3 - Complete'), ('review', 'Review phase - Awaiting sign-off'), ('complete', 'Complete - Ready for Phase 4')], default='pending', max_length=20)),
                ('day1_date', models.DateField(blank=True, help_text='First trading day of shadow run', null=True)),
                ('day2_date', models.DateField(blank=True, null=True)),
                ('day3_date', models.DateField(blank=True, help_text='Third trading day of shadow run', null=True)),
                ('day1_parity_score', models.FloatField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('day2_parity_score', models.FloatField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('day3_parity_score', models.FloatField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(1.0)])),
                ('all_days_complete', models.BooleanField(default=False, help_text='True when all 3 days have reports')),
                ('all_days_pass', models.BooleanField(default=False, help_text='True when all 3 days parity >= 99%')),
                ('final_decision', models.CharField(choices=[('pending', 'Pending'), ('green', 'GREEN - Proceed to Phase 4'), ('red', 'RED - Extend or abort')], default='pending', help_text='Final go/no-go for Phase 4', max_length=20)),
                ('tech_lead_sign_off', models.BooleanField(default=False, help_text='Tech Lead confirmation for Phase 4 cutover')),
                ('sign_off_date', models.DateTimeField(blank=True, null=True)),
                ('sign_off_by', models.CharField(blank=True, help_text='Tech Lead username/email', max_length=255)),
                ('summary', models.TextField(blank=True, help_text='Executive summary of Phase 3 results')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'ops_audit_parity_phase_checkpoint',
            },
        ),
        # Add indexes
        migrations.AddIndex(
            model_name='paritylog',
            index=models.Index(fields=['created_at', 'endpoint'], name='ops_audit_p_created_1f2a3b_idx'),
        ),
        migrations.AddIndex(
            model_name='paritylog',
            index=models.Index(fields=['parity_status', 'created_at'], name='ops_audit_p_parity_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='paritylog',
            index=models.Index(fields=['x_request_id'], name='ops_audit_p_x_reque_d4e5f6_idx'),
        ),
        migrations.AddIndex(
            model_name='parityreport',
            index=models.Index(fields=['report_date', 'endpoint'], name='ops_audit_p_report_g7h8i9_idx'),
        ),
        migrations.AddIndex(
            model_name='parityreport',
            index=models.Index(fields=['parity_pass'], name='ops_audit_p_parity_j0k1l2_idx'),
        ),
    ]
