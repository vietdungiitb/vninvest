from django.conf import settings
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0037_h2_whaleadvisory_aggregate_snapshot_fk'),
    ]

    operations = [
        migrations.CreateModel(
            name='RuntimeVnbrokerConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('max_concurrency', models.PositiveIntegerField(default=12, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(50)], verbose_name='Giới hạn concurrent requests')),
                ('retry_attempts', models.PositiveIntegerField(default=1, validators=[django.core.validators.MaxValueValidator(5)], verbose_name='Số lần retry')),
                ('retry_backoff_seconds', models.FloatField(default=0.35, validators=[django.core.validators.MinValueValidator(0.0), django.core.validators.MaxValueValidator(5.0)], verbose_name='Backoff retry (giây)')),
                ('rate_limit_cooldown_seconds', models.PositiveIntegerField(default=20, validators=[django.core.validators.MinValueValidator(5), django.core.validators.MaxValueValidator(120)], verbose_name='Cooldown khi rate limit (giây)')),
                ('timeout_config', models.JSONField(blank=True, default=dict, verbose_name='Timeout theo channel')),
                ('price_board_source', models.CharField(default='VCI', max_length=16, verbose_name='Provider chính cho price board')),
                ('fallback_sources', models.JSONField(blank=True, default=list, verbose_name='Provider fallback')),
                ('enable_caching', models.BooleanField(default=True, verbose_name='Bật cache adapter')),
                ('enable_rate_limit_detection', models.BooleanField(default=True, verbose_name='Bật nhận diện rate limit')),
                ('enable_concurrent_limit', models.BooleanField(default=True, verbose_name='Bật giới hạn đồng thời')),
                ('changelog', models.JSONField(blank=True, default=list, verbose_name='Lịch sử thay đổi')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='vnbroker_runtime_config_updates', to=settings.AUTH_USER_MODEL, verbose_name='Người cập nhật gần nhất')),
            ],
            options={
                'verbose_name': 'Runtime vnbroker Config',
                'verbose_name_plural': 'Runtime vnbroker Config',
            },
        ),
    ]
