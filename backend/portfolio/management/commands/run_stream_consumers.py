"""
Management command: run_stream_consumers

Chạy consumer loop liên tục cho tất cả active symbols.
Mỗi symbol được xử lý tuần tự qua 3 consumer groups.

Usage:
    python manage.py run_stream_consumers
    python manage.py run_stream_consumers --group db-writer
    python manage.py run_stream_consumers --group ws-broadcaster
    python manage.py run_stream_consumers --group alert-engine
"""
from __future__ import annotations

import signal
import time
import logging

from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)

_running = True


def _handle_sigterm(signum, frame):
    global _running
    logger.info("SIGTERM received, stopping consumers...")
    _running = False


class Command(BaseCommand):
    help = "Chạy Redis Stream consumer loop cho tick data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--group",
            type=str,
            default="all",
            choices=["all", "db-writer", "ws-broadcaster", "alert-engine"],
            help="Consumer group cần chạy (mặc định: all)",
        )
        parser.add_argument(
            "--interval",
            type=float,
            default=1.0,
            help="Giây nghỉ giữa mỗi vòng lặp (mặc định: 1.0)",
        )

    def handle(self, *args, **options):
        global _running
        signal.signal(signal.SIGTERM, _handle_sigterm)
        signal.signal(signal.SIGINT, _handle_sigterm)

        group = options["group"]
        interval = options["interval"]

        self.stdout.write(self.style.SUCCESS(
            f"Starting stream consumers: group={group}, interval={interval}s"
        ))

        from portfolio.realtime.stream_consumers import (
            DbWriterConsumer,
            WsBroadcastConsumer,
            AlertEngineConsumer,
        )
        from portfolio.realtime.collector import collect_symbols_for_user

        consumers = []
        if group in ("all", "db-writer"):
            consumers.append(DbWriterConsumer())
        if group in ("all", "ws-broadcaster"):
            consumers.append(WsBroadcastConsumer())
        if group in ("all", "alert-engine"):
            consumers.append(AlertEngineConsumer())

        iteration = 0
        while _running:
            try:
                symbols = collect_symbols_for_user(user_id=None)
                if not symbols:
                    time.sleep(interval * 2)
                    continue

                total = 0
                for symbol in symbols:
                    for consumer in consumers:
                        total += consumer.run_once(symbol)

                iteration += 1
                if iteration % 60 == 0:
                    logger.info("Stream consumers alive: iteration=%d, symbols=%d, processed=%d",
                                iteration, len(symbols), total)

            except Exception as exc:
                logger.error("Consumer loop error: %s", exc)

            time.sleep(interval)

        self.stdout.write(self.style.WARNING("Stream consumers stopped."))
