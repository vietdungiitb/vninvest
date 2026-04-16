"""
Management command: normalize_intraday_tick_price_unit

Chuẩn hóa dữ liệu IntradayTick lịch sử về canonical THOUSAND_VND.

Bối cảnh:
- Legacy rows có thể lưu `price` ở VND đầy đủ (ví dụ 65100) trong khi
  canonical yêu cầu THOUSAND_VND (ví dụ 65.1).
- Whale matched_value tính theo VND nên mixed-unit dễ gây sai số x1000.

Mặc định command chạy DRY-RUN; chỉ ghi DB khi truyền --force.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import transaction

from portfolio.models import IntradayTick


class Command(BaseCommand):
    help = (
        "Normalize IntradayTick.price to THOUSAND_VND canonical "
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
            help="Loc tu ngay giao dich (YYYY-MM-DD)",
        )
        parser.add_argument(
            "--end-date",
            type=str,
            help="Loc den ngay giao dich (YYYY-MM-DD)",
        )
        parser.add_argument(
            "--price-threshold",
            type=str,
            default="1000",
            help="Nguong nghi ngo dang la VND day du (mac dinh: 1000)",
        )
        parser.add_argument(
            "--divisor",
            type=str,
            default="1000",
            help="He so quy doi ve THOUSAND_VND (mac dinh: 1000)",
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

        threshold = Decimal(str(options.get("price_threshold") or "1000"))
        divisor = Decimal(str(options.get("divisor") or "1000"))

        if divisor == 0:
            self.stdout.write(self.style.ERROR("--divisor khong duoc bang 0"))
            return

        base_qs = IntradayTick.objects.all()
        if symbols:
            base_qs = base_qs.filter(symbol__in=symbols)
        if start_date:
            base_qs = base_qs.filter(trade_date__gte=start_date)
        if end_date:
            base_qs = base_qs.filter(trade_date__lte=end_date)

        suspicious_qs = base_qs.filter(price__gte=threshold)
        suspicious_count = suspicious_qs.count()
        total_scope = base_qs.count()

        self.stdout.write("=" * 72)
        self.stdout.write("NORMALIZE INTRADAY TICK PRICE UNIT")
        self.stdout.write("=" * 72)
        self.stdout.write(f"Scope records: {total_scope}")
        self.stdout.write(f"Suspicious rows (price >= {threshold}): {suspicious_count}")
        self.stdout.write(f"Mode: {'APPLY (--force)' if apply_changes else 'DRY-RUN (default)'}")

        if suspicious_count == 0:
            self.stdout.write(self.style.SUCCESS("Khong co row nao can migration."))
            return

        sample = list(suspicious_qs.order_by("symbol", "trade_date", "trade_time")[:limit])
        self.stdout.write("\nPreview:")
        for row in sample:
            old_price = Decimal(str(row.price))
            new_price = (old_price / divisor).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
            self.stdout.write(
                f"- {row.symbol} {row.trade_date} {row.trade_time}: price {old_price} -> {new_price}"
            )
        if suspicious_count > limit:
            self.stdout.write(f"... ({suspicious_count - limit} rows not shown)")

        if not apply_changes:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Dry-run complete. Khong co thay doi DB."))
            self.stdout.write(
                "Run with --force to apply migration, vi du: "
                "python manage.py normalize_intraday_tick_price_unit --force"
            )
            return

        updated = 0
        touched_symbols = set()

        with transaction.atomic():
            for row in suspicious_qs.select_for_update().iterator(chunk_size=500):
                old_price = Decimal(str(row.price))
                row.price = (old_price / divisor).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
                row.save(update_fields=["price"])
                updated += 1
                touched_symbols.add(row.symbol)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Migration complete. Updated rows: {updated}"))
        self.stdout.write(f"Touched symbols: {', '.join(sorted(touched_symbols))}")
