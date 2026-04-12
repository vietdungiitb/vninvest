"""
Management command: normalize_daily_prices

Sửa DailyPrice records bị lưu đơn vị sai (VNĐ đầy đủ thay vì nghìn VNĐ).
Nguyên nhân: fetch_and_save_daily_prices từng dùng source='KBS' trả về giá VNĐ đầy đủ,
trong khi hệ thống kỳ vọng giá nghìn VNĐ (giống VCI source).

Cách dùng:
  # Xem preview không sửa
  python manage.py normalize_daily_prices --dry-run

  # Sửa toàn bộ records bị sai
  python manage.py normalize_daily_prices

  # Chỉ sửa một vài mã cụ thể
  python manage.py normalize_daily_prices --symbol MBB MWG FPT
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from portfolio.models import DailyPrice

# Ngưỡng: giá nghìn VNĐ của VN stocks không vượt quá 1000 (= 1,000,000 VNĐ)
# MBS=20.80, TPB=16.30 → đúng; MBB=30343.80, FPT=115700 → sai
PRICE_THRESHOLD = Decimal('1000')
DIVISOR = Decimal('1000')


class Command(BaseCommand):
    help = 'Normalize DailyPrice records bị lưu đơn vị VNĐ đầy đủ (KBS source) sang nghìn VNĐ.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbol',
            nargs='+',
            type=str,
            metavar='SYMBOL',
            help='Chỉ xử lý các mã này (mặc định: tất cả)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Chỉ in ra records sẽ bị sửa, không ghi vào DB',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        symbols = [s.upper() for s in options['symbol']] if options['symbol'] else None

        qs = DailyPrice.objects.filter(close_price__gt=PRICE_THRESHOLD)
        if symbols:
            qs = qs.filter(symbol__in=symbols)

        count = qs.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Không tìm thấy record nào cần normalize.'))
            return

        self.stdout.write(f'Tìm thấy {count} records có close_price > {PRICE_THRESHOLD}:')

        affected_symbols = qs.values_list('symbol', flat=True).distinct()
        self.stdout.write(f'  Mã bị ảnh hưởng: {", ".join(sorted(affected_symbols))}')

        if dry_run:
            for record in qs.order_by('symbol', 'date')[:20]:
                normalized = record.close_price / DIVISOR
                self.stdout.write(
                    f'  [DRY-RUN] {record.symbol} {record.date}: '
                    f'{record.close_price} → {normalized:.2f}'
                )
            if count > 20:
                self.stdout.write(f'  ... còn {count - 20} records nữa')
            self.stdout.write(self.style.WARNING('Dry-run: không có thay đổi nào được lưu.'))
            return

        with transaction.atomic():
            updated = 0
            for record in qs.select_for_update():
                record.open_price = record.open_price / DIVISOR if record.open_price is not None else None
                record.high_price = record.high_price / DIVISOR if record.high_price is not None else None
                record.low_price = record.low_price / DIVISOR if record.low_price is not None else None
                record.close_price = record.close_price / DIVISOR
                record.save(update_fields=['open_price', 'high_price', 'low_price', 'close_price'])
                updated += 1

        self.stdout.write(
            self.style.SUCCESS(f'Đã normalize {updated} records. Source đã được đổi sang VCI.')
        )
