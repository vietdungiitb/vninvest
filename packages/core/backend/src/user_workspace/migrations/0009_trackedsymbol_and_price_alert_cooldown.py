from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


def backfill_tracked_symbols_from_default_watchlists(apps, schema_editor):
    Watchlist = apps.get_model('user_workspace', 'Watchlist')
    WatchlistItem = apps.get_model('user_workspace', 'WatchlistItem')
    TrackedSymbol = apps.get_model('user_workspace', 'TrackedSymbol')

    watchlists = Watchlist.objects.filter(models.Q(is_default=True) | models.Q(name__iexact='Danh mục theo dõi'))
    for watchlist in watchlists.iterator():
        item_queryset = WatchlistItem.objects.filter(watchlist_id=watchlist.id).order_by('id')
        for item in item_queryset.iterator():
            TrackedSymbol.objects.get_or_create(
                user_id=watchlist.user_id,
                symbol=item.symbol,
                defaults={
                    'tenant_id': watchlist.tenant_id,
                    'source_watchlist_id': None,
                    'is_active': True,
                    'is_stale': False,
                },
            )


def noop_reverse(apps, schema_editor):
    return None


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0008_backfill_transaction_subaccount_tenant'),
    ]

    operations = [
        migrations.AddField(
            model_name='pricealert',
            name='cooldown_seconds',
            field=models.PositiveIntegerField(
                default=300,
                help_text='Số giây tối thiểu giữa hai lần kích hoạt liên tiếp.',
                verbose_name='Cooldown (giây)',
            ),
        ),
        migrations.CreateModel(
            name='TrackedSymbol',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('whale_alert_threshold_million', models.DecimalField(blank=True, decimal_places=2, default=None, max_digits=10, null=True, validators=[MinValueValidator(Decimal('1'))], verbose_name='Ngưỡng whale riêng (triệu VNĐ)')),
                ('is_active', models.BooleanField(db_index=True, default=True, verbose_name='Bật theo dõi')),
                ('is_stale', models.BooleanField(default=False, help_text='Đánh dấu nếu thống kê cần được tính toán lại.', verbose_name='Dữ liệu cũ?')),
                ('legacy_tracked_symbol_id', models.IntegerField(blank=True, db_index=True, null=True, verbose_name='ID tracked legacy')),
                ('added_at', models.DateTimeField(auto_now_add=True, verbose_name='Ngày thêm')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Ngày cập nhật')),
                ('source_watchlist', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='tracked_symbols', to='user_workspace.watchlist', verbose_name='Nhóm nguồn')),
                ('tenant', models.ForeignKey(blank=True, help_text='Tenant owner of this tracked symbol. Must be set after migration.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='core_tracked_symbols', to='identity_access.coretenant', verbose_name='Người dùng SaaS (Tenant)')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='core_tracked_symbols', to='auth.user', verbose_name='Người dùng')),
            ],
            options={
                'verbose_name': 'Mã theo dõi',
                'verbose_name_plural': 'Mã theo dõi',
                'ordering': ['-added_at', '-pk'],
                'unique_together': {('user', 'symbol')},
                'indexes': [models.Index(fields=['tenant', 'symbol', 'is_active'], name='user_worksp_tenant__0cf430_idx'), models.Index(fields=['user', 'symbol', 'is_active'], name='user_worksp_user_id_57fb92_idx')],
            },
        ),
        migrations.RunPython(backfill_tracked_symbols_from_default_watchlists, noop_reverse),
    ]