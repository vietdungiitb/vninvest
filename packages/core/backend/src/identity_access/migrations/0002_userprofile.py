from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_name', models.CharField(blank=True, max_length=120, verbose_name='Tên hiển thị')),
                ('language', models.CharField(
                    choices=[('vi', 'Tiếng Việt'), ('en', 'English')],
                    default='vi',
                    max_length=8,
                    verbose_name='Ngôn ngữ',
                )),
                ('theme', models.CharField(
                    choices=[('dark', 'Dark'), ('light', 'Light')],
                    default='dark',
                    max_length=10,
                    verbose_name='Chủ đề giao diện',
                )),
                ('whale_alert_threshold', models.DecimalField(
                    decimal_places=0,
                    default=500,
                    max_digits=12,
                    verbose_name='Ngưỡng lệnh cá mập (triệu VNĐ)',
                )),
                ('preferences', models.JSONField(blank=True, default=dict, verbose_name='Tuỳ chọn bổ sung')),
                ('legacy_user_id', models.IntegerField(blank=True, db_index=True, null=True, verbose_name='Legacy user ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='user_profiles',
                    to='identity_access.coretenant',
                    verbose_name='Tenant',
                )),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='core_profile',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Người dùng',
                )),
            ],
            options={
                'verbose_name': 'User Profile',
                'verbose_name_plural': 'User Profiles',
            },
        ),
    ]
