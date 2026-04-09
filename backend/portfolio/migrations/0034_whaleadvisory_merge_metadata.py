from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0033_whaleadvisory_advisory_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='whaleadvisory',
            name='merged_sources',
            field=models.JSONField(blank=True, default=list, verbose_name='Nguồn trigger gộp'),
        ),
        migrations.AddField(
            model_name='whaleadvisory',
            name='primary_source',
            field=models.CharField(blank=True, default='', max_length=30, verbose_name='Nguồn trigger chính'),
        ),
    ]
