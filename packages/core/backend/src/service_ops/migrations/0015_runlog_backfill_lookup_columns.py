# S1 (Phase B): backfill cột phẳng từ input_summary.
# atomic=False: bảng ~1.78M row — giữ transaction suốt backfill sẽ block
# scheduler writes và treo deploy. Mỗi batch commit riêng; fail giữa chừng
# chạy lại migrate (RunPython idempotent — skip row đã đồng bộ).
from django.db import migrations


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

    atomic = False

    dependencies = [
        ('service_ops', '0014_runlog_flat_lookup_columns'),
    ]

    operations = [
        migrations.RunPython(backfill_run_log_columns, migrations.RunPython.noop),
    ]
