"""
Dọn bản ghi idempotency hết hạn (D-12: TTL 7 ngày cho order).

Vì sao cần lệnh riêng: TTL không tự dọn. Nếu không xoá, bảng `IdempotencyRecord`
chỉ có một ràng buộc UNIQUE mà không có mốc thời gian nào được đặt lại — nghĩa là
key cũ **vīa hết hạn vẫn chặn** key mới, và AC5 của SAFE-02 ("bản ghi cũ hơn 7
ngày thì key tái sử dụng được") chỉ đúng khi có ai đó dọn.

Cố ý KHÔNG gắn vào migration: migration là việc một lần, còn TTL hết hạn là việc
lặp lại. Gộp hai thứ vào cùng một chỗ là cách làm khiến việc lặp lại bị bỏ sót.

Cách chạy (Celery beat hoặc cron):
    python manage.py purge_idempotency_records
"""
from django.core.management.base import BaseCommand

from user_workspace.services.idempotency import purge_expired


class Command(BaseCommand):
    help = 'Xoá ban ghi idempotency het han (TTL 7 ngay cho order, D-12).'

    def handle(self, *args, **options):
        deleted = purge_expired()
        self.stdout.write(
            self.style.SUCCESS(f'Da xoa {deleted} ban ghi idempotency het han.')
        )
