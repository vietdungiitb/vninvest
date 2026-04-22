import os
import django
import sys
import argparse
from datetime import datetime, timedelta, date
import json
import logging

# Setup django
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from portfolio.models import OrderFlowSignal, IntradayTick
from portfolio.order_flow_history import compute_dark_flow_for_trade_date

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def main():
    parser = argparse.ArgumentParser(description="Recompute Dark Money signals from IntradayTick history.")
    parser.add_argument("--symbol", required=True, help="Stock symbol (e.g. DXG)")
    parser.add_argument("--start-date", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Audit only, no DB writes")
    parser.add_argument("--force", action="store_true", help="Allow persist even if duplicate ratio is high")
    parser.add_argument("--limit-days", type=int, help="Limit number of days to process")
    parser.add_argument("--duplicate-threshold-pct", type=float, default=15.0, help="Max duplicate ratio (default 15%%)")
    parser.add_argument("--min-ticks", type=int, default=20, help="Min ticks to process a day")
    parser.add_argument("--replace-existing", action="store_true", help="Overwrite existing signals for the same day")
    parser.add_argument("--verbose", action="store_true", help="Print detailed logs")

    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    symbol = args.symbol.upper()
    try:
        start_date = datetime.strptime(args.start_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(args.end_date, "%Y-%m-%d").date()
    except ValueError as e:
        print(f"Error parsing dates: {e}")
        sys.exit(1)

    if start_date > end_date:
        print("Error: start-date must be before or equal to end-date")
        sys.exit(1)

    print(f"=== Recomputing Dark Flow for {symbol} ===")
    print(f"Period: {start_date} to {end_date}")
    print(f"Settings: dry_run={args.dry_run}, replace={args.replace_existing}, dup_threshold={args.duplicate_threshold_pct}%")
    print("-" * 50)

    # Find trading days in range
    available_days = list(
        IntradayTick.objects.filter(
            symbol=symbol,
            trade_date__range=(start_date, end_date)
        ).values_list('trade_date', flat=True).distinct().order_by('trade_date')
    )
    
    if not available_days:
        print("No ticks found in the specified range.")
        sys.exit(0)

    if args.limit_days:
        available_days = available_days[:args.limit_days]

    stats = {
        "scanned": 0,
        "ready": 0,
        "persisted": 0,
        "skipped_low_data": 0,
        "skipped_duplicate": 0,
        "skipped_existing": 0,
        "failed": 0,
        "created": 0,
        "updated": 0,
    }

    results = []

    for trade_date in available_days:
        stats["scanned"] += 1
        try:
            res = compute_dark_flow_for_trade_date(
                symbol, 
                trade_date, 
                duplicate_threshold_pct=args.duplicate_threshold_pct,
                min_ticks=args.min_ticks
            )
            
            audit = res["audit"]
            decision = "ready" if res["eligible_for_persist"] else "skip"
            
            if not res["eligible_for_persist"]:
                if "low_data_density" in res["skip_reason"]:
                    stats["skipped_low_data"] += 1
                    decision = "skip_low_data"
                elif "duplicate_ratio_above_threshold" in res["skip_reason"]:
                    if args.force:
                        decision = "force_ready"
                    else:
                        stats["skipped_duplicate"] += 1
                        decision = "skip_duplicate_risk"
            
            print(f"[{trade_date}] Ticks: {audit['raw_tick_count']} | Dup: {audit['duplicate_ratio_pct']}% | Decision: {decision}")
            
            if decision in ["ready", "force_ready"]:
                stats["ready"] += 1
                if not args.dry_run:
                    # Persist
                    with transaction.atomic():
                        existing = OrderFlowSignal.objects.filter(symbol=symbol, trade_date=trade_date).first()
                        
                        if existing and not args.replace_existing:
                            stats["skipped_existing"] += 1
                            print(f"  -> Skipped: existing signal found (ID: {existing.id})")
                        else:
                            signal_data = res["signal_preview"]
                            # Build event_id: dark_flow:backfill:SYM:YYYY-MM-DD
                            event_id = f"dark_flow:backfill:{symbol}:{trade_date}"
                            
                            obj, created = OrderFlowSignal.objects.update_or_create(
                                event_id=event_id,
                                defaults={
                                    'symbol': symbol,
                                    'signal_type': signal_data['signal_type'],
                                    'strength': signal_data['strength'],
                                    'confidence': signal_data['confidence'],
                                    'tick_rate': signal_data['tick_rate'],
                                    'small_order_ratio': signal_data['small_order_ratio'],
                                    'cvd_at_signal': signal_data['cvd_at_signal'],
                                    'price_at_signal': signal_data['price_at_signal'],
                                    'window_seconds': 300,
                                    'components_json': signal_data['components_json'],
                                    'severity': 'urgent' if signal_data['strength'] >= 70 else 'warning' if signal_data['strength'] >= 40 else 'info',
                                    'trade_date': trade_date, # Use the new trade_date field
                                }
                            )
                            if created:
                                stats["created"] += 1
                                print(f"  -> Created signal: {signal_data['signal_type']} (Strength: {signal_data['strength']})")
                            else:
                                stats["updated"] += 1
                                print(f"  -> Updated signal: {signal_data['signal_type']} (Strength: {signal_data['strength']})")
                            
                            stats["persisted"] += 1
            
            results.append({
                "trade_date": str(trade_date),
                "audit": audit,
                "decision": decision,
                "signal": res["signal_preview"]
            })

        except Exception as e:
            stats["failed"] += 1
            print(f"[{trade_date}] Error: {e}")
            if args.verbose:
                logger.exception(e)

    print("-" * 50)
    print("=== SUMMARY ===")
    print(f"Days Scanned:    {stats['scanned']}")
    print(f"Days Ready:      {stats['ready']}")
    print(f"Days Persisted:  {stats['persisted']} (Created: {stats['created']}, Updated: {stats['updated']})")
    print(f"Skipped Low Data: {stats['skipped_low_data']}")
    print(f"Skipped Dup Risk: {stats['skipped_duplicate']}")
    print(f"Skipped Existing: {stats['skipped_existing']}")
    print(f"Failed:          {stats['failed']}")
    print("=" * 50)

if __name__ == "__main__":
    main()
