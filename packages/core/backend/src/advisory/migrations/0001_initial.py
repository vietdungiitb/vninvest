import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemAISettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=64, unique=True, verbose_name='Tên cấu hình')),
                ('is_active', models.BooleanField(db_index=True, default=False, verbose_name='Đang kích hoạt')),
                ('ai_model', models.CharField(
                    choices=[
                        ('gpt-4o', 'GPT-4o'),
                        ('gpt-4o-mini', 'GPT-4o-mini'),
                        ('gpt-3.5-turbo', 'GPT-3.5-turbo'),
                        ('gemini-pro', 'Gemini Pro'),
                        ('gemini-1.5-flash', 'Gemini 1.5 Flash'),
                        ('custom', 'Custom'),
                    ],
                    default='gpt-4o-mini',
                    max_length=64,
                    verbose_name='AI Model',
                )),
                ('max_tokens', models.IntegerField(default=1000, verbose_name='Token budget tối đa')),
                ('temperature', models.FloatField(default=0.3, verbose_name='Temperature')),
                ('prompt_template', models.TextField(blank=True, default='', verbose_name='System prompt template')),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Cấu hình AI',
                'verbose_name_plural': 'Cấu hình AI',
            },
        ),
        migrations.CreateModel(
            name='AdvisoryRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('advisory_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('session_date', models.DateField(db_index=True, verbose_name='Ngày phiên')),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Đang chờ'),
                        ('generated', 'Đã tạo'),
                        ('failed', 'Thất bại'),
                        ('superseded', 'Đã thay thế'),
                    ],
                    db_index=True,
                    default='pending',
                    max_length=16,
                )),
                ('ai_model', models.CharField(blank=True, default='', max_length=64, verbose_name='AI model dùng')),
                ('advisory_text', models.TextField(blank=True, default='', verbose_name='Nội dung advisory')),
                ('context_snapshot', models.JSONField(blank=True, default=dict, verbose_name='Context snapshot khi generate')),
                ('tokens_used', models.IntegerField(default=0, verbose_name='Tokens đã dùng')),
                ('error_message', models.TextField(blank=True, default='', verbose_name='Thông báo lỗi')),
                ('legacy_advisory_id', models.IntegerField(blank=True, db_index=True, null=True)),
                ('generated_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='advisory_records',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Người dùng yêu cầu',
                )),
            ],
            options={
                'verbose_name': 'Advisory Record',
                'verbose_name_plural': 'Advisory Records',
                'ordering': ['-generated_at', '-created_at', '-pk'],
                'indexes': [
                    models.Index(fields=['symbol', 'session_date', 'status'], name='adv_sym_date_status_idx'),
                    models.Index(fields=['user', 'session_date'], name='adv_user_date_idx'),
                ],
            },
        ),
    ]
