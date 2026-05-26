# Location: packages/core/backend/src/identity_access/management/commands/backfill_missing_tenants.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from identity_access.models import CoreTenant, CoreServiceAccount, UserProfile
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Khôi phục hạ tầng Tenancy (CoreTenant, UserProfile, Service Account) cho người dùng cũ tránh lỗi login 403."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Chạy giả lập để đếm số lượng tài khoản lỗi mà không ghi đè thay đổi vào DB.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        # Tìm các tài khoản Django User thiếu hạ tầng CoreTenant
        legacy_users = User.objects.filter(core_tenant__isnull=True)
        total_found = legacy_users.count()

        self.stdout.write(self.style.WARNING(f"[*] Phát hiện {total_found} tài khoản người dùng cũ bị thiếu hạ tầng Tenancy."))
        
        if dry_run:
            self.stdout.write(self.style.SUCCESS("[+] Chế độ Dry-run hoạt động: Không có thay đổi nào được ghi nhận."))
            return

        success_count = 0
        error_count = 0

        for user in legacy_users:
            try:
                # Wrap isolated transaction cho từng user
                with transaction.atomic():
                    # 1. Tạo CoreTenant
                    tenant = CoreTenant.objects.create(
                        owner_user=user,
                        tenant_code=f"tenant_{user.username}",
                        display_name=f"{user.get_full_name().strip() or user.username}'s Workspace",
                        plan=CoreTenant.PlanChoices.FREE,
                        status=CoreTenant.StatusChoices.ACTIVE
                    )

                    # 2. Tạo UserProfile
                    UserProfile.objects.get_or_create(
                        user=user,
                        defaults={
                            'tenant': tenant,
                            'display_name': user.get_full_name().strip() or user.username,
                            'theme': 'dark',
                            'language': 'vi'
                        }
                    )

                    # 3. Tạo default active CoreServiceAccount
                    # Nâng scopes AI đầy đủ nếu email người dùng cũ đã được xác thực trước đó
                    default_scopes = ['market:read', 'signals:read', 'ai:invoke', 'manage_pats'] if user.is_active else ['market:read', 'signals:read']
                    
                    CoreServiceAccount.objects.create(
                        tenant=tenant,
                        name="default",
                        status=CoreServiceAccount.StatusChoices.ACTIVE,
                        scopes=default_scopes
                    )

                success_count += 1
                if success_count % 10 == 0:
                    self.stdout.write(f"  [+] Đã xử lý khôi phục thành công {success_count}/{total_found} users...")

            except Exception as e:
                error_count += 1
                logger.error(f"Failed to backfill tenancy for user {user.username}: {str(e)}")
                self.stderr.write(self.style.ERROR(f"  [x] Lỗi di cư tài khoản {user.username}: {str(e)}"))

        self.stdout.write(self.style.SUCCESS(
            f"[+] BÀN GIAO HOÀN TẤT: Di cư thành công {success_count} tài khoản. Thất bại: {error_count}."
        ))
