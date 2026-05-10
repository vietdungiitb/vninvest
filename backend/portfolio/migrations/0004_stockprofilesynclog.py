from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0003_marketgroupsynclog'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='StockProfileSyncLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(choices=[('GLOBAL', 'Toàn hệ thống')], default='GLOBAL', max_length=10, verbose_name='Phạm vi đồng bộ')),
                ('mode', models.CharField(choices=[('all', 'Toàn bộ'), ('sectors', 'Nhóm ngành'), ('caps', 'Nhóm vốn hóa'), ('manual', 'Danh sách cứng')], default='all', max_length=20, verbose_name='Chế độ đồng bộ')),
                ('success', models.BooleanField(default=False, verbose_name='Thành công')),
                ('total_symbols', models.PositiveIntegerField(default=0, verbose_name='Tổng số mã đầu vào')),
                ('created_symbols', models.PositiveIntegerField(default=0, verbose_name='Số mã tạo mới')),
                ('updated_symbols', models.PositiveIntegerField(default=0, verbose_name='Số mã cập nhật')),
                ('source', models.CharField(default='vnbroker', max_length=20, verbose_name='Nguồn dữ liệu')),
                ('message', models.TextField(blank=True, default='', verbose_name='Thông báo kết quả')),
                ('error', models.TextField(blank=True, default='', verbose_name='Lỗi chi tiết')),
                ('started_at', models.DateTimeField(auto_now_add=True, verbose_name='Bắt đầu lúc')),
                ('finished_at', models.DateTimeField(blank=True, null=True, verbose_name='Kết thúc lúc')),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_stock_profile_sync_logs', to=settings.AUTH_USER_MODEL, verbose_name='Người chạy đồng bộ')),
            ],
            options={
                'verbose_name': 'Log đồng bộ hồ sơ mã chứng khoán',
                'verbose_name_plural': 'Log đồng bộ hồ sơ mã chứng khoán',
                'ordering': ['-started_at'],
            },
        ),
    ]
