from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds session high, low, open price fields to SymbolSnapshot.
    reference_price, ceiling, floor already exist in DB (added manually before migration system).
    SeparateDatabaseAndState is used for those 3 to sync Django state without ALTER TABLE.
    """

    dependencies = [
        ('market_serving', '0001_initial'),
    ]

    operations = [
        # reference_price, ceiling, floor already in DB — sync state only, no DDL
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='symbolsnapshot',
                    name='reference_price',
                    field=models.DecimalField(
                        blank=True, decimal_places=2, max_digits=18, null=True,
                        help_text='Previous close price (nền giá)',
                    ),
                ),
                migrations.AddField(
                    model_name='symbolsnapshot',
                    name='ceiling',
                    field=models.DecimalField(
                        blank=True, decimal_places=2, max_digits=18, null=True,
                        help_text='Price ceiling (trần = reference * 1.07)',
                    ),
                ),
                migrations.AddField(
                    model_name='symbolsnapshot',
                    name='floor',
                    field=models.DecimalField(
                        blank=True, decimal_places=2, max_digits=18, null=True,
                        help_text='Price floor (sàn = reference * 0.93)',
                    ),
                ),
            ],
            database_operations=[],  # columns already exist in DB
        ),
        # New fields — run ALTER TABLE
        migrations.AddField(
            model_name='symbolsnapshot',
            name='open',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=18, null=True,
                help_text='Session open price (giá mở cửa phiên)',
            ),
        ),
        migrations.AddField(
            model_name='symbolsnapshot',
            name='high',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=18, null=True,
                help_text='Session high price (giá cao nhất phiên)',
            ),
        ),
        migrations.AddField(
            model_name='symbolsnapshot',
            name='low',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=18, null=True,
                help_text='Session low price (giá thấp nhất phiên)',
            ),
        ),
    ]
