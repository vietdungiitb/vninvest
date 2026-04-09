# Generated manually for PHASE 1 advisory auto-generation and auto-refresh
# Date: 2026-04-09

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0013_ai_advisory_components_and_summary'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add fields to WhaleAdvisory model for auto-generation & refresh tracking
        migrations.AddField(
            model_name='whaleadvisory',
            name='next_refresh_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True, verbose_name='Lần refresh tự động tiếp theo'),
        ),
        migrations.AddField(
            model_name='whaleadvisory',
            name='refresh_count',
            field=models.PositiveIntegerField(default=0, verbose_name='Số lần refresh'),
        ),
        migrations.AddField(
            model_name='whaleadvisory',
            name='is_auto_generated',
            field=models.BooleanField(default=False, verbose_name='Được tạo tự động?'),
        ),
        migrations.AddField(
            model_name='whaleadvisory',
            name='source',
            field=models.CharField(
                choices=[('whale_signal', 'Phát hiện tín hiệu cá voi'), ('periodic_job', 'Công việc định kỳ auto-gen'), ('user_refresh', 'Làm mới thủ công bởi user')],
                default='whale_signal',
                max_length=20,
                verbose_name='Nguồn'
            ),
        ),
        
        # 2. Add indexes to WhaleAdvisory for auto-refresh queries
        migrations.AddIndex(
            model_name='whaleadvisory',
            index=models.Index(fields=['user', 'next_refresh_at'], name='idx_wha_user_refresh_at'),
        ),
        migrations.AddIndex(
            model_name='whaleadvisory',
            index=models.Index(fields=['symbol', 'next_refresh_at'], name='idx_wha_symb_refresh_at'),
        ),
        
        # 3. Add fields to UserConfig for advisory settings
        migrations.AddField(
            model_name='userconfig',
            name='advisory_auto_generation_enabled',
            field=models.BooleanField(default=True, verbose_name='Cho phép tạo khuyến nghị tự động (mỗi 4h)'),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='advisory_whale_signal_enabled',
            field=models.BooleanField(default=True, verbose_name='Cho phép tạo khuyến nghị khi phát hiện tín hiệu cá voi'),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='advisory_manual_refresh_enabled',
            field=models.BooleanField(default=True, verbose_name='Cho phép user làm mới khuyến nghị thủ công'),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='advisory_refresh_interval_hours',
            field=models.PositiveIntegerField(
                default=24,
                validators=[django.core.validators.MinValueValidator(1)],
                verbose_name='Khoảng thời gian refresh tự động (giờ)',
                help_text='Advisory sẽ được tạo lại khi tuổi > số giờ này'
            ),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='advisory_max_tokens_per_day',
            field=models.PositiveIntegerField(
                default=5000,
                validators=[django.core.validators.MinValueValidator(1000)],
                verbose_name='Ngân sách token AI mỗi ngày',
                help_text='Giới hạn tokens dùng cho tạo/refresh khuyến nghị'
            ),
        ),
        
        # 4. Create new AdvisoryTokenLog model
        migrations.CreateModel(
            name='AdvisoryTokenLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tokens_used', models.PositiveIntegerField(default=0, verbose_name='Số token sử dụng (prompt + completion)')),
                ('source', models.CharField(
                    choices=[('auto_generation', 'Tạo tự động'), ('whale_signal', 'Phát hiện tín hiệu cá voi'), ('manual_refresh', 'Làm mới thủ công')],
                    db_index=True,
                    default='whale_signal',
                    max_length=20,
                    verbose_name='Nguồn tạo khuyến nghị'
                )),
                ('symbol', models.CharField(blank=True, db_index=True, default='', max_length=10, verbose_name='Mã chứng khoán')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Thời điểm sử dụng token')),
                (
                    'advisory',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='token_logs',
                        to='portfolio.whaleadvisory',
                        verbose_name='Khuyến nghị'
                    )
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='advisory_token_logs',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Người dùng'
                    )
                ),
            ],
            options={
                'verbose_name': 'Log token khuyến nghị',
                'verbose_name_plural': 'Log token khuyến nghị',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user', 'created_at'], name='idx_adv_token_log_user_date'),
                    models.Index(fields=['source', 'created_at'], name='idx_adv_token_log_source_date'),
                    models.Index(fields=['user', '-created_at'], name='idx_adv_token_log_user_created_desc'),
                ],
            },
        ),
    ]
