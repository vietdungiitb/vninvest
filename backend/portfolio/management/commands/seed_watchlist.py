"""
Management command: seed_watchlist

Tự động lấy toàn bộ nhóm ngành ICB và nhóm vốn hóa từ vnbroker,
sau đó tạo WatchlistGroup + WatchlistItem cho một user chỉ định.

Cách dùng:
    python manage.py seed_watchlist --username phamvietdung
    python manage.py seed_watchlist --username phamvietdung --mode sectors
    python manage.py seed_watchlist --username phamvietdung --mode caps
    python manage.py seed_watchlist --username phamvietdung --mode manual
    python manage.py seed_watchlist --username phamvietdung --clear
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User

from portfolio.models import WatchlistGroup, WatchlistItem
from portfolio.services import fetch_market_sectors_and_groups


class Command(BaseCommand):
    help = 'Tạo Watchlist groups từ dữ liệu thị trường vnbroker (ICB sectors + VN30/VN100/HNX30)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username', type=str, required=True,
            help='Username của user cần seed watchlist',
        )
        parser.add_argument(
            '--mode', type=str, default='all',
            choices=['all', 'sectors', 'caps', 'manual'],
            help='all=tất cả | sectors=chỉ ngành | caps=chỉ vốn hóa | manual=danh sách cứng',
        )
        parser.add_argument(
            '--clear', action='store_true',
            help='Xóa toàn bộ watchlist hiện tại của user trước khi seed',
        )

    def handle(self, *args, **options):
        username = options['username']
        mode = options['mode']
        clear = options['clear']

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f'User "{username}" không tồn tại.')

        if clear:
            deleted_count = WatchlistGroup.objects.filter(user=user).count()
            WatchlistGroup.objects.filter(user=user).delete()
            self.stdout.write(self.style.WARNING(
                f'Đã xóa {deleted_count} nhóm watchlist của {username}.'
            ))

        if mode == 'manual':
            self._seed_manual(user)
            return

        self.stdout.write(f'Đang lấy dữ liệu thị trường từ vnbroker (source=VCI)...')
        data = fetch_market_sectors_and_groups()

        if data['error']:
            self.stdout.write(self.style.WARNING(
                f'vnbroker lỗi: {data["error"]}\nChuyển sang chế độ manual...'
            ))
            self._seed_manual(user)
            return

        groups_to_create = []

        if mode in ('all', 'sectors'):
            for i, sector in enumerate(data['sectors']):
                groups_to_create.append({
                    'name': sector['name'],
                    'group_type': 'SECTOR',
                    'description': sector['description'],
                    'color': sector['color'],
                    'order': i + 1,
                    'symbols': sector['symbols'],
                })
            self.stdout.write(f'  Tìm thấy {len(data["sectors"])} nhóm ngành ICB.')

        if mode in ('all', 'caps'):
            offset = len(groups_to_create)
            for i, cap in enumerate(data['cap_groups']):
                groups_to_create.append({
                    'name': cap['name'],
                    'group_type': 'MARKET_CAP',
                    'description': cap['description'],
                    'color': cap['color'],
                    'order': offset + i + 1,
                    'symbols': cap['symbols'],
                })
            self.stdout.write(f'  Tìm thấy {len(data["cap_groups"])} nhóm vốn hóa.')

        created, updated = self._apply(user, groups_to_create)
        self._print_summary(created, updated)

    def _apply(self, user, groups: list) -> tuple[list, list]:
        created_list = []
        updated_list = []

        for g in groups:
            symbols = g.pop('symbols', [])
            group, created = WatchlistGroup.objects.get_or_create(
                user=user, name=g['name'],
                defaults={k: v for k, v in g.items() if k != 'name'},
            )
            added = 0
            for i, sym in enumerate(symbols):
                _, sym_created = WatchlistItem.objects.get_or_create(
                    group=group, symbol=sym.upper(),
                    defaults={'order': i},
                )
                if sym_created:
                    added += 1

            if created:
                created_list.append((group.name, len(symbols)))
            elif added:
                updated_list.append((group.name, added))

            g['symbols'] = symbols

        return created_list, updated_list

    def _print_summary(self, created, updated):
        if created:
            self.stdout.write(self.style.SUCCESS(
                f'\nĐã tạo {len(created)} nhóm mới:'
            ))
            for name, count in created:
                self.stdout.write(f'  + {name} ({count} mã)')
        if updated:
            self.stdout.write(self.style.SUCCESS(
                f'\nCập nhật thêm mã vào {len(updated)} nhóm:'
            ))
            for name, count in updated:
                self.stdout.write(f'  ~ {name} (+{count} mã mới)')
        if not created and not updated:
            self.stdout.write(self.style.WARNING('Tất cả nhóm đã tồn tại, không có thay đổi.'))

    def _seed_manual(self, user):
        """Fallback: danh sách ngành cứng khi vnbroker lỗi."""
        MANUAL_GROUPS = [
            {'name': 'Ngân hàng',         'group_type': 'SECTOR',     'color': '#3b82f6', 'order': 1,
             'description': 'Nhóm ngân hàng',
             'symbols': ['ACB','BID','CTG','EIB','HDB','LPB','MBB','MSB','OCB','SHB','SSB','STB','TCB','TPB','VCB','VIB','VPB']},
            {'name': 'Bất động sản',      'group_type': 'SECTOR',     'color': '#f59e0b', 'order': 2,
             'description': 'Nhóm bất động sản',
             'symbols': ['BCM','CEO','DIG','DXG','KBC','KDH','NLG','NVL','PDR','SJS','TDH','VHM','VIC','VRE']},
            {'name': 'Thép & Vật liệu',   'group_type': 'SECTOR',     'color': '#ef4444', 'order': 3,
             'description': 'Nhóm thép và vật liệu xây dựng',
             'symbols': ['BMP','HPG','HSG','NKG','TLH','VGC','VIS']},
            {'name': 'Dầu khí',           'group_type': 'SECTOR',     'color': '#8b5cf6', 'order': 4,
             'description': 'Nhóm dầu khí và năng lượng',
             'symbols': ['GAS','OIL','PLX','PVD','PVS','PVT']},
            {'name': 'Công nghệ',         'group_type': 'SECTOR',     'color': '#22c55e', 'order': 5,
             'description': 'Nhóm công nghệ',
             'symbols': ['CMG','ELC','FPT','SAM','VGI']},
            {'name': 'Bán lẻ & Tiêu dùng','group_type': 'SECTOR',     'color': '#ec4899', 'order': 6,
             'description': 'Nhóm bán lẻ và hàng tiêu dùng',
             'symbols': ['MSN','MWG','PNJ','SAB','VNM']},
            {'name': 'VN30',              'group_type': 'MARKET_CAP', 'color': '#6366f1', 'order': 7,
             'description': 'Top 30 cổ phiếu vốn hóa lớn HOSE',
             'symbols': ['ACB','BID','CTG','DGC','FPT','GAS','GVR','HDB','HPG','LPB','MBB','MSN',
                         'MWG','PLX','SAB','SHB','SSB','SSI','STB','TCB','TPB','VCB','VHM','VIB',
                         'VIC','VJC','VNM','VPB','VPL','VRE']},
        ]
        created, updated = self._apply(user, [dict(g) for g in MANUAL_GROUPS])
        self._print_summary(created, updated)
