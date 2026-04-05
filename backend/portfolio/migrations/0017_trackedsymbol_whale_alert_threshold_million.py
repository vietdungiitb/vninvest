from decimal import Decimal

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0016_userconfig_language'),
    ]

    operations = [
        migrations.AddField(
            model_name='trackedsymbol',
            name='whale_alert_threshold_million',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal('1'))],
                verbose_name='Ngưỡng whale riêng (triệu VNĐ)',
            ),
        ),
    ]
