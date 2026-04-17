from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0042_remove_advisoryaggregatesnapshot_unique_snap_user_symbol_seq_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='intradaytick',
            index=models.Index(fields=['symbol', 'trade_date', 'side'], name='idx_intraday_sym_date_side'),
        ),
    ]
