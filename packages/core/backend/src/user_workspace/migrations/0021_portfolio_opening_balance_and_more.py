"""
LED-01/02/03/06 — **EXPAND** phase của D-24.

Chỉ thêm bảng mới và 2 cột nullable trên `Portfolio`. KHÔNG đụng dữ liệu cũ,
KHÔNG `NOT NULL` hóa thứ gì, KHÔNG drop bảng nào ⇒ rollback chỉ cần drop các
bảng mới, dữ liệu `Transaction` cũ nguyên vẹn.

Số thứ tự `0021` do `makemigrations` tự sinh từ leaf `0020_userbrokerconfig_secret_version`
— KHÔNG tự đặt số (protocol §4: trùng số migration là lỗi chặn deploy).

Lưu ý bài học đã gặp: KHÔNG dùng `print()` có dấu trong migration. `UnicodeEncodeError`
trên cp1252 làm `migrate` fail giữa chừng và để lại DB ở trạng thái nửa vời.

Các phase còn lại của LED-05 (backfill → verify → cutover → contract) là những
migration RIÊNG, không gộp vào đây.
"""
from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '9000_auth_user_email_ci_unique'),
        ('user_workspace', '0020_userbrokerconfig_secret_version'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='portfolio',
            name='opening_balance',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Số dư tiền mặt trước thời điểm hệ thống bắt đầu ghi sổ. Để trống nghĩa là chưa xác định — NAV sẽ là null kèm lý do.', max_digits=20, null=True, verbose_name='Số dư tiền mặt mở đầu (VNĐ)'),
        ),
        migrations.AddField(
            model_name='portfolio',
            name='opening_balance_source',
            field=models.CharField(blank=True, default='', help_text='Ví dụ: sub_account_snapshot, manual, import.', max_length=32, verbose_name='Nguồn số dư mở đầu'),
        ),
        migrations.CreateModel(
            name='LedgerEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_type', models.CharField(choices=[('BUY', 'Mua'), ('SELL', 'Bán'), ('DIVIDEND', 'Cổ tức tiền mặt'), ('SPLIT', 'Chia tách'), ('BONUS', 'Cổ phiếu thưởng'), ('FEE', 'Phí'), ('TAX', 'Thuế'), ('ADJUSTMENT', 'Điều chỉnh')], db_index=True, max_length=12, verbose_name='Loại dòng')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('trade_date', models.DateField(db_index=True, verbose_name='Ngày giao dịch')),
                ('quantity', models.BigIntegerField(help_text='Số cổ phiếu. Với DIVIDEND đây là số cổ phiếu được trả cổ tức và `price` là cổ tức mỗi cổ phiếu — xem docstring `clean()`.', validators=[django.core.validators.MinValueValidator(0)], verbose_name='Số lượng')),
                ('price', models.DecimalField(decimal_places=2, max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal('0'))], verbose_name='Giá (VNĐ)')),
                ('fee', models.DecimalField(decimal_places=2, default=0, max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal('0'))], verbose_name='Phí')),
                ('tax', models.DecimalField(decimal_places=2, default=0, max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal('0'))], verbose_name='Thuế')),
                ('market', models.CharField(choices=[('VN_SPOT', 'Cổ phiếu niêm yết'), ('VN_FLOOR', 'Cổ phiếu UPCoM'), ('FOREIGN', 'Thị trường nước ngoài'), ('CRYPTO', 'Tiền mã hoá'), ('UNKNOWN', 'Chưa xác định')], db_index=True, default='UNKNOWN', max_length=10, verbose_name='Thị trường')),
                ('source', models.CharField(choices=[('manual', 'Nhập tay'), ('broker', 'Đồng bộ từ broker'), ('adjustment', 'Bù sai số'), ('backfill', 'Backfill từ Transaction')], db_index=True, default='manual', max_length=12, verbose_name='Nguồn')),
                ('external_id', models.CharField(blank=True, db_index=True, default='', max_length=100, verbose_name='Mã tham chiếu broker')),
                ('backfilled_by', models.CharField(blank=True, db_index=True, default='', max_length=64, verbose_name='Migration đã backfill dòng này')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='core_ledger_entries', to=settings.AUTH_USER_MODEL, verbose_name='Người tạo')),
                ('portfolio', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ledger_entries', to='user_workspace.portfolio', verbose_name='Danh mục')),
                ('reversal_of', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='reversals', to='user_workspace.ledgerentry', verbose_name='Đảo của dòng')),
                ('tenant', models.ForeignKey(help_text='D-03: bắt buộc NOT NULL — không có entry nào tenant-less.', on_delete=django.db.models.deletion.CASCADE, related_name='ledger_entries', to='identity_access.coretenant', verbose_name='Tenant')),
            ],
            options={
                'verbose_name': 'Dòng sổ cái',
                'verbose_name_plural': 'Dòng sổ cái',
                'ordering': ['trade_date', 'pk'],
            },
        ),
        migrations.CreateModel(
            name='CashFlow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('flow_type', models.CharField(choices=[('BUY', 'Mua cổ phiếu (tiền ra)'), ('SELL', 'Bán cổ phiếu (tiền vào)'), ('DIVIDEND', 'Cổ tức'), ('FEE', 'Phí'), ('TAX', 'Thuế'), ('DEPOSIT', 'Nạp tiền'), ('WITHDRAWAL', 'Rút tiền'), ('INTEREST', 'Lãi tiền gửi')], db_index=True, max_length=12, verbose_name='Loại dòng tiền')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=20, verbose_name='Số tiền (có dấu)')),
                ('currency', models.CharField(default='VND', help_text='D-05: chỉ VND ở R1. Multi-currency defer.', max_length=3, verbose_name='Tiền tệ')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cash_flows', to='identity_access.coretenant', verbose_name='Tenant')),
                ('entry', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cash_flows', to='user_workspace.ledgerentry', verbose_name='Dòng sổ cái')),
            ],
            options={
                'verbose_name': 'Dòng tiền',
                'verbose_name_plural': 'Dòng tiền',
                'ordering': ['pk'],
            },
        ),
        migrations.CreateModel(
            name='PositionSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã')),
                ('as_of_date', models.DateField(db_index=True, verbose_name='Ngày chụp')),
                ('quantity', models.DecimalField(decimal_places=4, default=0, max_digits=20)),
                ('avg_cost', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('current_price', models.DecimalField(blank=True, decimal_places=2, help_text='NULL khi chưa có giá — không dùng 0 để tránh số giả.', max_digits=20, null=True, verbose_name='Giá hiện tại')),
                ('market_value', models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True)),
                ('unrealized_pnl', models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True)),
                ('realized_pnl_cum', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('weight', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True, verbose_name='Tỷ trọng (0..1)')),
                ('calculation_version', models.CharField(max_length=32, verbose_name='Phiên bản thuật toán')),
                ('source', models.CharField(default='computed', max_length=16, verbose_name='Nguồn')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('portfolio', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='position_snapshots', to='user_workspace.portfolio', verbose_name='Danh mục')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='position_snapshots', to='identity_access.coretenant', verbose_name='Tenant')),
            ],
            options={
                'verbose_name': 'Ảnh chụp vị thế',
                'verbose_name_plural': 'Ảnh chụp vị thế',
                'ordering': ['-as_of_date', 'symbol'],
            },
        ),
        migrations.CreateModel(
            name='ValuationSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('as_of_date', models.DateField(db_index=True, verbose_name='Ngày chụp')),
                ('stock_value', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('cash', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('debt', models.DecimalField(decimal_places=2, default=0, help_text='Cash account = 0. Margin defer sang LIV-03 (LED-03 PB3).', max_digits=20, verbose_name='Nợ')),
                ('nav', models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True, verbose_name='NAV')),
                ('nav_reason', models.CharField(blank=True, default='', max_length=64, verbose_name='Lý do chưa có NAV')),
                ('opening_balance', models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True, verbose_name='Số dư mở đầu')),
                ('currency', models.CharField(default='VND', max_length=3)),
                ('calculation_version', models.CharField(max_length=32, verbose_name='Phiên bản thuật toán')),
                ('source', models.CharField(default='computed', max_length=16, verbose_name='Nguồn')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('portfolio', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='valuation_snapshots', to='user_workspace.portfolio', verbose_name='Danh mục')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='valuation_snapshots', to='identity_access.coretenant', verbose_name='Tenant')),
            ],
            options={
                'verbose_name': 'Ảnh chụp định giá',
                'verbose_name_plural': 'Ảnh chụp định giá',
                'ordering': ['-as_of_date'],
            },
        ),
        migrations.CreateModel(
            name='IdempotencyRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('scope', models.CharField(max_length=64, verbose_name='Phạm vi thao tác')),
                ('key', models.CharField(max_length=255, verbose_name='Idempotency-Key')),
                ('request_hash', models.CharField(max_length=64, verbose_name='Hash payload')),
                ('response_code', models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Mã trả về')),
                ('response_body', models.JSONField(blank=True, null=True, verbose_name='Body đã trả')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('expires_at', models.DateTimeField(db_index=True, verbose_name='Hết hạn lúc')),
                ('actor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='idempotency_records', to=settings.AUTH_USER_MODEL, verbose_name='Tác nhân')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='idempotency_records', to='identity_access.coretenant', verbose_name='Tenant')),
            ],
            options={
                'verbose_name': 'Bản ghi idempotency',
                'verbose_name_plural': 'Bản ghi idempotency',
                'ordering': ['-created_at'],
                'constraints': [models.UniqueConstraint(fields=('tenant', 'actor', 'scope', 'key'), name='uniq_idempotency_tenant_actor_scope_key')],
            },
        ),
        migrations.AddIndex(
            model_name='ledgerentry',
            index=models.Index(fields=['portfolio', 'symbol', 'trade_date'], name='user_worksp_portfol_d68755_idx'),
        ),
        migrations.AddIndex(
            model_name='ledgerentry',
            index=models.Index(fields=['tenant', 'portfolio', 'trade_date'], name='user_worksp_tenant__5cd6bf_idx'),
        ),
        migrations.AddConstraint(
            model_name='ledgerentry',
            constraint=models.UniqueConstraint(condition=models.Q(('external_id', ''), _negated=True), fields=('tenant', 'external_id'), name='uniq_ledger_entry_tenant_external_id'),
        ),
        migrations.AddConstraint(
            model_name='ledgerentry',
            constraint=models.UniqueConstraint(condition=models.Q(('reversal_of__isnull', False)), fields=('reversal_of',), name='uniq_ledger_entry_single_reversal'),
        ),
        migrations.AddIndex(
            model_name='cashflow',
            index=models.Index(fields=['tenant', 'flow_type'], name='user_worksp_tenant__fb94a7_idx'),
        ),
        migrations.AddConstraint(
            model_name='positionsnapshot',
            constraint=models.UniqueConstraint(fields=('portfolio', 'symbol', 'as_of_date'), name='uniq_position_snapshot_portfolio_symbol_date'),
        ),
        migrations.AddConstraint(
            model_name='valuationsnapshot',
            constraint=models.UniqueConstraint(fields=('portfolio', 'as_of_date'), name='uniq_valuation_snapshot_portfolio_date'),
        ),
    ]
