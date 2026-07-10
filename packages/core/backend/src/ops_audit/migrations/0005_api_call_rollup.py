# Generated for PAT usage analytics — ApiCallRollup hourly rollup table.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ops_audit', '0004_auditevent_pat_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='ApiCallRollup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tenant_id', models.CharField(db_index=True, max_length=36)),
                ('date', models.DateField(db_index=True)),
                ('hour', models.SmallIntegerField()),
                ('ip_address', models.CharField(db_index=True, default='', max_length=64)),
                ('endpoint_group', models.CharField(default='other', max_length=64)),
                ('status_group', models.CharField(default='2xx', max_length=8)),
                ('call_count', models.IntegerField(default=0)),
                ('error_count', models.IntegerField(default=0)),
                ('total_duration_ms', models.BigIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'API Call Rollup',
                'verbose_name_plural': 'API Call Rollups',
                'db_table': 'ops_audit_api_call_rollup',
                'ordering': ['tenant_id', 'date', 'hour'],
                'unique_together': {('tenant_id', 'date', 'hour', 'ip_address', 'endpoint_group', 'status_group')},
            },
        ),
        migrations.AddIndex(
            model_name='apicallrollup',
            index=models.Index(fields=['tenant_id', 'date', 'hour', 'ip_address'], name='ops_rollup_tnt_date_hr_ip'),
        ),
        migrations.AddIndex(
            model_name='apicallrollup',
            index=models.Index(fields=['tenant_id', 'date', 'hour', 'endpoint_group'], name='ops_rollup_tnt_date_hr_ep'),
        ),
        migrations.AddIndex(
            model_name='apicallrollup',
            index=models.Index(fields=['tenant_id', 'date', 'hour', 'status_group'], name='ops_rollup_tnt_date_hr_st'),
        ),
    ]