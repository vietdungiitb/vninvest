from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0002_pricealertrule'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MarketGroupSyncLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(choices=[('USER', 'Theo user'), ('GLOBAL', 'Toàn hệ thống')], default='USER', max_length=10, verbose_name='Phạm vi đồng bộ')),
                ('mode', models.CharField(choices=[('all', 'Toàn bộ'), ('sectors', 'Nhóm ngành'), ('caps', 'Nhóm vốn hóa'), ('manual', 'Danh sách cứng')], default='all', max_length=20, verbose_name='Chế độ đồng bộ')),
                ('clear_existing', models.BooleanField(default=False, verbose_name='Xóa nhóm hiện có trước khi sync')),
                ('success', models.BooleanField(default=False, verbose_name='Thành công')),
                ('total_users', models.PositiveIntegerField(default=0, verbose_name='Số user ảnh hưởng')),
                ('total_groups', models.PositiveIntegerField(default=0, verbose_name='Số nhóm đầu vào')),
                ('created_groups', models.PositiveIntegerField(default=0, verbose_name='Số nhóm tạo mới')),
                ('updated_groups', models.PositiveIntegerField(default=0, verbose_name='Số nhóm cập nhật')),
                ('added_symbols', models.PositiveIntegerField(default=0, verbose_name='Số mã thêm mới')),
                ('source', models.CharField(default='vnbroker', max_length=20, verbose_name='Nguồn dữ liệu')),
                ('message', models.TextField(blank=True, default='', verbose_name='Thông báo kết quả')),
                ('error', models.TextField(blank=True, default='', verbose_name='Lỗi chi tiết')),
                ('started_at', models.DateTimeField(auto_now_add=True, verbose_name='Bắt đầu lúc')),
                ('finished_at', models.DateTimeField(blank=True, null=True, verbose_name='Kết thúc lúc')),
                ('requested_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='requested_market_group_sync_logs', to=settings.AUTH_USER_MODEL, verbose_name='Người chạy đồng bộ')),
                ('target_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='market_group_sync_logs', to=settings.AUTH_USER_MODEL, verbose_name='User được đồng bộ')),
            ],
            options={
                'verbose_name': 'Log đồng bộ nhóm thị trường',
                'verbose_name_plural': 'Log đồng bộ nhóm thị trường',
                'ordering': ['-started_at'],
            },
        ),
    ]
