# S1 (Phase B): cột phẳng mirror input_summary keys.
# DDL-only (atomic mặc định): an toàn rerun — DDL nhanh (metadata-only),
# rollback toàn bộ nếu fail giữa chừng.
from django.db import migrations, models


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
    ]
