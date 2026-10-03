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
            name='Portfolio',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Tên danh mục')),
                ('description', models.TextField(blank=True, default='', verbose_name='Mô tả')),
                ('is_default', models.BooleanField(default=False, verbose_name='Danh mục mặc định')),
                ('legacy_portfolio_id', models.IntegerField(blank=True, db_index=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='core_portfolios',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Người dùng',
                )),
            ],
            options={
                'verbose_name': 'Danh mục đầu tư',
                'verbose_name_plural': 'Danh mục đầu tư',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Transaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('transaction_type', models.CharField(
                    choices=[('BUY', 'Mua'), ('SELL', 'Bán'), ('DIVIDEND', 'Cổ tức tiền mặt')],
                    max_length=10,
                    verbose_name='Loại lệnh',
                )),
                ('date', models.DateField(db_index=True, verbose_name='Ngày giao dịch')),
                ('price', models.DecimalField(decimal_places=2, max_digits=18, verbose_name='Giá khớp (VNĐ)')),
                ('quantity', models.BigIntegerField(verbose_name='Số lượng cổ phiếu')),
                ('fee', models.DecimalField(decimal_places=2, default=0, max_digits=18, verbose_name='Phí giao dịch')),
                ('note', models.TextField(blank=True, default='', verbose_name='Ghi chú')),
                ('legacy_transaction_id', models.IntegerField(blank=True, db_index=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('portfolio', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='transactions',
                    to='user_workspace.portfolio',
                    verbose_name='Danh mục',
                )),
            ],
            options={
                'verbose_name': 'Giao dịch',
                'verbose_name_plural': 'Giao dịch',
                'ordering': ['-date', '-pk'],
                'indexes': [
                    models.Index(fields=['portfolio', 'symbol', 'date'], name='uw_txn_portfolio_sym_date_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='Watchlist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Tên danh sách')),
                ('description', models.TextField(blank=True, default='', verbose_name='Mô tả')),
                ('is_default', models.BooleanField(default=False, verbose_name='Danh sách mặc định')),
                ('legacy_group_id', models.IntegerField(blank=True, db_index=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='core_watchlists',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Người dùng',
                )),
            ],
            options={
                'verbose_name': 'Danh sách theo dõi',
                'verbose_name_plural': 'Danh sách theo dõi',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='WatchlistItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('note', models.CharField(blank=True, default='', max_length=255, verbose_name='Ghi chú')),
                ('added_at', models.DateTimeField(auto_now_add=True)),
                ('watchlist', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items',
                    to='user_workspace.watchlist',
                    verbose_name='Danh sách',
                )),
            ],
            options={
                'verbose_name': 'Mã theo dõi',
                'verbose_name_plural': 'Mã theo dõi',
                'unique_together': {('watchlist', 'symbol')},
                'ordering': ['-added_at'],
            },
        ),
    ]
