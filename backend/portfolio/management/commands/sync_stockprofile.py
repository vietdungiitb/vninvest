"""
Management command: sync_stockprofile

Tự động lấy toàn bộ mã chứng khoán, nhóm ngành, sàn giao dịch từ vnbroker
và lưu vào bảng StockProfile.

Cách dùng:
    python manage.py sync_stockprofile
"""

from django.core.management.base import BaseCommand
from portfolio.services import sync_stock_profiles

class Command(BaseCommand):
    help = 'Đồng bộ toàn bộ mã chứng khoán, nhóm ngành, sàn giao dịch từ vnbroker về StockProfile.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--mode', type=str, default='all', choices=['all', 'sectors', 'caps', 'manual'],
            help='all=tất cả | sectors=ưu tiên nhóm ngành | caps=nhóm vốn hóa | manual=danh sách cứng',
        )

    def handle(self, *args, **options):
        result = sync_stock_profiles(mode=options['mode'])
        if result['warning']:
            self.stdout.write(self.style.WARNING(result['warning']))
        if result['success']:
            self.stdout.write(self.style.SUCCESS(result['message']))
            return
        self.stdout.write(self.style.ERROR(result.get('error') or result['message']))
