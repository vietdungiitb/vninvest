from django.core.management.base import BaseCommand

from portfolio.tasks import sync_all_watch_assets, sync_user_watch_assets


class Command(BaseCommand):
    help = 'Đồng bộ giá cho tracked symbols, danh sách theo dõi cá nhân và nhóm thị trường.'

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, help='Chỉ sync cho một user cụ thể.')
        parser.add_argument('--days', type=int, default=5, help='Số ngày dữ liệu cần sync.')
        parser.add_argument('--async', dest='run_async', action='store_true', help='Dispatch qua Celery worker thay vì chạy đồng bộ.')

    def handle(self, *args, **options):
        user_id = options.get('user_id')
        days = options.get('days') or 5
        run_async = options.get('run_async', False)

        if user_id:
            if run_async:
                task = sync_user_watch_assets.delay(user_id=user_id, days=days)
                self.stdout.write(self.style.SUCCESS(f'Đã dispatch sync user {user_id}. Task id: {task.id}'))
                return

            result = sync_user_watch_assets(user_id=user_id, days=days)
            self.stdout.write(self.style.SUCCESS(str(result)))
            return

        if run_async:
            task = sync_all_watch_assets.delay(days=days)
            self.stdout.write(self.style.SUCCESS(f'Đã dispatch sync toàn bộ user. Task id: {task.id}'))
            return

        result = sync_all_watch_assets(days=days)
        self.stdout.write(self.style.SUCCESS(str(result)))
