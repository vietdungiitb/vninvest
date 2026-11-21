# S1 (Phase B): backfill cột phẳng từ input_summary.
# atomic=False: bảng ~1.78M row — giữ transaction suốt backfill sẽ block
# scheduler writes và treo deploy. Mỗi batch commit riêng; fail giữa chừng
# chạy lại migrate (RunPython idempotent — skip row đã đồng bộ).
from django.db import migrations


def backfill_run_log_columns(apps, schema_editor):
    # KHÔNG dùng qs.iterator(): server-side cursor chết giữa chunk khi đi qua
    # pgbouncer transaction mode (InvalidCursorName) — đã crash staging thật.
    # Keyset pagination: mỗi batch là query độc lập, pooler-safe, rerun-safe.
    ServiceRunLog = apps.get_model('service_ops', 'ServiceRunLog')
    last_pk = 0
    while True:
        batch = []
        rows = (
            ServiceRunLog.objects.filter(pk__gt=last_pk)
            .order_by('pk')
            .only('pk', 'input_summary', 'trigger', 'queue_tier', 'parent_run_log_id')[:2000]
        )
        rows = list(rows)
        if not rows:
            break
        for row in rows:
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
        if batch:
            ServiceRunLog.objects.bulk_update(
                batch, ['trigger', 'queue_tier', 'parent_run_log_id'],
            )
        last_pk = rows[-1].pk


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('service_ops', '0014_runlog_flat_lookup_columns'),
    ]

    operations = [
        migrations.RunPython(backfill_run_log_columns, migrations.RunPython.noop),
    ]
