"""
Management command: finalize_price_unit_migration

Phase 7 (optional): chuẩn hóa dữ liệu DailyPrice lịch sử về canonical THOUSAND_VND.

Mục tiêu:
- Chỉ nhận diện record nghi ngờ đang ở đơn vị VND đầy đủ (close_price quá lớn).
- Mặc định chạy DRY-RUN, KHONG ghi DB.
- Chỉ ghi DB khi truyền --force.

Usage:
  # Mặc định dry-run (an toàn)
  python manage.py finalize_price_unit_migration

  # Dry-run có giới hạn preview
  python manage.py finalize_price_unit_migration --limit 20

  # Chạy cho một số mã
  python manage.py finalize_price_unit_migration --symbol MBB FPT MWG

  # Ghi thay đổi thật (chia 1000 các trường OHLC)
  python manage.py finalize_price_unit_migration --force
"""

from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from portfolio.models import DailyPrice


class Command(BaseCommand):
    help = (
        "Finalize canonical price-unit migration for DailyPrice "
        "(safe default dry-run, write only with --force)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--symbol",
            nargs="+",
            type=str,
            metavar="SYMBOL",
            help="Chi xu ly cac ma nay (mac dinh: tat ca)",
        )
        parser.add_argument(
            "--start-date",
            type=str,
            help="Loc tu ngay (YYYY-MM-DD)",
        )
        parser.add_argument(
            "--end-date",
            type=str,
            help="Loc den ngay (YYYY-MM-DD)",
        )
        parser.add_argument(
            "--threshold",
            type=str,
            default="1000",
            help="Nguong close_price nghi ngo VND day du (mac dinh: 1000)",
        )
        parser.add_argument(
            "--divisor",
            type=str,
            default="1000",
            help="He so chuan hoa ve THOUSAND_VND (mac dinh: 1000)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=20,
            help="So dong preview (mac dinh: 20)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Ghi thay doi vao DB. Neu khong co --force se chi dry-run",
        )

    def handle(self, *args, **options):
        symbols = [s.upper().strip() for s in (options.get("symbol") or []) if s]
        start_date = options.get("start_date")
        end_date = options.get("end_date")
        limit = max(1, int(options.get("limit") or 20))
        apply_changes = bool(options.get("force"))

        threshold = Decimal(str(options.get("threshold") or "1000"))
        divisor = Decimal(str(options.get("divisor") or "1000"))

        if divisor == 0:
            self.stdout.write(self.style.ERROR("--divisor khong duoc bang 0"))
            return

        base_qs = DailyPrice.objects.all()
        if symbols:
            base_qs = base_qs.filter(symbol__in=symbols)
        if start_date:
            base_qs = base_qs.filter(date__gte=start_date)
        if end_date:
            base_qs = base_qs.filter(date__lte=end_date)

        suspicious_qs = base_qs.filter(close_price__gt=threshold)
        suspicious_count = suspicious_qs.count()
        total_scope = base_qs.count()

        self.stdout.write("=" * 72)
        self.stdout.write("PHASE 7 - FINALIZE PRICE UNIT MIGRATION")
        self.stdout.write("=" * 72)
        self.stdout.write(f"Scope records: {total_scope}")
        self.stdout.write(f"Suspicious records (close_price > {threshold}): {suspicious_count}")
        self.stdout.write(f"Mode: {'APPLY (--force)' if apply_changes else 'DRY-RUN (default)'}")

        if suspicious_count == 0:
            self.stdout.write(self.style.SUCCESS("Khong co record nao can migration."))
            return

        sample = list(suspicious_qs.order_by("symbol", "date")[:limit])
        self.stdout.write("\nPreview:")
        for row in sample:
            old_close = row.close_price
            new_close = (old_close / divisor) if old_close is not None else None
            self.stdout.write(
                f"- {row.symbol} {row.date}: close {old_close} -> {new_close}"
            )
        if suspicious_count > limit:
            self.stdout.write(f"... ({suspicious_count - limit} rows not shown)")

        if not apply_changes:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Dry-run complete. Khong co thay doi DB."))
            self.stdout.write(
                "Run with --force to apply migration, vi du: "
                "python manage.py finalize_price_unit_migration --force"
            )
            return

        updated = 0
        touched_symbols = set()
        with transaction.atomic():
            for row in suspicious_qs.select_for_update().iterator(chunk_size=500):
                row.open_price = (row.open_price / divisor) if row.open_price is not None else None
                row.high_price = (row.high_price / divisor) if row.high_price is not None else None
                row.low_price = (row.low_price / divisor) if row.low_price is not None else None
                row.close_price = row.close_price / divisor
                row.save(update_fields=["open_price", "high_price", "low_price", "close_price"])
                updated += 1
                touched_symbols.add(row.symbol)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Migration complete. Updated rows: {updated}"))
        self.stdout.write(f"Touched symbols: {', '.join(sorted(touched_symbols))}")
