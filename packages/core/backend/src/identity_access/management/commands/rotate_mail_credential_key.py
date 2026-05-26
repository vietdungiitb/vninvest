# Location: packages/core/backend/src/identity_access/management/commands/rotate_mail_credential_key.py
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from cryptography.fernet import Fernet
from identity_access.models import SystemMailConfig
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Quản lý và thực thi xoay vòng (rotation) khóa mã hóa MAIL_CREDENTIAL_FERNET_KEY cho hạ tầng Mail Hệ thống."

    def add_arguments(self, parser):
        parser.add_argument(
            '--new-key',
            type=str,
            required=True,
            help='Khóa Fernet mới (32-bytes base64 encoded) được dùng để tái mã hóa secrets.',
        )

    def handle(self, *args, **options):
        new_key = options['new_key'].strip()
        
        # Kiểm tra độ dài khóa mới
        if len(new_key) != 44:
            self.stderr.write(self.style.ERROR("[x] Lỗi: Khóa mới bắt buộc phải là khóa Fernet hợp lệ (44 ký tự Base64)."))
            return

        old_key = os.environ.get('MAIL_CREDENTIAL_FERNET_KEY', '').strip()
        if not old_key:
            self.stderr.write(self.style.ERROR("[x] Lỗi: Biến môi trường hiện tại MAIL_CREDENTIAL_FERNET_KEY không được khai báo."))
            return

        try:
            old_cipher = Fernet(old_key.encode())
            new_cipher = Fernet(new_key.encode())
        except Exception as err:
            self.stderr.write(self.style.ERROR(f"[x] Lỗi khởi tạo khóa mã hóa: {str(err)}"))
            return

        configs = SystemMailConfig.objects.all()
        total = configs.count()
        self.stdout.write(self.style.WARNING(f"[*] Bắt đầu tiến trình xoay khóa cho {total} bản ghi SystemMailConfig..."))

        success_count = 0
        error_count = 0

        with transaction.atomic():
            for config in configs:
                modified = False
                try:
                    # 1. Rotate SMTP Password
                    if config.smtp_password_encrypted:
                        try:
                            # Decrypt with old key
                            plain_bytes = old_cipher.decrypt(bytes(config.smtp_password_encrypted))
                            # Encrypt with new key
                            config.smtp_password_encrypted = new_cipher.encrypt(plain_bytes)
                            modified = True
                        except Exception as e:
                            self.stderr.write(self.style.ERROR(f"  [!] Lỗi giải mã mật khẩu SMTP cho config ID {config.id}: {str(e)}"))
                            raise e

                    # 2. Rotate Google Service Account JSON
                    if config.google_service_account_json_encrypted:
                        try:
                            # Decrypt with old key
                            plain_bytes = old_cipher.decrypt(bytes(config.google_service_account_json_encrypted))
                            # Encrypt with new key
                            config.google_service_account_json_encrypted = new_cipher.encrypt(plain_bytes)
                            modified = True
                        except Exception as e:
                            self.stderr.write(self.style.ERROR(f"  [!] Lỗi giải mã Service Account JSON cho config ID {config.id}: {str(e)}"))
                            raise e

                    if modified:
                        config.save()
                        success_count += 1
                        self.stdout.write(self.style.SUCCESS(f"  [+] Đã cập nhật thành công khóa cho Config ID {config.id}."))
                except Exception as e:
                    error_count += 1

        if error_count > 0:
            self.stderr.write(self.style.ERROR(f"[x] Xoay khóa thất bại! Số bản ghi lỗi: {error_count}. Giao dịch đã bị rollback."))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"[+] HOÀN TẤT XOAY KHÓA: Đã cập nhật thành công {success_count}/{total} bản ghi. Hãy cập nhật MAIL_CREDENTIAL_FERNET_KEY trong env của web/worker server."
            ))
