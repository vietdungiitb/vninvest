from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0069_partition_intradaytick'),
    ]

    operations = [
        migrations.AlterField(
            model_name='trackedsymbol',
            name='whale_alert_threshold_million',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                default=None,
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal('1'))],
                verbose_name='Ngưỡng whale riêng (triệu VNĐ)',
            ),
        ),
    ]
