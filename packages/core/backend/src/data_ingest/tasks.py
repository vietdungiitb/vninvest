"""
data_ingest Celery tasks.

fetch_and_upsert_price_board: fetches price board data and upserts into market_serving.SymbolSnapshot.
backfill_daily_prices: parallel multi-provider OHLCV backfill into DailyPrice.
send_email_verification_token: async email send for email verification (registration).
send_password_reset_email: async email send for password reset.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from typing import Optional

from celery import shared_task
from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils.timezone import now

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider registry for daily history backfill.
# Add entries here when a new explorer module gains a working .history() call.
# ---------------------------------------------------------------------------
_HISTORY_PROVIDERS = [
    'vci',
    'kbs',
]


def _fetch_and_upsert_bucket(
    symbols: list[str],
    provider: str,
    days: int,
    inter_symbol_delay: float = 0.12,
) -> dict:
    """
    Fetch daily history for a bucket of symbols using a single provider and
    bulk-upsert into DailyPrice.  Designed to run in a thread.
    """
    import importlib
    from market_data.models import DailyPrice

    upserted = 0
    failed: list[str] = []

    try:
        mod = importlib.import_module(f'vnbroker.explorer.{provider}.quote')
        QuoteCls = getattr(mod, 'Quote')
    except Exception as exc:
        logger.error('backfill bucket: cannot load provider %s: %s', provider, exc)
        return {'upserted': 0, 'failed': symbols, 'provider': provider}

    from datetime import timedelta, date as dt_date
    from django.utils import timezone
    import pandas as pd

    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=days)

    for symbol in symbols:
        try:
            q = QuoteCls(symbol=symbol)
            df = q.history(
                start=start_date.isoformat(),
                end=end_date.isoformat(),
                interval='1D',
                show_log=False,
            )
            if df is None or df.empty:
                logger.debug('backfill bucket [%s] %s: empty', provider, symbol)
                time.sleep(inter_symbol_delay)
                continue

            objs = []
            for _, row in df.iterrows():
                try:
                    trade_date = (
                        pd.to_datetime(row['time']).date()
                        if not isinstance(row['time'], dt_date)
                        else row['time']
                    )
                    objs.append(DailyPrice(
                        symbol=symbol,
                        date=trade_date,
                        open=float(row['open']),
                        high=float(row['high']),
                        low=float(row['low']),
                        close=float(row['close']),
                        volume=int(row['volume']),
                        source=f'vnbroker_{provider}',
                    ))
                except Exception as exc:
                    # Skip malformed rows but log for debugging
                    logger.debug(f'DailyPrice parse error for {symbol} row: {exc}')
                    continue

            if objs:
                DailyPrice.objects.bulk_create(
                    objs,
                    update_conflicts=True,
                    update_fields=['open', 'high', 'low', 'close', 'volume', 'source'],
                    unique_fields=['symbol', 'date'],
                )
                upserted += len(objs)
                logger.info('backfill [%s] %s: %d rows', provider, symbol, len(objs))

            time.sleep(inter_symbol_delay)

        except Exception as exc:
            logger.warning('backfill [%s] %s failed: %s', provider, symbol, exc)
            failed.append(symbol)

    return {'upserted': upserted, 'failed': failed, 'provider': provider}


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def fetch_and_upsert_price_board(self, job_id: int = None):
    """
    SM-P2.3: Fetch current price board and upsert into SymbolSnapshot.

    Phase 0-2 uses legacy_readonly DB as data source (same as materialize_symbol_snapshot).
    Phase 3+ will switch to direct vnbroker adapter call.

    This task creates an IngestRun record for observability.
    """
    from data_ingest.models import IngestJob, IngestRun
    from market_serving.models import SymbolSnapshot

    job = None
    run = None

    try:
        if job_id:
            try:
                job = IngestJob.objects.get(pk=job_id)
            except IngestJob.DoesNotExist:
                pass

        run = IngestRun.objects.create(
            job=job,
            state=IngestRun.StateChoices.RUNNING,
        ) if job else None

        from market_data.vnbroker_adapter import warm_up_symbols
        from market_data.models import StockProfile

        # SM-P2.3 Native: Fetch price board from vnbroker adapter.
        # Use the full active universe for dashboard breadth and heatmap parity.
        symbols = list(
            StockProfile.objects
            .filter(status=StockProfile.StatusChoices.ACTIVE)
            .values_list('symbol', flat=True)
        )

        if not symbols:
            if run:
                run.state = IngestRun.StateChoices.SKIPPED
                run.error_message = 'No active symbols found in StockProfile'
                run.finished_at = now()
                run.save(update_fields=['state', 'error_message', 'finished_at'])
            return {'status': 'skipped', 'reason': 'no_symbols'}

        result = warm_up_symbols(symbols)
        count = result.get('warmed_up_count', 0)

        if run:
            run.state = IngestRun.StateChoices.SUCCESS
            run.rows_upserted = count
            run.finished_at = now()
            run.save(update_fields=['state', 'rows_upserted', 'finished_at'])

        logger.info("fetch_and_upsert_price_board (native): upserted %d rows using %s.", count, result.get('source'))
        return {'status': 'ok', 'upserted': count, 'source': result.get('source')}


    except Exception as exc:
        logger.error("fetch_and_upsert_price_board failed: %s", exc)
        if run:
            run.state = IngestRun.StateChoices.FAILED
            run.error_message = str(exc)[:500]
            run.finished_at = now()
            run.save(update_fields=['state', 'error_message', 'finished_at'])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def warm_intraday_universe(self):
    """
    Warm native intraday cache for the active symbol universe.
    """
    from market_data.models import StockProfile
    from market_data.vnbroker_adapter import warm_up_intraday_symbols

    symbols = list(
        StockProfile.objects
        .filter(status=StockProfile.StatusChoices.ACTIVE)
        .values_list('symbol', flat=True)
    )

    if not symbols:
        return {'status': 'skipped', 'reason': 'no_symbols'}

    result = warm_up_intraday_symbols(symbols)
    logger.info(
        "warm_intraday_universe (native): warmed %d / %d symbols.",
        result.get('warmed_up_count', 0),
        result.get('symbols_count', 0),
    )
    return result


@shared_task(bind=True, max_retries=2)
def sync_market_groups(self):
    """
    Native: Đồng bộ danh sách symbol niêm yết từ vnbroker.
    Cập nhật hoặc tạo mới StockProfile.
    """
    from market_data.vnbroker_adapter import fetch_listing_symbols
    from market_data.models import StockProfile
    
    symbols_data = fetch_listing_symbols()
    upserted = 0
    
    for item in symbols_data:
        StockProfile.objects.update_or_create(
            symbol=item['symbol'],
            defaults={
                'exchange': item.get('exchange', 'HOSE'),
                'company_name': item.get('company_name', ''),
                'industry': item.get('industry', ''),
                'status': StockProfile.StatusChoices.ACTIVE,
            }
        )
        upserted += 1
        
    return {'status': 'ok', 'upserted': upserted}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_daily_prices(self, days: int = 1, symbols: list = None) -> dict:
    """
    Daily price ingestion task (P3-T01 core-worker topology).
    
    Fetches and upserts daily OHLCV data for specified symbols (default: last N days for all active).
    Wrapper around backfill_daily_prices with monitoring/observability.
    
    Called by: 
      - django-celery-beat schedule (daily at 17:00 VN time after market close)
      - Manual admin trigger endpoint (P3-T02)
    
    Args:
        days: number of days to backfill (default 1 for same-day or previous day catch-up)
        symbols: specific symbol list; None = all active StockProfile
    
    Returns:
        dict with 'status', 'upserted', 'failed', 'providers' keys
    """
    from data_ingest.models import IngestJob, IngestRun
    from django.utils.timezone import now
    
    job = None
    run = None
    
    try:
        # Create observability record for this ingest run
        run = IngestRun.objects.create(
            job=job,
            state=IngestRun.StateChoices.RUNNING,
        )
        
        logger.info(f'ingest_daily_prices starting: days={days}, symbols={len(symbols) if symbols else "all"}')
        
        # Call the main backfill task (handles provider round-robin and threading)
        result = backfill_daily_prices.apply_async(
            args=[days, symbols],
            countdown=0,
        ).get(timeout=3600)  # 1 hour timeout for backfill
        
        upserted = result.get('upserted', 0)
        failed = result.get('failed', [])
        
        if run:
            run.state = IngestRun.StateChoices.SUCCESS
            run.rows_upserted = upserted
            run.finished_at = now()
            run.save(update_fields=['state', 'rows_upserted', 'finished_at'])
        
        logger.info(
            f'ingest_daily_prices completed: upserted={upserted}, failed={len(failed)}, '
            f'providers={result.get("providers")}'
        )
        return result
    
    except Exception as exc:
        logger.error(f'ingest_daily_prices failed: {exc}', exc_info=True)
        if run:
            run.state = IngestRun.StateChoices.FAILED
            run.error_message = str(exc)[:500]
            run.finished_at = now()
            run.save(update_fields=['state', 'error_message', 'finished_at'])
        
        # Retry with exponential backoff (60s, 120s, 240s)
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def backfill_daily_prices(self, days: int = 365, symbols: list = None, max_workers: int = None):
    """
    Backfill DailyPrice cho tất cả active symbols (hoặc danh sách truyền vào).

    Strategy: chia đều symbols thành N buckets, mỗi bucket dùng một provider khác nhau
    (round-robin từ _HISTORY_PROVIDERS), rồi chạy N threads song song.
    Mỗi thread có inter-symbol delay nhỏ để tránh rate-limit từng provider riêng.

    Args:
        days: số ngày lịch sử cần backfill (mặc định 365).
        symbols: danh sách symbol cụ thể; None = tất cả active StockProfile.
        max_workers: số thread song song; None = số provider khả dụng.
    """
    from market_data.models import StockProfile

    if symbols is None:
        symbols = list(
            StockProfile.objects
            .filter(status=StockProfile.StatusChoices.ACTIVE)
            .values_list('symbol', flat=True)
        )

    if not symbols:
        return {'status': 'skipped', 'reason': 'no_symbols'}

    providers = _HISTORY_PROVIDERS
    n = len(providers)
    workers = max_workers or n

    # Round-robin partition: symbol[i] → providers[i % n]
    buckets: dict[str, list[str]] = {p: [] for p in providers}
    for i, sym in enumerate(symbols):
        buckets[providers[i % n]].append(sym)

    logger.info(
        'backfill_daily_prices: %d symbols / %d providers / %d threads / %d days',
        len(symbols), n, workers, days,
    )
    for p, bucket in buckets.items():
        logger.info('  bucket [%s]: %d symbols', p, len(bucket))

    total_upserted = 0
    all_failed: list[str] = []

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_fetch_and_upsert_bucket, bucket, provider, days): provider
            for provider, bucket in buckets.items()
            if bucket
        }
        for future in as_completed(futures):
            provider = futures[future]
            try:
                result = future.result()
                total_upserted += result['upserted']
                all_failed.extend(result['failed'])
                logger.info(
                    'backfill [%s] done: upserted=%d failed=%d',
                    provider, result['upserted'], len(result['failed']),
                )
            except Exception as exc:
                logger.error('backfill thread [%s] raised: %s', provider, exc)

    return {
        'status': 'ok',
        'upserted': total_upserted,
        'failed': all_failed,
        'providers': providers,
    }


# ---------------------------------------------------------------------------
# Email tasks (C3 Email Onboarding Implementation)
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_verification_token(self, email: str, token: str, frontend_url: str = None) -> dict:
    """
    Async email send for email verification (registration flow).
    
    Called by: identity_access.views_auth.register_view
    
    Args:
        email: recipient email address
        token: verification token (raw, not hashed)
        frontend_url: optional frontend base URL (defaults to settings.FRONTEND_URL which is required in production)
    
    Returns:
        dict with 'status' and 'error' keys
    """
    if not frontend_url:
        # C4 Fix: FRONTEND_URL is always available in settings (required in production)
        frontend_url = django_settings.FRONTEND_URL
    
    verify_url = f'{frontend_url}/verify-email?token={token}'
    
    try:
        send_mail(
            subject='Xác minh địa chỉ email VNInvest',
            message=f'Nhấp vào liên kết sau để kích hoạt tài khoản của bạn:\n{verify_url}',
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info(f'Email verification sent to {email}')
        return {'status': 'sent', 'email': email}
    
    except Exception as exc:
        logger.warning(f'Email verification send failed for {email}: {exc}. Retrying...')
        # Retry with exponential backoff
        try:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        except Exception as retry_exc:
            logger.error(f'Email verification retry exhausted for {email}: {retry_exc}')
            return {'status': 'failed', 'email': email, 'error': str(retry_exc)}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, email: str, token: str, frontend_url: str = None) -> dict:
    """
    Async email send for password reset flow.
    
    Called by: identity_access.views_auth.password_reset_request_view
    
    Args:
        email: recipient email address
        token: reset token (raw, not hashed)
        frontend_url: optional frontend base URL (defaults to settings.FRONTEND_URL which is required in production)
    
    Returns:
        dict with 'status' and 'error' keys
    """
    if not frontend_url:
        # C4 Fix: FRONTEND_URL is always available in settings (required in production)
        frontend_url = django_settings.FRONTEND_URL
    
    reset_url = f'{frontend_url}/reset-password?token={token}'
    
    try:
        send_mail(
            subject='Đặt lại mật khẩu VNInvest',
            message=f'Nhấp vào liên kết sau để đặt lại mật khẩu:\n{reset_url}\n\nLinh kết hết hạn sau 1 giờ.',
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info(f'Password reset email sent to {email}')
        return {'status': 'sent', 'email': email}
    
    except Exception as exc:
        logger.warning(f'Password reset email send failed for {email}: {exc}. Retrying...')
        # Retry with exponential backoff
        try:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        except Exception as retry_exc:
            logger.error(f'Password reset email retry exhausted for {email}: {retry_exc}')
            return {'status': 'failed', 'email': email, 'error': str(retry_exc)}
