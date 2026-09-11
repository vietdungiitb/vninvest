# Generated for PAT usage analytics — AuditEvent.pat_id cross-reference.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ops_audit', '0003_delete_paritylog_delete_parityphasecheckpoint_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditevent',
            name='pat_id',
            field=models.CharField(blank=True, db_index=True, max_length=36, null=True, verbose_name='PAT public id'),
        ),
    ]
