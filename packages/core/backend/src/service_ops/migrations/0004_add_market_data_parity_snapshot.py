import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0003_add_custom_symbol_group'),
    ]

    operations = [
        migrations.CreateModel(
            name='MarketDataParitySnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scheduler_task_id', models.CharField(db_index=True, max_length=200)),
                ('window_hours', models.IntegerField()),
                ('sample_size', models.IntegerField(default=100)),
                ('evaluated_symbols', models.IntegerField(default=0)),
                ('strict_fresh_count', models.IntegerField(default=0)),
                ('fresh_or_warm_count', models.IntegerField(default=0)),
                ('strict_fresh_parity', models.FloatField(default=0.0)),
                ('fresh_or_warm_parity', models.FloatField(default=0.0)),
                ('strict_met', models.BooleanField(default=False)),
                ('relaxed_met', models.BooleanField(default=False)),
                ('captured_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ('run_log', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='parity_snapshots', to='service_ops.servicerunlog')),
                ('service', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='parity_snapshots', to='service_ops.servicedefinition')),
            ],
            options={
                'verbose_name': 'Market Data Parity Snapshot',
                'verbose_name_plural': 'Market Data Parity Snapshots',
                'ordering': ['-captured_at', '-id'],
                'unique_together': {('scheduler_task_id', 'window_hours')},
            },
        ),
        migrations.AddIndex(
            model_name='marketdataparitysnapshot',
            index=models.Index(fields=['service', 'window_hours', 'captured_at'], name='service_ops__service_c6cc65_idx'),
        ),
        migrations.AddIndex(
            model_name='marketdataparitysnapshot',
            index=models.Index(fields=['scheduler_task_id', 'window_hours'], name='service_ops__schedul_5f5f42_idx'),
        ),
    ]