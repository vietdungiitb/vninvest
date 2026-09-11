"""Add CachedSymbolGroup model — SSOT cho nhóm thị trường từ vnbroker provider."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0007_rename_svc_beb_run_state_idx_service_ops_run_id_0c8c61_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CachedSymbolGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('group_name', models.CharField(help_text='VD: VN30, HOSE, VNMidCap', max_length=50, unique=True, verbose_name='Tên nhóm')),
                ('group_code', models.CharField(blank=True, default='', help_text='Mã nội bộ provider. VD: KBS dùng "30" cho VN30', max_length=20, verbose_name='Mã nhóm (provider code)')),
                ('category', models.CharField(blank=True, default='', help_text='VD: Chỉ số VN, Sàn giao dịch, ETF/Quỹ', max_length=50, verbose_name='Phân loại')),
                ('description', models.TextField(blank=True, default='', verbose_name='Mô tả')),
                ('source_provider', models.CharField(help_text='Provider lấy dữ liệu: KBS, VCI, TCBS', max_length=20, verbose_name='Provider nguồn')),
                ('symbol_count', models.PositiveIntegerField(blank=True, help_text='Số mã trong nhóm (null nếu chưa resolve)', null=True, verbose_name='Số lượng mã')),
                ('is_active', models.BooleanField(default=True, verbose_name='Đang hoạt động')),
                ('synced_at', models.DateTimeField(auto_now=True, verbose_name='Lần sync gần nhất')),
            ],
            options={
                'verbose_name': 'Nhóm thị trường (cached)',
                'verbose_name_plural': 'Nhóm thị trường (cached)',
                'ordering': ['category', 'group_name'],
            },
        ),
    ]
