"""
Management command: issue_vnbrokerchart_pat

Tạo service account và issue PAT token cho dự án vnbrokerchart.
Dùng sau khi deploy SaaS production, khi core-api đã online.

Usage:
    python src/manage.py issue_vnbrokerchart_pat --admin-username admin
    python src/manage.py issue_vnbrokerchart_pat --admin-username admin --scopes read_market write_signals
"""
import json

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant


class Command(BaseCommand):
    help = "Issue PAT token for service account 'vnbrokerchart' (for use as API key in vnbrokerchart project)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--admin-username',
            default='admin',
            help='Username của admin account sở hữu tenant (default: admin)',
        )
        parser.add_argument(
            '--scopes',
            nargs='+',
            default=['read_market', 'read_signals', 'read_advisory', 'read_portfolio'],
            help='Danh sách scopes cho PAT token',
        )
        parser.add_argument(
            '--label',
            default='vnbrokerchart-api-key',
            help='Nhãn cho PAT token',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            default=False,
            help='Tạo PAT mới dù service account đã tồn tại',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        admin_username = options['admin_username']
        scopes = options['scopes']
        label = options['label']
        force = options['force']

        # 1. Lấy admin user
        try:
            admin_user = User.objects.get(username=admin_username)
        except User.DoesNotExist:
            raise CommandError(f"User '{admin_username}' không tồn tại. Chạy createsuperuser trước.")

        # 2. Lấy hoặc tạo CoreTenant cho admin
        tenant, tenant_created = CoreTenant.objects.get_or_create(
            owner_user=admin_user,
            defaults={
                'tenant_code': f'tenant_{admin_username}',
                'display_name': f'{admin_username} Tenant',
                'plan': CoreTenant.PlanChoices.INTERNAL,
                'status': CoreTenant.StatusChoices.ACTIVE,
            },
        )
        if tenant_created:
            self.stdout.write(self.style.SUCCESS(f"[+] Đã tạo CoreTenant cho '{admin_username}'"))
        else:
            self.stdout.write(f"[~] CoreTenant đã tồn tại: {tenant.tenant_code}")

        # 3. Lấy hoặc tạo ServiceAccount vnbrokerchart
        sa, sa_created = CoreServiceAccount.objects.get_or_create(
            tenant=tenant,
            name='vnbrokerchart',
            defaults={
                'description': 'Service account cho dự án vnbrokerchart — đọc core APIs',
                'is_active': True,
            },
        )
        if sa_created:
            self.stdout.write(self.style.SUCCESS(f"[+] Đã tạo ServiceAccount 'vnbrokerchart' (id={sa.public_id})"))
        else:
            self.stdout.write(f"[~] ServiceAccount 'vnbrokerchart' đã tồn tại (id={sa.public_id})")
            if not force:
                existing_pats = CorePATCredential.objects.filter(
                    service_account=sa,
                    revoked=False,
                ).order_by('-created_at')
                if existing_pats.exists():
                    self.stdout.write(
                        self.style.WARNING(
                            f"[!] Đã có {existing_pats.count()} PAT token active. "
                            "Dùng --force để issue token mới."
                        )
                    )
                    self.stdout.write(
                        self.style.WARNING(
                            "    Token không hiển thị lại được — nếu mất, dùng --force để tạo token mới."
                        )
                    )
                    return

        # 4. Issue PAT token (no expiry = None)
        credential, raw_token = CorePATCredential.issue_for_service_account(
            service_account=sa,
            scopes=scopes,
            expires_at=None,
            label=label,
            audit_reason='Issued by issue_vnbrokerchart_pat management command',
        )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("  PAT TOKEN ISSUED SUCCESSFULLY"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("  Service Account : vnbrokerchart")
        self.stdout.write(f"  PAT ID          : {credential.public_id}")
        self.stdout.write(f"  Label           : {label}")
        self.stdout.write(f"  Scopes          : {json.dumps(scopes)}")
        self.stdout.write("  Expires         : Never")
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("  TOKEN (hiển thị 1 lần duy nhất — lưu ngay):"))
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"  {raw_token}"))
        self.stdout.write("")
        self.stdout.write("  Dùng làm Authorization header:")
        self.stdout.write(f"  Authorization: PAT {raw_token}")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("")
        self.stdout.write(self.style.WARNING(
            "  QUAN TRỌNG: Token này không thể xem lại.\n"
            "  Nếu mất, chạy lại lệnh với --force để issue token mới."
        ))
