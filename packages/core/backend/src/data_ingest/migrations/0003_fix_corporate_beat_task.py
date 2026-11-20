"""Repair persisted django-celery-beat schedule after orchestrator rename.

Changing CELERY_BEAT_SCHEDULE in settings does NOT rewrite existing PeriodicTask
rows in databases using DatabaseScheduler. This data migration points the old
row at the new all-symbols orchestrator. Safe if the row or app is absent.
"""
from django.db import migrations

OLD_TASK = 'data_ingest.tasks.sync_corporate_actions'
NEW_TASK = 'data_ingest.tasks.sync_all_corporate_actions'
BEAT_NAME = 'sync-corporate-actions-nightly'


def _set_task(apps, from_task: str, to_task: str) -> None:
    try:
        periodic_task = apps.get_model('django_celery_beat', 'PeriodicTask')
    except LookupError:
        return
    periodic_task.objects.filter(name=BEAT_NAME, task=from_task).update(task=to_task)


def forwards(apps, schema_editor):
    _set_task(apps, OLD_TASK, NEW_TASK)


def backwards(apps, schema_editor):
    _set_task(apps, NEW_TASK, OLD_TASK)


class Migration(migrations.Migration):
    dependencies = [
        ('data_ingest', '0002_rename_data_ingest_job_id_idx_data_ingest_job_id_4d6b96_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
