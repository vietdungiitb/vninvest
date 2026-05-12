from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='IngestJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=64, unique=True)),
                ('source', models.CharField(choices=[('vnbroker_price_board', 'vnbroker Price Board'), ('vnbroker_intraday', 'vnbroker Intraday'), ('legacy_sync', 'Legacy DB Sync'), ('manual', 'Manual Trigger')], max_length=32)),
                ('status', models.CharField(choices=[('active', 'Active'), ('paused', 'Paused'), ('disabled', 'Disabled')], default='active', max_length=16)),
                ('schedule_seconds', models.PositiveIntegerField(default=60)),
                ('config', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Ingest Job',
                'verbose_name_plural': 'Ingest Jobs',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='IngestRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('state', models.CharField(choices=[('running', 'Running'), ('success', 'Success'), ('failed', 'Failed'), ('skipped', 'Skipped')], default='running', max_length=16)),
                ('rows_upserted', models.PositiveIntegerField(default=0)),
                ('rows_skipped', models.PositiveIntegerField(default=0)),
                ('error_message', models.TextField(blank=True, default='')),
                ('started_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('meta', models.JSONField(blank=True, default=dict)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='runs', to='data_ingest.ingestjob')),
            ],
            options={
                'verbose_name': 'Ingest Run',
                'verbose_name_plural': 'Ingest Runs',
                'ordering': ['-started_at'],
            },
        ),
        migrations.AddIndex(
            model_name='ingestrun',
            index=models.Index(fields=['job', 'started_at'], name='data_ingest_job_id_idx'),
        ),
        migrations.AddIndex(
            model_name='ingestrun',
            index=models.Index(fields=['state', 'started_at'], name='data_ingest_state_idx'),
        ),
    ]
