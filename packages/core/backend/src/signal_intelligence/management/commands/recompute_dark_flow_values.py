"""
One-shot recompute cho dark_flow OrderFlowEvent bị sai đơn vị (Entry 194).

Bug gốc: volume_at_signal = tổng buy_count (số ĐẾM tick) thay vì tổng shares
→ materializer tính matched_value = price × count ra vài triệu đồng, trong khi
evidence window buy_value hàng tỷ (VD DGW: 2.102.200đ vs 1.767.185.000đ).

Lệnh này sửa các event cũ theo thứ tự ưu tiên:
  1. metadata.windows đã có buy_volume (event tạo sau fix) → kiểm tra, gắn cờ.
  2. IntradayTick của (symbol, session_date) còn trong DB → recompute chính xác
     buy VWAP + tổng shares từ ticks BUY trong các window đã detect.
  3. Fallback: ước lượng shares = round(buy_value / price_at_signal).
Cuối cùng chạy materialize_unified_alerts để sync UnifiedAlert
(value/title/confidence/severity/evidence).

Idempotent: đánh dấu metadata['recomputed_v2']=True; chạy lại sẽ skip,
trừ khi --force.

Usage:
    python manage.py recompute_dark_flow_values --dry-run
    python manage.py recompute_dark_flow_values --symbol DGW --limit 50
    python manage.py recompute_dark_flow_values --force --skip-materialize
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

RECOMPUTE_FLAG = 'recomputed_v2'


class Command(BaseCommand):
    help = "Recompute price/volume (shares) cho dark_flow OrderFlowEvent cũ bị sai đơn vị (Entry 194)."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Chỉ in, không ghi DB')
        parser.add_argument('--force', action='store_true', help='Xử lý lại cả event đã gắn cờ')
        parser.add_argument('--limit', type=int, default=0, help='Giới hạn số event (0 = tất cả)')
        parser.add_argument('--symbol', type=str, default='', help='Chỉ xử lý 1 mã (VD DGW)')
        parser.add_argument('--skip-materialize', action='store_true',
                            help='Không chạy materialize_unified_alerts ở cuối')

    def handle(self, *args, **options):
        from signal_intelligence.models import OrderFlowEvent

        dry_run = options['dry_run']
        force = options['force']
        limit = options['limit'] or 0
        symbol = (options['symbol'] or '').upper()
        skip_materialize = options['skip_materialize']

        qs = OrderFlowEvent.objects.filter(
            signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
        ).order_by('-triggered_at', '-pk')
        if symbol:
            qs = qs.filter(symbol=symbol)
        if limit:
            qs = qs[:limit]

        stats = {'fixed_windows': 0, 'fixed_ticks': 0, 'fixed_estimate': 0,
                 'already_ok': 0, 'skipped': 0, 'no_data': 0}
        for event in qs.iterator():
            result = self._fix_event(event, force=force, dry_run=dry_run)
            stats[result] += 1

        self.stdout.write(
            f"dark_flow recompute: fixed_windows={stats['fixed_windows']} "
            f"fixed_ticks={stats['fixed_ticks']} "
            f"fixed_estimate={stats['fixed_estimate']} "
            f"already_ok={stats['already_ok']} skipped={stats['skipped']} "
            f"no_data={stats['no_data']}{' [DRY-RUN]' if dry_run else ''}"
        )

        if dry_run or skip_materialize:
            return
        from signal_intelligence.materializers import materialize_unified_alerts
        res = materialize_unified_alerts.run()
        self.stdout.write(f"materialize: dark_synced={res.get('dark_synced')}")

    def _fix_event(self, event, force, dry_run):
        metadata = dict(event.metadata or {})
        if metadata.get(RECOMPUTE_FLAG) and not force:
            return 'skipped'

        windows = metadata.get('windows') or []
        total_buy_value = float(sum(float(w.get('buy_value') or 0) for w in windows))
        total_buy_volume = int(sum(int(w.get('buy_volume') or 0) for w in windows))
        if total_buy_value <= 0:
            return 'no_data'

        source = 'windows'
        if total_buy_volume > 0:
            vwap = total_buy_value / total_buy_volume
        else:
            recomputed = self._recompute_from_ticks(event, windows)
            if recomputed is None:
                price = float(event.price_at_signal or 0)
                if price <= 0:
                    return 'no_data'
                total_buy_volume = int(round(total_buy_value / price))
                vwap = float(event.price_at_signal)
                source = 'estimate'
            else:
                total_buy_value, total_buy_volume, vwap = recomputed
                source = 'ticks'

        new_price = Decimal(str(round(vwap, 2)))
        if (total_buy_volume > 0 and event.volume_at_signal == total_buy_volume
                and event.price_at_signal == new_price):
            metadata[RECOMPUTE_FLAG] = True
            if not dry_run:
                event.metadata = metadata
                event.save(update_fields=['metadata'])
            return 'already_ok'

        self.stdout.write(
            f"  {event.symbol} {event.session_date} "
            f"price {event.price_at_signal}->{new_price} "
            f"volume {event.volume_at_signal}->{total_buy_volume} [{source}]"
        )
        if dry_run:
            return f'fixed_{source}'
        metadata[RECOMPUTE_FLAG] = True
        metadata['recomputed_from'] = source
        with transaction.atomic():
            event.price_at_signal = new_price
            event.volume_at_signal = total_buy_volume
            event.metadata = metadata
            event.save(update_fields=['price_at_signal', 'volume_at_signal', 'metadata'])
        return f'fixed_{source}'

    def _recompute_from_ticks(self, event, windows):
        """Tính lại buy value/volume từ IntradayTick còn trong DB. None nếu hết data."""
        from market_data.models import IntradayTick

        ticks = IntradayTick.objects.filter(
            symbol=event.symbol, timestamp__date=event.session_date, side='BUY',
        ).values('timestamp', 'price', 'volume')
        rows = list(ticks)
        if not rows:
            return None
        try:
            import pandas as pd
        except ImportError:
            return None
        df = pd.DataFrame.from_records(rows)
        df['price'] = pd.to_numeric(df['price'], errors='coerce').fillna(0.0)
        df['volume'] = pd.to_numeric(df['volume'], errors='coerce').fillna(0).astype('int64')
        det = {str(w.get('window_ts')) for w in windows if w.get('window_ts')}
        if det:
            ts = pd.to_datetime(df['timestamp'], utc=True)
            # Chuẩn hoá ISO (detect lưu 'T', pandas str ra ' ') trước khi so.
            floored = ts.dt.floor('5min').astype(str)
            det_norm = {d.replace('T', ' ') for d in det}
            df = df[floored.isin(det_norm)]
            if df.empty:
                return None
        buy_volume = int(df['volume'].sum())
        if buy_volume <= 0:
            return None
        buy_value = float((df['price'] * df['volume']).sum())
        return buy_value, buy_volume, buy_value / buy_volume
