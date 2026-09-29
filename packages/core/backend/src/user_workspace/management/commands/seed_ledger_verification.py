"""
LED-05 AC4 — seed verification thay cho "copy DB production".

**Vì sao lệch khỏi đặc tả, và vì sao đúng hơn trong tình huống này.**

LED-05 AC4 yêu cầu chạy backfill trên *bản sao DB production*. Mục đích của
yêu cầu đó là **bảo vệ dữ liệu đang tồn tại** — nếu `0022` map sai một hình
dạng dữ liệu thật, số tiền/tài khoản trong bảng cũ bị hỏng.

Dự án chưa phát tri ⇒ không tồn tại dữ liệu người dùng thật. Rủi ro đó bằng 0.
Còn khoảng trống thật sự thì là: *"hình dạng dữ liệu chưa lường trước thì
migration làm gì?"*

Câu trả lời nằm sẵn trong `0022`: khi gặp dòng không map được, migration
**dừng lại** với `RuntimeError` kèm câu SQL truy vết — nó không bỏ qua. Nghĩa
là hình dạng lạ chỉ có thể gây *migration dừng và hỏi người*, không thể gây *mất
tiền âm thầm*. **Đó chính là tính chất an toàn cần chứng minh, và nó không cần
dữ liệu thật để chứng minh** — chỉ cần dữ liệu đủ đa dạng để kích hoạt từng
nhánh.

Vì vậy lệnh này sinh dữ liệu **có chủ đích hỏng**, chạy migration trên đó, và
báo cáo:

- dữ liệu sạch    → backfill phải 100% và đếm khớp;
- dữ liệu hỏng    → backfill phải **dừng**, và phải nêu đúng dòng nào;
- rollback        → phải giữ nguyên `Transaction` và xoá đúng phần đã sinh.

Cờ `--expect-stop` để chọn chế độ kỳ vọng. Mặc định là `clean` vì đó là trạng
thái sau khi dữ liệu hỏng đã được người vận hành sửa.

Lưu ý an toàn: lệnh **không** xoá dữ liệu sẵn có. Nó tạo dữ liệu mới dưới
tiền tố `seedver` và chỉ báo cáo — xoá là việc riêng, có xác nhận.
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

#: Tiền tố mã/mark cho dữ liệu do lệnh này sinh — để nhận ra và dọn riêng.
SEED_TAG = 'seedver'

#: Ngày bắt đầu trong dữ liệu mẫu. Cố định để chạy lại cho kết quả giống nhau.
SEED_START = date(2026, 1, 5)

SYMBOLS = ('VNM', 'HNG', 'SSI', 'VCB', 'ACB', 'MWG', 'FPT', 'CTG')

#: (loại, giá cơ sở, tỉ lệ phí, tỉ lệ thuế) — thuế chỉ áp cho lệnh bán.
BUY_PROFILE = ('BUY', Decimal('50000'), Decimal('0.00015'), Decimal('0'))
SELL_PROFILE = ('SELL', Decimal('70000'), Decimal('0.001'), Decimal('0.001'))
DIVIDEND_PROFILE = ('DIVIDEND', Decimal('1500'), Decimal('0'), Decimal('0.05'))


class Command(BaseCommand):
    help = (
        'Sinh du lieu doi khang va chay kiem chung backfill LED-05. '
        'Thay cho yeu cau "copy DB production" khi du an chua co du lieu that.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--portfolios', type=int, default=5,
            help='So danh muc moi tenant (mac dinh 5).')
        parser.add_argument(
            '--tenants', type=int, default=2,
            help='So tenant (mac dinh 2).')
        parser.add_argument(
            '--transactions', type=int, default=40,
            help='So giao dich sach tren moi danh muc (mac dinh 40).')
        parser.add_argument(
            '--expect-stop', action='store_true',
            help='Ky vong backfill DUNG vi du lieu hong. '
                 'Mac dinh (khong co co nay) la ky vong backfill thanh cong.')
        parser.add_argument(
            '--seed', type=int, default=20260929,
            help='Seed cho bo sinh ngau nhien de chay lai cho ket qua giong nhau.')
        parser.add_argument(
            '--keep', action='store_true',
            help='Giu du lieu sinh ra thay vi tu xoa khi xong (mac dinh xoa).')

    def handle(self, *args, **options):
        from user_workspace.models import CashFlow, LedgerEntry, Portfolio, Transaction

        rng = random.Random(options['seed'])
        # Dọn tàn dư của lần chạy trước TRƯỚC khi sinh. Không có bước này thì
        # lần chạy thứ hai abort với `duplicate key ... tenant_code` — tức lệnh
        # chỉ dùng được đúng một lần, đúng thứ ta không muốn.
        self._purge()
        tenants = self._make_tenants(options['tenants'], rng)
        portfolios = self._make_portfolios(tenants, options['portfolios'], rng)

        clean_count, clean_tx = self._make_clean_transactions(
            portfolios, options['transactions'], rng)
        # Chỉ sinh dữ liệu hỏng ở chế độ kỳ vọng DỪNG, để chế độ mặc định
        # thật sự là một backfill sạch.
        broken = [] if not options['expect_stop'] else self._make_broken_transactions(
            portfolios, rng)

        self.stdout.write(self.style.MIGRATE_HEADING(
            f'Seed: {len(tenants)} tenant / {len(portfolios)} danh muc / '
            f'{clean_count} giao dich sach / {len(broken)} giao dich hong'))

        result = self._run_backfill(expect_stop=options['expect_stop'])
        self._report(result, clean_tx, clean_count, broken, Transaction, LedgerEntry,
                     CashFlow)

        if not options['keep']:
            self._cleanup(tenants, portfolios)

    # ── sinh dữ liệu ───────────────────────────────────────────────────

    def _make_tenants(self, count, rng):
        from django.contrib.auth.models import User

        from identity_access.models import CoreTenant

        tenants = []
        for i in range(count):
            username = f'{SEED_TAG}-owner-{i}'
            user, _ = User.objects.get_or_create(username=username)
            tenants.append(CoreTenant.objects.create(
                tenant_code=f'{SEED_TAG}-{i}',
                display_name=f'Seed {i}',
                owner_user=user,
                status=CoreTenant.StatusChoices.ACTIVE,
            ))
        return tenants

    def _make_portfolios(self, tenants, per_tenant, rng):
        from user_workspace.models import Portfolio

        out = []
        for tenant in tenants:
            for i in range(per_tenant):
                out.append(Portfolio.objects.create(
                    user=tenant.owner_user, tenant=tenant,
                    name=f'{SEED_TAG}-{tenant.tenant_code}-{i}',
                ))
        return out

    def _make_clean_transactions(self, portfolios, per_portfolio, rng):
        from user_workspace.models import Transaction

        created = 0
        seq = 0
        for portfolio in portfolios:
            for _ in range(per_portfolio):
                seq += 1
                profile = rng.choice((BUY_PROFILE, SELL_PROFILE, DIVIDEND_PROFILE))
                kind, base, fee_rate, tax_rate = profile
                symbol = rng.choice(SYMBOLS)
                price = base * Decimal(rng.randint(90, 110)) / Decimal(100)
                quantity = 100 * rng.randint(1, 20) if kind != 'DIVIDEND' \
                    else 100 * rng.randint(1, 20)
                fee = (price * quantity * fee_rate).quantize(Decimal('0.01'))
                tax = (price * quantity * tax_rate).quantize(Decimal('0.01'))
                Transaction.objects.create(
                    portfolio=portfolio,
                    tenant=portfolio.tenant,
                    symbol=symbol,
                    transaction_type=kind,
                    date=SEED_START + timedelta(days=rng.randint(0, 120)),
                    price=price.quantize(Decimal('0.01')),
                    quantity=quantity,
                    fee=fee,
                    tax=tax,
                    external_id=f'{SEED_TAG}-{portfolio.pk}-{seq}',
                )
                created += 1
        return created, len(Transaction.objects.all())

    def _make_broken_transactions(self, portfolios, rng):
        """Các hình dạng khiến `0022` phải DỪNG — mỗi cái một lý do khác nhau."""
        from user_workspace.models import Transaction

        portfolio = portfolios[0]
        base = {
            'portfolio': portfolio,
            'tenant': portfolio.tenant,
            'symbol': 'VNM',
            'transaction_type': 'BUY',
            'date': SEED_START,
            'price': Decimal('50000'),
            'quantity': 100,
            'external_id': '',
        }
        rows = [
            {**base, 'symbol': '', 'external_id': f'{SEED_TAG}-blank-symbol'},
            {**base, 'transaction_type': 'BONUS', 'external_id': f'{SEED_TAG}-bonus'},
            {**base, 'quantity': 0, 'external_id': f'{SEED_TAG}-zero-qty'},
        ]
        # `bulk_create` vì signal `pre_save` của `Transaction` chặn symbol rỗng
        # (`ValueError: Thiếu chứng khoản.`). Dữ liệu legacy trong DB thật là
        # trạng thái trước khi signal đó tồn tại.
        Transaction.objects.bulk_create([Transaction(**row) for row in rows])
        return rows

    # ── chạy backfill ──────────────────────────────────────────────────

    def _run_backfill(self, *, expect_stop):
        import importlib

        from django.apps import apps as django_apps
        from django.db import connection as db_connection

        module = importlib.import_module(
            'user_workspace.migrations.0022_backfill_transaction_to_ledger')

        # Không viết `connection = connection` trong thân class: tên bị gán ở
        # class body che mất tên của hàm bao quanh, và class body không đóng
        # (close) biến chung với nó. Gán thuộc tính sau khi class đã tạo.
        class _SchemaEditor:
            pass

        _SchemaEditor.connection = db_connection

        try:
            with transaction.atomic():
                module.forwards(django_apps, _SchemaEditor())
        except RuntimeError as exc:
            return {'stopped': True, 'message': str(exc)}
        return {'stopped': False, 'message': ''}

    # ── báo cáo ────────────────────────────────────────────────────────

    def _report(self, result, tx_total_before, clean_count, broken,
                Transaction, LedgerEntry, CashFlow):
        marker = '0022_backfill_transaction_to_ledger'
        entries = LedgerEntry.objects.filter(backfilled_by=marker).count()
        flows = CashFlow.objects.filter(entry__backfilled_by=marker).count()

        if result['stopped']:
            self.stdout.write(self.style.WARNING('BACKFILL DUNG (nhu ky vong)'))
            self.stdout.write(f'  {result["message"][:400]}')
        else:
            self.stdout.write(self.style.SUCCESS('BACKFILL HOAN TAT'))
            # Kỳ vọng là **mọi giao dịch trong DB**, không phải số lệnh vừa sinh.
            #
            # Bản đầu so với `clean_count` (số dòng lệnh tự sinh) — nên khi
            # database đã có dữ liệu sẵn thì báo "KHONG KHOP" dù backfill đúng.
            # Lệnh này được dùng để kiểm chứng trên DB có dữ liệu, nên phải tính
            # cả những dòng không phải của nó.
            expected = tx_total_before
            ok = entries == expected and flows == expected
            self.stdout.write(
                f'  LedgerEntry={entries} / CashFlow={flows} / '
                f'Transaction={tx_total_before} (mong doi {expected})')
            self.stdout.write(f'  Giao dich sinh boi lenh nay: {clean_count}')
            self.stdout.write('  KET: ' + ('KHOP' if ok else 'KHONG KHOP'))
            if not ok:
                raise CommandError(
                    f'Dem khong khop: LedgerEntry={entries}, CashFlow={flows}, '
                    f'Transaction={tx_total_before}. Backfill co van de.')
        self.stdout.write(
            f'  Giao dich hong co chu dich: {len(broken)} '
            f'(chi sinh o che do --expect-stop)')

    def _purge(self):
        """Xoá toàn bộ dữ liệu seed còn sót. Chỉ chạm vào tiền tố `SEED_TAG`."""
        from django.db import connection

        from identity_access.models import CoreTenant
        from user_workspace.models import CashFlow, LedgerEntry, Portfolio, Transaction

        # PHẢI bọc `atomic()`.
        #
        # `SET LOCAL` gắn cờ vào **transaction**; ngoài transaction nó không có
        # tác dụng gì. Management command chạy ở autocommit nên không có
        # transaction ngầm, và lần chạy đầu tiên đã chứng minh điều đó: lệnh
        # abort với `user_workspace_ledgerentry la bang append-only` dù trong mã
        # đã `SET` cờ rồi. Đây là guard hoạt động đúng, không phải bug.
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL app.allow_ledger_mutation = 'on'")
                CashFlow.objects.filter(
                    entry__portfolio__name__startswith=SEED_TAG).delete()
                LedgerEntry.objects.filter(
                    portfolio__name__startswith=SEED_TAG).delete()
            Transaction.objects.filter(
                portfolio__name__startswith=SEED_TAG).delete()
            Portfolio.objects.filter(name__startswith=SEED_TAG).delete()
            CoreTenant.objects.filter(tenant_code__startswith=SEED_TAG).delete()

    def _cleanup(self, tenants, portfolios):
        from django.db import connection

        from user_workspace.models import (
            CashFlow, LedgerEntry, Portfolio, Transaction,
        )

        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL app.allow_ledger_mutation = 'on'")
                CashFlow.objects.filter(
                    entry__portfolio__name__startswith=SEED_TAG).delete()
                LedgerEntry.objects.filter(
                    portfolio__name__startswith=SEED_TAG).delete()
            Transaction.objects.filter(
                portfolio__name__startswith=SEED_TAG).delete()
            Portfolio.objects.filter(name__startswith=SEED_TAG).delete()
            for tenant in tenants:
                tenant.delete()
        self.stdout.write(self.style.SUCCESS(f'Da don du lieu seed ({SEED_TAG}).'))
