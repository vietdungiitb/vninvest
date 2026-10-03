from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('market_data', '0005_add_stock_fundamental'),
    ]

    operations = [
        migrations.DeleteModel(
            name='StockFundamental',
        ),
    ]
