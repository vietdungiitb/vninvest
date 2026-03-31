"""
Management command: sync_stockprofile

Tự động lấy toàn bộ mã chứng khoán, nhóm ngành, sàn giao dịch từ vnstock
và lưu vào bảng StockProfile.

Cách dùng:
    python manage.py sync_stockprofile
"""

from django.core.management.base import BaseCommand
from portfolio.models import StockProfile
from portfolio.services import fetch_market_sectors_and_groups
from django.db import transaction

class Command(BaseCommand):
    help = 'Đồng bộ toàn bộ mã chứng khoán, nhóm ngành, sàn giao dịch từ vnstock về StockProfile.'

    def handle(self, *args, **options):
        self.stdout.write('Đang lấy dữ liệu mã chứng khoán và nhóm ngành từ vnstock...')
        data = fetch_market_sectors_and_groups()
        if data['error']:
            self.stdout.write(self.style.ERROR(f'Lỗi khi lấy dữ liệu từ vnstock: {data["error"]}'))
            return

        total = 0
        updated = 0
        with transaction.atomic():
            for sector in data['sectors']:
                industry = sector['name']
                for symbol in sector['symbols']:
                    obj, created = StockProfile.objects.update_or_create(
                        symbol=symbol,
                        defaults={
                            'industry': industry,
                            'exchange': '',  # Có thể cập nhật sau nếu cần
                            'company_name': '',  # Có thể cập nhật sau nếu cần
                            'is_active': True,
                        }
                    )
                    total += 1
                    if not created:
                        updated += 1
        self.stdout.write(self.style.SUCCESS(f'Đã đồng bộ {total} mã chứng khoán (cập nhật: {updated}).'))
