"""
Backfill IntradayTick.side using a previous-close seeded tick-rule.

Default mode is dry-run. Use --force to apply DB updates.
"""

from __future__ import annotations

from collections import Counter
from decimal import Decimal
from functools import lru_cache

from django.core.management.base import BaseCommand
from django.db import transaction

from portfolio.models import DailyPrice, IntradayTick


class Command(BaseCommand):
    help = (
        "Backfill IntradayTick.side by inferring BUY/SELL/UNKNOWN from "
        "price movement seeded with previous close."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--symbol",
            nargs="+",
            type=str,
            metavar="SYMBOL",
            help="Only process these symbols (default: all symbols)",
        )
        parser.add_argument(
            "--start-date",
            type=str,
            help="Filter from trade_date (YYYY-MM-DD)",
        )
        parser.add_argument(
            "--end-date",
            type=str,
            help="Filter to trade_date (YYYY-MM-DD)",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=2000,
            help="DB iterator chunk size (default: 2000)",
        )
        parser.add_argument(
            "--limit-preview",
            type=int,
            default=20,
            help="Preview changed rows count (default: 20)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Apply updates. Without this flag command runs dry-run only.",
        )

    @staticmethod
    def _normalize_side(value: str) -> str:
        raw = str(value or "").strip().upper()
        if raw in {"BUY", "BU", "B"}:
            return "BUY"
        if raw in {"SELL", "SD", "S"}:
            return "SELL"
        return "UNKNOWN"

    @lru_cache(maxsize=50000)
    def _get_previous_close(self, symbol: str, trade_date) -> float | None:
        row = (
            DailyPrice.objects
            .filter(symbol=symbol, date__lt=trade_date)
            .order_by("-date")
            .values("close_price")
            .first()
        )
        if not row:
            return None
        try:
            value = float(row.get("close_price") or 0)
        except (TypeError, ValueError):
            return None
        return value if value > 0 else None

    def handle(self, *args, **options):
        symbols = [s.strip().upper() for s in (options.get("symbol") or []) if str(s).strip()]
        start_date = options.get("start_date")
        end_date = options.get("end_date")
        batch_size = max(100, int(options.get("batch_size") or 2000))
        preview_limit = max(1, int(options.get("limit_preview") or 20))
        apply_changes = bool(options.get("force"))

        qs = IntradayTick.objects.all()
        if symbols:
            qs = qs.filter(symbol__in=symbols)
        if start_date:
            qs = qs.filter(trade_date__gte=start_date)
        if end_date:
            qs = qs.filter(trade_date__lte=end_date)

        total_rows = qs.count()
        self.stdout.write("=" * 72)
        self.stdout.write("BACKFILL INTRADAY SIDE")
        self.stdout.write("=" * 72)
        self.stdout.write(f"Scope rows: {total_rows}")
        self.stdout.write(f"Mode: {'APPLY (--force)' if apply_changes else 'DRY-RUN'}")

        if total_rows == 0:
            self.stdout.write(self.style.SUCCESS("No rows in scope."))
            return

        rows = (
            qs.order_by("symbol", "trade_date", "trade_time", "id")
            .values("id", "symbol", "trade_date", "trade_time", "price", "side")
        )

        transition_counter = Counter()
        inferred_counter = Counter()
        changed_preview = []
        changed_ids_to_side: dict[int, str] = {}

        current_group = None
        prev_price = None
        last_side = "UNKNOWN"

        for row in rows.iterator(chunk_size=batch_size):
            symbol = row["symbol"]
            trade_date = row["trade_date"]
            group_key = (symbol, trade_date)

            if group_key != current_group:
                current_group = group_key
                prev_price = self._get_previous_close(symbol, trade_date)
                last_side = "UNKNOWN"

            stored_side = self._normalize_side(row.get("side") or "")
            price_raw = row.get("price")
            price = float(price_raw or 0) if isinstance(price_raw, (int, float, Decimal)) else 0.0

            if prev_price is None:
                inferred = stored_side
            elif price > prev_price:
                inferred = "BUY"
            elif price < prev_price:
                inferred = "SELL"
            else:
                inferred = last_side if last_side in {"BUY", "SELL"} else stored_side

            if inferred not in {"BUY", "SELL"}:
                inferred = "UNKNOWN"

            if inferred in {"BUY", "SELL"}:
                last_side = inferred
            if price > 0:
                prev_price = price

            inferred_counter[inferred] += 1

            if inferred != stored_side:
                transition_key = f"{stored_side}->{inferred}"
                transition_counter[transition_key] += 1
                changed_ids_to_side[int(row["id"])] = inferred
                if len(changed_preview) < preview_limit:
                    changed_preview.append(
                        {
                            "id": int(row["id"]),
                            "symbol": symbol,
                            "trade_date": str(trade_date),
                            "trade_time": str(row.get("trade_time") or ""),
                            "price": price,
                            "old_side": stored_side,
                            "new_side": inferred,
                        }
                    )

        changed_count = len(changed_ids_to_side)
        self.stdout.write(f"Changed rows: {changed_count}")
        self.stdout.write(f"Inferred distribution: {dict(inferred_counter)}")
        self.stdout.write(f"Transitions: {dict(transition_counter)}")

        if changed_preview:
            self.stdout.write("Preview changed rows:")
            for item in changed_preview:
                self.stdout.write(
                    f"- id={item['id']} {item['symbol']} {item['trade_date']} {item['trade_time']} "
                    f"price={item['price']} {item['old_side']} -> {item['new_side']}"
                )

        if not apply_changes:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Dry-run complete. No DB changes."))
            self.stdout.write(
                "Apply with: python manage.py backfill_intraday_tick_side --force "
                "[--symbol VIC] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD]"
            )
            return

        if changed_count == 0:
            self.stdout.write(self.style.SUCCESS("No side changes to apply."))
            return

        updated = 0
        with transaction.atomic():
            for row in IntradayTick.objects.filter(id__in=list(changed_ids_to_side.keys())).only("id", "side"):
                new_side = changed_ids_to_side.get(int(row.id))
                if new_side and row.side != new_side:
                    row.side = new_side
                    row.save(update_fields=["side"])
                    updated += 1

        self.stdout.write(self.style.SUCCESS(f"Apply complete. Updated rows: {updated}"))
