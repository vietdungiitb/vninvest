from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0036_h0_04_aggregate_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='whaleadvisory',
            name='aggregate_snapshot',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='advisories',
                to='portfolio.advisoryaggregatesnapshot',
                verbose_name='Snapshot aggregate tham chiếu',
            ),
        ),
        migrations.AddIndex(
            model_name='whaleadvisory',
            index=models.Index(fields=['aggregate_snapshot'], name='idx_whale_adv_snapshot'),
        ),
    ]
