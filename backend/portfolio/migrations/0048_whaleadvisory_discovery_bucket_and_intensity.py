from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0047_add_market_discovery_fields_to_signals'),
    ]

    operations = [
        migrations.AddField(
            model_name='whaleadvisory',
            name='discovery_bucket',
            field=models.CharField(blank=True, default='standard', max_length=30, verbose_name='Nhóm Discovery'),
        ),
        migrations.AddField(
            model_name='whaleadvisory',
            name='whale_intensity',
            field=models.FloatField(default=0.0, verbose_name='Cường độ cá mập (0-100)'),
        ),
    ]