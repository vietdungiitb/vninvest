from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('portfolio', '0045_add_signal_verification_telegram_sentiment'),
    ]

    operations = [
        migrations.CreateModel(
            name='SeedExecutionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('command_name', models.CharField(max_length=80, verbose_name='Lenh seed')),
                ('seed_profile', models.CharField(blank=True, default='', max_length=40, verbose_name='Profile seed')),
                ('seed_version', models.CharField(blank=True, default='', max_length=40, verbose_name='Phien ban seed')),
                ('runtime_environment', models.CharField(default='development', max_length=20, verbose_name='Moi truong runtime')),
                ('options_json', models.JSONField(blank=True, default=dict, verbose_name='Tuy chon thuc thi')),
                ('status', models.CharField(choices=[('success', 'Thanh cong'), ('failed', 'That bai'), ('dry_run', 'Dry run')], max_length=20, verbose_name='Trang thai')),
                ('message', models.TextField(blank=True, default='', verbose_name='Thong diep')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Thoi diem tao')),
                ('executed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='seed_execution_logs', to=settings.AUTH_USER_MODEL, verbose_name='Nguoi thuc thi')),
            ],
            options={
                'verbose_name': 'Nhat ky seed du lieu',
                'verbose_name_plural': 'Nhat ky seed du lieu',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='seedexecutionlog',
            index=models.Index(fields=['command_name', '-created_at'], name='idx_seedlog_cmd_created'),
        ),
        migrations.AddIndex(
            model_name='seedexecutionlog',
            index=models.Index(fields=['seed_profile', '-created_at'], name='idx_seedlog_profile_created'),
        ),
    ]
