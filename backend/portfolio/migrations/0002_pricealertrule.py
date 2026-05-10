from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PriceAlertRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=10, verbose_name='Mã chứng khoán')),
                ('condition', models.CharField(choices=[('ABOVE', 'Vượt lên trên'), ('BELOW', 'Rơi xuống dưới')], default='ABOVE', max_length=10, verbose_name='Điều kiện cảnh báo')),
                ('target_price', models.DecimalField(decimal_places=2, max_digits=15, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))], verbose_name='Mức giá mục tiêu (VNĐ)')),
                ('cooldown_seconds', models.PositiveIntegerField(default=300, verbose_name='Thời gian chờ lặp lại (giây)')),
                ('is_active', models.BooleanField(default=True, verbose_name='Đang kích hoạt')),
                ('last_triggered_at', models.DateTimeField(blank=True, null=True, verbose_name='Lần trigger gần nhất')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='price_alert_rules', to=settings.AUTH_USER_MODEL, verbose_name='Người dùng')),
            ],
            options={
                'verbose_name': 'Cảnh báo giá',
                'verbose_name_plural': 'Cảnh báo giá',
                'ordering': ['-created_at'],
                'unique_together': {('user', 'symbol', 'condition', 'target_price')},
            },
        ),
    ]
