"""
Management command: sync_prices

Cách dùng:
  # Kéo giá 30 ngày gần nhất cho một mã cụ thể
  python manage.py sync_prices --symbol VNM

  # Kéo giá cho nhiều mã
  python manage.py sync_prices --symbol VNM VIC HPG

  # Kéo toàn bộ mã trong một Portfolio (theo id)
  python manage.py sync_prices --portfolio 1

  # Tuỳ chỉnh số ngày lịch sử
  python manage.py sync_prices --symbol VNM --days 90
"""

from django.core.management.base import BaseCommand

from portfolio.services import fetch_and_save_daily_prices, sync_portfolio_prices


class Command(BaseCommand):
    help = 'Đồng bộ giá đóng cửa (EOD) từ vnstock vào database.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbol',
            nargs='+',
            type=str,
            metavar='SYMBOL',
            help='Một hoặc nhiều mã chứng khoán (VD: VNM VIC HPG)',
        )
        parser.add_argument(
            '--portfolio',
            type=int,
            metavar='PORTFOLIO_ID',
            help='ID của Portfolio — sẽ sync tất cả mã trong danh mục đó',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            metavar='N',
            help='Số ngày lịch sử cần kéo (mặc định: 30)',
        )

    def handle(self, *args, **options):
        days = options['days']
        symbols = options.get('symbol') or []
        portfolio_id = options.get('portfolio')

        if not symbols and not portfolio_id:
            self.stderr.write(self.style.ERROR(
                'Cần cung cấp --symbol hoặc --portfolio. '
                'Dùng --help để xem hướng dẫn.'
            ))
            return

        # --- Sync theo Portfolio ---
        if portfolio_id:
            self.stdout.write(f'Đang sync toàn bộ mã trong Portfolio id={portfolio_id}...')
            results = sync_portfolio_prices(portfolio_id, days=days)
            for r in results:
                self._print_result(r)
            if not results:
                self.stdout.write(self.style.WARNING('Không tìm thấy mã nào trong portfolio này.'))
            return

        # --- Sync theo danh sách mã ---
        from datetime import date, timedelta
        start = date.today() - timedelta(days=days)

        for symbol in symbols:
            self.stdout.write(f'Đang kéo dữ liệu {symbol.upper()} ({days} ngày)...')
            result = fetch_and_save_daily_prices(symbol, start_date=start)
            self._print_result(result)

    def _print_result(self, result: dict):
        symbol = result['symbol']
        created = result['created']
        updated = result['updated']
        errors = result['errors']

        if errors and not created and not updated:
            self.stdout.write(self.style.ERROR(
                f'  {symbol}: THẤT BẠI (lỗi={errors})'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'  {symbol}: tạo mới={created}, cập nhật={updated}, lỗi={errors}'
            ))
