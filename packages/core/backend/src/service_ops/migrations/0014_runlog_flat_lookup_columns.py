# S1 (Phase B): cột phẳng mirror input_summary keys + backfill.
# Index tạo riêng ở 0015 bằng CONCURRENTLY (bảng ~1.8M row/1.2GB).
from django.db import migrations, models


def backfill_run_log_columns(apps, schema_editor):
    ServiceRunLog = apps.get_model('service_ops', 'ServiceRunLog')
    qs = ServiceRunLog.objects.all().order_by('pk').only(
        'pk', 'input_summary', 'trigger', 'queue_tier', 'parent_run_log_id',
    )
    batch = []
    for row in qs.iterator(chunk_size=2000):
        summary = row.input_summary or {}
        if not isinstance(summary, dict):
            continue
        trigger = str(summary.get('trigger') or '')
        queue_tier = str(summary.get('queue_tier') or '')
        parent = summary.get('parent_run_log_id')
        try:
            parent_id = int(parent) if parent is not None else None
        except (TypeError, ValueError):
            parent_id = None
        if (row.trigger != trigger or row.queue_tier != queue_tier
                or row.parent_run_log_id != parent_id):
            row.trigger = trigger
            row.queue_tier = queue_tier
            row.parent_run_log_id = parent_id
            batch.append(row)
        if len(batch) >= 2000:
            ServiceRunLog.objects.bulk_update(
                batch, ['trigger', 'queue_tier', 'parent_run_log_id'],
            )
            batch = []
    if batch:
        ServiceRunLog.objects.bulk_update(
            batch, ['trigger', 'queue_tier', 'parent_run_log_id'],
        )


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0013_configchangeaudit_rule_request_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='servicerunlog',
            name='trigger',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='servicerunlog',
            name='queue_tier',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='servicerunlog',
            name='parent_run_log_id',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_run_log_columns, migrations.RunPython.noop),
    ]
