from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('market_serving', '0003_add_snapshot_quote_columns_and_backfill'),
    ]

    operations = [
        migrations.AddField(
            model_name='sessionfacts',
            name='series_by_window',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
