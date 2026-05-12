from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='StockProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, unique=True, verbose_name='Mã cổ phiếu')),
                ('company_name', models.CharField(blank=True, default='', max_length=255, verbose_name='Tên công ty')),
                ('exchange', models.CharField(
                    choices=[('HOSE', 'HOSE'), ('HNX', 'HNX'), ('UPCOM', 'UPCOM'), ('UNLISTED', 'Unlisted')],
                    db_index=True,
                    default='HOSE',
                    max_length=16,
                    verbose_name='Sàn',
                )),
                ('industry', models.CharField(blank=True, default='', max_length=128, verbose_name='Ngành')),
                ('status', models.CharField(
                    choices=[('active', 'Đang niêm yết'), ('suspended', 'Tạm dừng'), ('delisted', 'Huỷ niêm yết')],
                    db_index=True,
                    default='active',
                    max_length=16,
                )),
                ('outstanding_shares', models.BigIntegerField(blank=True, null=True, verbose_name='Số CP lưu hành')),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('legacy_symbol', models.CharField(blank=True, db_index=True, default='', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Hồ sơ cổ phiếu',
                'verbose_name_plural': 'Hồ sơ cổ phiếu',
                'ordering': ['symbol'],
            },
        ),
        migrations.CreateModel(
            name='DailyPrice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('date', models.DateField(db_index=True, verbose_name='Ngày giao dịch')),
                ('open', models.DecimalField(decimal_places=2, max_digits=18, verbose_name='Giá mở cửa')),
                ('high', models.DecimalField(decimal_places=2, max_digits=18, verbose_name='Giá cao nhất')),
                ('low', models.DecimalField(decimal_places=2, max_digits=18, verbose_name='Giá thấp nhất')),
                ('close', models.DecimalField(decimal_places=2, max_digits=18, verbose_name='Giá đóng cửa')),
                ('volume', models.BigIntegerField(verbose_name='Khối lượng khớp lệnh')),
                ('value', models.BigIntegerField(blank=True, null=True, verbose_name='Giá trị khớp lệnh (VNĐ)')),
                ('change_pct', models.DecimalField(blank=True, decimal_places=4, max_digits=8, null=True, verbose_name='% thay đổi')),
                ('source', models.CharField(default='vnbroker', max_length=32, verbose_name='Nguồn dữ liệu')),
                ('is_adjusted', models.BooleanField(default=False, verbose_name='Đã điều chỉnh')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Giá ngày',
                'verbose_name_plural': 'Giá ngày',
                'ordering': ['-date', 'symbol'],
                'unique_together': {('symbol', 'date')},
                'indexes': [
                    models.Index(fields=['symbol', 'date'], name='mktdata_daily_sym_date_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='VnbrokerRuntimeConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=64, unique=True, verbose_name='Tên cấu hình')),
                ('is_active', models.BooleanField(db_index=True, default=False, verbose_name='Đang kích hoạt')),
                ('data_source', models.CharField(
                    choices=[('VCI', 'VCI (default)'), ('TCBS', 'TCBS'), ('MSI', 'MSI')],
                    default='VCI',
                    max_length=16,
                    verbose_name='Nguồn dữ liệu vnbroker',
                )),
                ('max_workers', models.IntegerField(default=4, verbose_name='Số luồng tối đa')),
                ('request_delay_ms', models.IntegerField(default=200, verbose_name='Độ trễ giữa request (ms)')),
                ('max_retries', models.IntegerField(default=3, verbose_name='Số lần retry tối đa')),
                ('batch_size', models.IntegerField(default=50, verbose_name='Số mã mỗi batch')),
                ('extra', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Cấu hình vnbroker runtime',
                'verbose_name_plural': 'Cấu hình vnbroker runtime',
            },
        ),
    ]
