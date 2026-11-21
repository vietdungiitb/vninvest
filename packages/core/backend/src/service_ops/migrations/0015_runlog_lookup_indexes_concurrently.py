# S1 (Phase B): index cho lookup cột phẳng — CONCURRENTLY để không block
# write trên bảng ~1.8M row/1.2GB. atomic=False bắt buộc với CONCURRENTLY.
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('service_ops', '0014_runlog_flat_lookup_columns'),
    ]

    operations = [
        AddIndexConcurrently(
            model_name='servicerunlog',
            index=models.Index(
                fields=['service', 'trigger', 'queue_tier', '-started_at'],
                name='runlog_svc_trg_tier_time_idx',
            ),
        ),
        AddIndexConcurrently(
            model_name='servicerunlog',
            index=models.Index(fields=['trigger'], name='runlog_trigger_idx'),
        ),
        AddIndexConcurrently(
            model_name='servicerunlog',
            index=models.Index(
                fields=['parent_run_log_id'], name='runlog_parent_idx',
            ),
        ),
    ]
