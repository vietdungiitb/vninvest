# Generated migration for Sprint 34 (A1 Event Identity + B1 Severity Remap)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0034_whaleadvisory_merge_metadata'),
    ]

    operations = [
        # Add SeverityChoices inner class and fields to OrderFlowSignal
        migrations.AddField(
            model_name='orderflowsignal',
            name='event_id',
            field=models.TextField(
                blank=True,
                null=True,
                db_index=True,
                unique=True,
                verbose_name='Event ID (deterministic)',
                help_text='Uniquely identifies dark flow signal for deduplication and audit trail'
            ),
        ),
        migrations.AddField(
            model_name='orderflowsignal',
            name='severity',
            field=models.CharField(
                max_length=10,
                choices=[('info', 'Thông tin'), ('warning', 'Cảnh báo'), ('urgent', 'Khẩn cấp')],
                default='info',
                verbose_name='Mức độ nghiêm trọng'
            ),
        ),
        # Add indexes for pagination and tiebreaker support
        migrations.AddIndex(
            model_name='orderflowsignal',
            index=models.Index(fields=['symbol', 'created_at', 'id'], name='idx_ofs_symbol_created_id'),
        ),
        migrations.AddIndex(
            model_name='orderflowsignal',
            index=models.Index(fields=['event_id'], name='idx_ofs_event_id'),
        ),
    ]
