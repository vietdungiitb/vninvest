import json
import threading
from urllib.parse import urlencode
from datetime import datetime

from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.models import User
from django import forms
from django.db.models import Max
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
import pandas as pd

from .models import (
    AccountSnapshot,
    DailyPrice,
    IntradayTick,
    MarketGroupSyncLog,
    Portfolio,
    PriceAlertRule,
    ScreenerRule,
    SecuritiesGroup,
    SecuritiesItem,
    StockProfile,
    StockProfileSyncLog,
    SubAccount,
    SystemEmailAccount,
    TrackedSymbol,
    Transaction,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
)
from .mail_service import get_active_email_account, send_test_email
from .email_verification import send_verification_email
from .services import sync_market_groups_for_user, sync_market_groups_for_users, sync_stock_profiles


admin.site.site_header = 'VNInvest - Trang quản trị hệ thống'
admin.site.site_title = 'VNInvest Admin'
admin.site.index_title = 'Sơ đồ chức năng hệ thống'


_original_each_context = admin.site.each_context
_original_get_app_list = admin.site.get_app_list
_original_admin_get_urls = admin.site.get_urls


def _push_market_group_sync_messages(request, result):
    if result.get('success'):
        messages.success(request, result.get('message', 'Đồng bộ nhóm thị trường thành công.'))
        if result.get('warning'):
            messages.warning(request, result['warning'])
    else:
        messages.error(request, result.get('error') or result.get('message') or 'Đồng bộ nhóm thị trường thất bại.')


def _push_stock_profile_sync_messages(request, result):
    if result.get('success'):
        messages.success(request, result.get('message', 'Đồng bộ hồ sơ mã chứng khoán thành công.'))
        if result.get('warning'):
            messages.warning(request, result['warning'])
    else:
        messages.error(request, result.get('error') or result.get('message') or 'Đồng bộ hồ sơ mã chứng khoán thất bại.')


def _admin_market_group_sync_view(request):
    if request.method != 'POST':
        return redirect('admin:index')

    mode = request.POST.get('mode', 'all')
    clear_existing = request.POST.get('clear_existing') in {'1', 'true', 'on'}
    username = (request.POST.get('username') or '').strip()
    next_url = request.POST.get('next') or reverse('admin:index')

    if username:
        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            messages.error(request, f'Không tìm thấy user "{username}" để đồng bộ nhóm thị trường.')
            return HttpResponseRedirect(next_url)

        result = sync_market_groups_for_user(
            target_user,
            requested_by=request.user,
            mode=mode,
            clear_existing=clear_existing,
        )
        _push_market_group_sync_messages(request, result)
        return HttpResponseRedirect(next_url)

    result = sync_market_groups_for_users(
        User.objects.filter(is_active=True).order_by('username'),
        requested_by=request.user,
        mode=mode,
        clear_existing=clear_existing,
    )
    _push_market_group_sync_messages(request, result)
    return HttpResponseRedirect(next_url)


def _admin_stock_profile_sync_view(request):
    if request.method != 'POST':
        return redirect('admin:index')

    mode = request.POST.get('mode', 'all')
    next_url = request.POST.get('next') or reverse('admin:index')
    result = sync_stock_profiles(requested_by=request.user, mode=mode)
    _push_stock_profile_sync_messages(request, result)
    return HttpResponseRedirect(next_url)


def _admin_resend_latest_verification_view(request):
    if request.method != 'POST':
        return redirect('admin:index')

    next_url = request.POST.get('next') or reverse('admin:index')
    pending_config = (
        UserConfig.objects
        .select_related('user')
        .filter(email_verified=False)
        .order_by('-email_verification_sent_at', '-created_at')
        .first()
    )

    if not pending_config:
        messages.warning(request, 'Khong con tai khoan nao dang cho xac thuc email.')
        return HttpResponseRedirect(next_url)

    try:
        _resend_verification_for_user_config(pending_config)
    except Exception as exc:
        messages.error(
            request,
            f'Gui lai email xac thuc that bai cho {pending_config.user.username}: {exc}',
        )
        return HttpResponseRedirect(next_url)

    messages.success(
        request,
        f'Da gui lai email xac thuc cho {pending_config.user.username}.',
    )
    return HttpResponseRedirect(next_url)


def _resend_verification_for_user_config(user_config: UserConfig):
    send_verification_email(user_config.user)
    user_config.email_verification_sent_at = timezone.now()
    user_config.save(update_fields=['email_verification_sent_at', 'updated_at'])


def _format_vnd(value):
    if value is None:
        return '—'
    return f'{float(value):,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


def _format_number(value):
    if value is None:
        return '—'
    return f'{int(value):,}'.replace(',', '.')


def _format_pct(value):
    if value is None:
        return '—'
    number = float(value)
    prefix = '+' if number > 0 else ''
    return f'{prefix}{number:.2f}%'


def _technical_bias_label(bias: str | None) -> str:
    normalized = (bias or '').strip().upper()
    if normalized == 'BULLISH':
        return 'Tăng'
    if normalized == 'WEAK':
        return 'Yếu'
    if normalized == 'NEUTRAL':
        return 'Trung tính'
    return '—'


def _build_sparkline_points(values, width=640, height=180):
    if not values:
        return ''
    minimum = min(values)
    maximum = max(values)
    spread = maximum - minimum
    if spread == 0:
        spread = 1
    step_x = width / max(len(values) - 1, 1)
    points = []
    for index, value in enumerate(values):
        x = round(index * step_x, 2)
        y = round(height - ((value - minimum) / spread) * height, 2)
        points.append(f'{x},{y}')
    return ' '.join(points)


def _workspace_url_for_symbol(symbol: str) -> str:
    return reverse('admin:stock-profile-workspace', args=[(symbol or '').strip().upper()])


def _build_candlestick_items(price_rows, width=640, height=240):
    rows = [row for row in price_rows if row.get('close_price') is not None]
    if not rows:
        return []

    lows = [float(row['low_price']) for row in rows if row.get('low_price') is not None]
    highs = [float(row['high_price']) for row in rows if row.get('high_price') is not None]
    if not lows or not highs:
        return []

    min_price = min(lows)
    max_price = max(highs)
    spread = max(max_price - min_price, 1)
    step = width / max(len(rows), 1)
    candle_width = max(min(step * 0.56, 14), 4)
    items = []

    def to_y(value):
        return round(height - ((float(value) - min_price) / spread) * height, 2)

    for index, row in enumerate(rows):
        open_price = row.get('open_price')
        high_price = row.get('high_price')
        low_price = row.get('low_price')
        close_price = row.get('close_price')
        if None in {open_price, high_price, low_price, close_price}:
            continue

        x_center = round((index * step) + (step / 2), 2)
        body_top = min(to_y(open_price), to_y(close_price))
        body_bottom = max(to_y(open_price), to_y(close_price))
        body_height = max(round(body_bottom - body_top, 2), 1.6)
        items.append(
            {
                'date': row['date'],
                'x_center': x_center,
                'body_x': round(x_center - candle_width / 2, 2),
                'body_width': round(candle_width, 2),
                'wick_top': to_y(high_price),
                'wick_bottom': to_y(low_price),
                'body_top': round(body_top, 2),
                'body_height': body_height,
                'tone': 'up' if float(close_price) >= float(open_price) else 'down',
            }
        )
    return items


def _build_mock_depth_levels(overview: dict) -> dict:
    current_price = overview.get('current_price') or overview.get('close_price') or overview.get('reference_price')
    ceiling_price = overview.get('ceiling_price')
    floor_price = overview.get('floor_price')
    total_volume = int(overview.get('volume') or 0)

    if current_price is None:
        return {'bids': [], 'asks': [], 'buy_total': 0, 'sell_total': 0}

    current = float(current_price)
    step = max(round(current * 0.002, 2), 0.05)
    bid_prices = [round(current - step * index, 2) for index in range(1, 4)]
    ask_prices = [round(current + step * index, 2) for index in range(1, 4)]

    if floor_price is not None:
        bid_prices = [max(price, round(float(floor_price), 2)) for price in bid_prices]
    if ceiling_price is not None:
        ask_prices = [min(price, round(float(ceiling_price), 2)) for price in ask_prices]

    base = max(total_volume // 18, 1000)
    buy_volumes = [base * 3, base * 2, base]
    sell_volumes = [base, base * 2, base * 3]

    bids = [
        {'price': _format_vnd(price), 'volume': _format_number(volume), 'raw_volume': volume}
        for price, volume in zip(bid_prices, buy_volumes)
    ]
    asks = [
        {'price': _format_vnd(price), 'volume': _format_number(volume), 'raw_volume': volume}
        for price, volume in zip(ask_prices, sell_volumes)
    ]

    rows = [
        {
            'bid_volume': bid['volume'],
            'bid_price': bid['price'],
            'ask_price': ask['price'],
            'ask_volume': ask['volume'],
        }
        for bid, ask in zip(bids, asks)
    ]

    return {
        'bids': bids,
        'asks': asks,
        'rows': rows,
        'buy_total': _format_number(sum(buy_volumes)),
        'sell_total': _format_number(sum(sell_volumes)),
    }


def _fetch_live_workspace_data(symbol):
    """Lấy ticker live + depth thật từ vnstock (chạy trong thread riêng, timeout 8s)."""
    result = {'ticker': None, 'depth': None}
    try:
        from vnstock import Vnstock
        stock = Vnstock().stock(symbol=symbol, source='VCI')
        df = stock.trading.price_board(symbols_list=[symbol])
        if df is not None and not df.empty:
            def _f(val):
                try:
                    v = float(val)
                    return v if v == v and v != 0 else None
                except (TypeError, ValueError):
                    return None

            def _i(val):
                try:
                    v = float(val)
                    return int(v) if v == v else None
                except (TypeError, ValueError):
                    return None

            ls = df['listing'].iloc[0]
            mt = df['match'].iloc[0]
            match_price = _f(mt.get('match_price'))
            ref_price = _f(ls.get('ref_price')) or _f(mt.get('reference_price'))
            change_value = round(match_price - ref_price, 2) if match_price and ref_price else None
            change_pct = round((match_price - ref_price) / ref_price * 100, 2) if match_price and ref_price else None
            result['ticker'] = {
                'current_price': match_price,
                'prev_price': ref_price,
                'change_value': change_value,
                'change_pct': change_pct,
                'open_price': _f(mt.get('open_price')),
                'high_price': _f(mt.get('highest')),
                'low_price': _f(mt.get('lowest')),
                'volume': _i(mt.get('accumulated_volume')),
                'ceiling_price': _f(ls.get('ceiling_price')),
                'floor_price': _f(ls.get('floor_price')),
                'last_date': timezone.now().strftime('%d/%m/%Y %H:%M'),
                'source': 'live',
            }
            # depth thật
            if 'bid_ask' in df.columns:
                ba = df['bid_ask'].iloc[0]
                depth_rows = []
                for i in range(1, 4):
                    bp = _f(ba.get(f'bid_{i}_price'))
                    bv = _i(ba.get(f'bid_{i}_volume'))
                    ap = _f(ba.get(f'ask_{i}_price'))
                    av = _i(ba.get(f'ask_{i}_volume'))
                    if bp is not None or ap is not None:
                        depth_rows.append({
                            'bid_volume': _format_number(bv),
                            'bid_price': _format_vnd(bp),
                            'ask_price': _format_vnd(ap),
                            'ask_volume': _format_number(av),
                            'raw_bid_vol': bv or 0,
                            'raw_ask_vol': av or 0,
                        })
                if depth_rows:
                    total_bid = sum(r['raw_bid_vol'] for r in depth_rows)
                    total_ask = sum(r['raw_ask_vol'] for r in depth_rows)
                    result['depth'] = {
                        'rows': depth_rows,
                        'buy_total': _format_number(total_bid),
                        'sell_total': _format_number(total_ask),
                        'source': 'live',
                    }
    except Exception:
        pass
    return result


def _admin_stock_profile_workspace_view(request, symbol):
    from .views import _build_stock_workspace_overview, _compute_stock_workspace_technical

    normalized_symbol = (symbol or '').strip().upper()
    profile = get_object_or_404(StockProfile, symbol=normalized_symbol)
    overview = _build_stock_workspace_overview(normalized_symbol, request.user)
    price_rows = list(
        DailyPrice.objects
        .filter(symbol=normalized_symbol)
        .order_by('-date')
        .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')[:180]
    )
    price_rows_for_chart = list(reversed(price_rows))
    technical = _compute_stock_workspace_technical(price_rows_for_chart, overview)
    closes = [float(row['close_price']) for row in price_rows_for_chart if row.get('close_price') is not None]

    # --- Live vnstock data trong thread riêng (timeout 8s) ---
    live_result = {'ticker': None, 'depth': None}
    live_thread = threading.Thread(
        target=lambda: live_result.update(_fetch_live_workspace_data(normalized_symbol)),
        daemon=True,
    )
    live_thread.start()
    live_thread.join(timeout=8)
    live_ticker = live_result.get('ticker')
    live_depth = live_result.get('depth')

    # --- Merge live ticker vào overview nếu lấy được ---
    if live_ticker:
        for field in ('current_price', 'change_value', 'change_pct', 'open_price',
                      'high_price', 'low_price', 'volume', 'ceiling_price', 'floor_price'):
            if live_ticker.get(field) is not None:
                overview[field] = live_ticker[field]

    tracked_users = list(
        TrackedSymbol.objects
        .filter(symbol=normalized_symbol)
        .select_related('user', 'source_group')
        .order_by('user__username')[:12]
    )
    watchlist_memberships = list(
        WatchlistItem.objects
        .filter(symbol=normalized_symbol)
        .select_related('group', 'group__user')
        .order_by('group__user__username', 'group__name')[:16]
    )
    recent_prices = [
        {
            'date': row['date'],
            'open_price': _format_vnd(row.get('open_price')),
            'high_price': _format_vnd(row.get('high_price')),
            'low_price': _format_vnd(row.get('low_price')),
            'close_price': _format_vnd(row.get('close_price')),
            'volume': _format_number(row.get('volume')),
        }
        for row in price_rows[:12]
    ]

    # --- Serialize OHLCV cho klinecharts ---
    def _row_ts(d):
        if isinstance(d, str):
            from datetime import date as _date
            d = _date.fromisoformat(d)
        return int(datetime(d.year, d.month, d.day, 8, 0, 0).timestamp() * 1000)

    chart_ohlcv_json = json.dumps([
        {
            'timestamp': _row_ts(row['date']),
            'open': float(row['open_price']) if row.get('open_price') is not None else float(row['close_price']),
            'high': float(row['high_price']) if row.get('high_price') is not None else float(row['close_price']),
            'low': float(row['low_price']) if row.get('low_price') is not None else float(row['close_price']),
            'close': float(row['close_price']),
            'volume': int(row['volume']) if row.get('volume') is not None else 0,
        }
        for row in price_rows_for_chart
        if row.get('close_price') is not None
    ])

    overview_display = {
        'current_price': _format_vnd(overview.get('current_price') or overview.get('close_price')),
        'change_value': _format_vnd(overview.get('change_value')),
        'change_pct': _format_pct(overview.get('change_pct')),
        'reference_price': _format_vnd(overview.get('reference_price')),
        'ceiling_price': _format_vnd(overview.get('ceiling_price')),
        'floor_price': _format_vnd(overview.get('floor_price')),
        'volume': _format_number(overview.get('volume')),
        'last_date': live_ticker['last_date'] if live_ticker else (overview.get('last_date') or '—'),
        'change_class': 'tone-neutral',
        'data_source': 'vnstock live' if live_ticker else 'database',
    }
    if overview.get('change_value'):
        try:
            if float(overview['change_value']) > 0:
                overview_display['change_class'] = 'tone-up'
            elif float(overview['change_value']) < 0:
                overview_display['change_class'] = 'tone-down'
        except (TypeError, ValueError):
            pass

    technical_display = {
        'bias': _technical_bias_label(technical.get('bias')),
        'rsi14': technical.get('rsi14') if technical.get('rsi14') is not None else '—',
        'sma20': _format_vnd(technical.get('sma20')),
        'sma50': _format_vnd(technical.get('sma50')),
        'price_vs_sma20_pct': _format_pct(technical.get('price_vs_sma20_pct')),
        'price_vs_sma50_pct': _format_pct(technical.get('price_vs_sma50_pct')),
        'momentum_20d_pct': _format_pct(technical.get('momentum_20d_pct')),
        'range_position_pct': _format_pct(technical.get('range_position_pct')),
    }

    depth_panel = live_depth if live_depth else _build_mock_depth_levels(overview)
    depth_panel['source'] = 'live' if live_depth else 'simulated'

    context = {
        **admin.site.each_context(request),
        'opts': StockProfile._meta,
        'original': profile,
        'title': f'Chi tiết mã {normalized_symbol}',
        'stock_profile': profile,
        'overview': overview,
        'overview_display': overview_display,
        'technical': technical,
        'technical_display': technical_display,
        'recent_prices': recent_prices,
        'market_groups': list(
            SecuritiesGroup.objects.filter(items__symbol=normalized_symbol).order_by('name').distinct()
        ),
        'tracked_users': tracked_users,
        'tracked_user_count': TrackedSymbol.objects.filter(symbol=normalized_symbol).count(),
        'watchlist_memberships': watchlist_memberships,
        'watchlist_membership_count': WatchlistItem.objects.filter(symbol=normalized_symbol).count(),
        'sparkline_points': _build_sparkline_points(closes),
        'sparkline_min': _format_vnd(min(closes)) if closes else '—',
        'sparkline_max': _format_vnd(max(closes)) if closes else '—',
        'chart_ohlcv_json': chart_ohlcv_json,
        'price_row_count': len(price_rows_for_chart),
        'workspace_back_url': reverse('admin:portfolio_stockprofile_changelist'),
        'change_url': reverse('admin:portfolio_stockprofile_change', args=[profile.pk]),
        'tracked_user_count_display': _format_number(TrackedSymbol.objects.filter(symbol=normalized_symbol).count()),
        'watchlist_membership_count_display': _format_number(WatchlistItem.objects.filter(symbol=normalized_symbol).count()),
        'depth_panel': depth_panel,
    }
    return render(request, 'admin/portfolio/stockprofile/workspace.html', context)


def _vninvest_admin_get_urls():
    return [
        path(
            'market-groups/sync/',
            admin.site.admin_view(_admin_market_group_sync_view),
            name='market-group-sync',
        ),
        path(
            'stock-profiles/sync/',
            admin.site.admin_view(_admin_stock_profile_sync_view),
            name='stock-profile-sync',
        ),
        path(
            'stock-profiles/<str:symbol>/workspace/',
            admin.site.admin_view(_admin_stock_profile_workspace_view),
            name='stock-profile-workspace',
        ),
        path(
            'user-configs/resend-latest-verification/',
            admin.site.admin_view(_admin_resend_latest_verification_view),
            name='resend-latest-verification',
        ),
        *_original_admin_get_urls(),
    ]


def _duration_display(started_at, finished_at):
    if not started_at or not finished_at:
        return '—'
    delta = finished_at - started_at
    total_seconds = int(delta.total_seconds())
    minutes, seconds = divmod(max(total_seconds, 0), 60)
    if minutes:
        return f'{minutes}m {seconds}s'
    return f'{seconds}s'


def _vninvest_each_context(request):
    context = _original_each_context(request)
    today = timezone.localdate()
    now = timezone.now()
    allowed_windows = [30, 90, 180]
    try:
        selected_window = int(request.GET.get('window_days', 90))
    except (TypeError, ValueError):
        selected_window = 90
    if selected_window not in allowed_windows:
        selected_window = 90

    from_date = today - timezone.timedelta(days=selected_window)

    context['system_quick_stats'] = {
        'portfolio_count': Portfolio.objects.count(),
        'subaccount_count': SubAccount.objects.count(),
        'transaction_count': Transaction.objects.count(),
        'transaction_today_count': Transaction.objects.filter(date=today).count(),
        'tracked_symbol_count': TrackedSymbol.objects.count(),
        'stock_profile_count': StockProfile.objects.count(),
        'daily_price_count': DailyPrice.objects.count(),
    }

    tx_rows = list(
        Transaction.objects.filter(date__gte=from_date).values(
            'symbol',
            'transaction_type',
            'price',
            'quantity',
            'date',
        )
    )
    price_rows = list(
        DailyPrice.objects.values('symbol').annotate(latest_date=Max('date')).values(
            'symbol',
            'latest_date',
        )
    )

    insights = {
        'top_symbols': [],
        'type_breakdown': [],
        'freshness': {'fresh': 0, 'warning': 0, 'stale': 0},
        'window_days': selected_window,
        'window_options': allowed_windows,
    }

    if tx_rows:
        df_tx = pd.DataFrame(tx_rows)
        df_tx['price'] = pd.to_numeric(df_tx['price'])
        df_tx['quantity'] = pd.to_numeric(df_tx['quantity'])
        df_tx['turnover'] = df_tx['price'] * df_tx['quantity']

        top_symbols = (
            df_tx.groupby('symbol', as_index=False)['turnover']
            .sum()
            .sort_values('turnover', ascending=False)
            .head(5)
        )
        insights['top_symbols'] = [
            {
                'symbol': row['symbol'],
                'turnover': float(row['turnover']),
            }
            for _, row in top_symbols.iterrows()
        ]

        type_breakdown = (
            df_tx.groupby('transaction_type', as_index=False)['turnover']
            .sum()
            .sort_values('turnover', ascending=False)
        )
        insights['type_breakdown'] = [
            {
                'transaction_type': row['transaction_type'],
                'turnover': float(row['turnover']),
            }
            for _, row in type_breakdown.iterrows()
        ]

    if price_rows:
        df_price = pd.DataFrame(price_rows)
        df_price['latest_date'] = pd.to_datetime(df_price['latest_date'])
        df_price['lag_days'] = (pd.Timestamp(today) - df_price['latest_date']).dt.days

        insights['freshness'] = {
            'fresh': int((df_price['lag_days'] <= 3).sum()),
            'warning': int(((df_price['lag_days'] > 3) & (df_price['lag_days'] <= 7)).sum()),
            'stale': int((df_price['lag_days'] > 7).sum()),
        }

    context['pandas_insights'] = insights
    pending_verification_qs = UserConfig.objects.select_related('user').filter(email_verified=False)
    latest_pending_verification = pending_verification_qs.order_by('-email_verification_sent_at', '-created_at').first()
    default_email_account = get_active_email_account()
    context['verification_ops'] = {
        'verified_count': UserConfig.objects.filter(email_verified=True).count(),
        'unverified_count': pending_verification_qs.count(),
        'unsent_count': pending_verification_qs.filter(email_verification_sent_at__isnull=True).count(),
        'sent_last_24h_count': UserConfig.objects.filter(
            email_verification_sent_at__gte=now - timezone.timedelta(hours=24)
        ).count(),
        'latest_pending': latest_pending_verification,
        'default_mail_account': default_email_account,
        'unverified_admin_url': (
            f"{reverse('admin:portfolio_userconfig_changelist')}?"
            f"{urlencode({'email_verified__exact': 0})}"
        ),
        'verified_admin_url': (
            f"{reverse('admin:portfolio_userconfig_changelist')}?"
            f"{urlencode({'email_verified__exact': 1})}"
        ),
        'mail_account_admin_url': reverse('admin:portfolio_systememailaccount_changelist'),
        'resend_latest_url': reverse('admin:resend-latest-verification'),
    }
    latest_market_sync = MarketGroupSyncLog.objects.select_related('target_user', 'requested_by').first()
    recent_market_sync_logs = list(
        MarketGroupSyncLog.objects
        .select_related('target_user', 'requested_by')
        .all()[:5]
    )
    latest_stock_profile_sync = StockProfileSyncLog.objects.select_related('requested_by').first()
    recent_stock_profile_sync_logs = list(
        StockProfileSyncLog.objects
        .select_related('requested_by')
        .all()[:5]
    )
    context['market_group_sync_status'] = {
        'latest': latest_market_sync,
        'recent_logs': recent_market_sync_logs,
        'total_group_count': SecuritiesGroup.objects.count(),
        'total_symbol_count': SecuritiesItem.objects.count(),
    }
    context['stock_profile_sync_status'] = {
        'latest': latest_stock_profile_sync,
        'recent_logs': recent_stock_profile_sync_logs,
        'duration': _duration_display(latest_stock_profile_sync.started_at, latest_stock_profile_sync.finished_at) if latest_stock_profile_sync else '—',
    }
    return context


def _vninvest_get_app_list(request, app_label=None):
    app_list = _original_get_app_list(request, app_label)
    portfolio_app = next((app for app in app_list if app.get('app_label') == 'portfolio'), None)
    menu_name_override = {
        'Portfolio': 'Danh mục đầu tư',
        'SubAccount': 'Tiểu khoản',
        'Transaction': 'Giao dịch',
        'AccountSnapshot': 'Snapshot NAV',
        'MarketGroupSyncLog': 'Log đồng bộ Nhóm thị trường',
        'StockProfileSyncLog': 'Log đồng bộ Hồ sơ mã chứng khoán',
        'SecuritiesGroup': 'Nhóm thị trường',
        'SecuritiesItem': 'Mã trong nhóm thị trường',
        'TrackedSymbol': 'Danh sách mã theo dõi tổng hợp',
        'PriceAlertRule': 'Cảnh báo giá',
        'WatchlistGroup': 'Danh sách theo dõi cá nhân',
        'WatchlistItem': 'Mã trong danh sách theo dõi',
        'ScreenerRule': 'Bộ lọc động',
        'StockProfile': 'Hồ sơ mã chứng khoán',
        'DailyPrice': 'Dữ liệu giá hàng ngày',
        'UserConfig': 'Cấu hình người dùng',
        'SystemEmailAccount': 'Tài khoản gửi mail',
        'User': 'Người dùng',
        'Group': 'Nhóm quyền',
    }

    for app in app_list:
        for model in app.get('models', []):
            object_name = model.get('object_name')
            if object_name in menu_name_override:
                model['name'] = menu_name_override[object_name]
            # Menu chi dung de dieu huong, khong hien thi thao tac them moi.
            model['add_url'] = None

    for app in app_list:
        if app.get('app_label') == 'auth':
            app['name'] = '05. Hệ thống xác thực và phân quyền'

    if not portfolio_app:
        return app_list

    models_by_name = {
        model.get('object_name'): model
        for model in portfolio_app.get('models', [])
    }

    grouped_definitions = [
        (
            'portfolio_tracker',
            '01. Portfolio Tracker',
            [
                'Portfolio',
                'SubAccount',
                'Transaction',
                'AccountSnapshot',
            ],
        ),
        (
            'market_watch',
            '02. Market Watch và theo dõi cá nhân',
            [
                'WatchlistGroup',
                'WatchlistItem',
                'SecuritiesGroup',
                'SecuritiesItem',
                'TrackedSymbol',
                'PriceAlertRule',
                'ScreenerRule',
            ],
        ),
        (
            'data_hub_sync',
            '03. Data Hub và đồng bộ',
            [
                'StockProfile',
                'DailyPrice',
                'MarketGroupSyncLog',
                'StockProfileSyncLog',
            ],
        ),
        (
            'system_configuration',
            '04. Cấu hình hệ thống',
            [
                'UserConfig',
                'SystemEmailAccount',
            ],
        ),
    ]

    grouped_apps = []
    for pseudo_label, title, model_names in grouped_definitions:
        grouped_models = [models_by_name[name] for name in model_names if name in models_by_name]
        if not grouped_models:
            continue

        grouped_apps.append(
            {
                'name': title,
                'app_label': pseudo_label,
                'app_url': '',
                'has_module_perms': True,
                'models': grouped_models,
            }
        )

    non_portfolio_apps = [app for app in app_list if app.get('app_label') != 'portfolio']
    return grouped_apps + non_portfolio_apps


admin.site.each_context = _vninvest_each_context
admin.site.get_app_list = _vninvest_get_app_list
admin.site.get_urls = _vninvest_admin_get_urls


class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    fields = ('symbol', 'transaction_type', 'date', 'price', 'quantity', 'fee', 'notes')
    ordering = ('-date',)
    fk_name = 'sub_account'


class SecuritiesItemInline(admin.TabularInline):
    model = SecuritiesItem
    verbose_name = 'Mã trong nhóm thị trường'
    verbose_name_plural = 'Mã trong nhóm thị trường'
    extra = 0
    fields = ('symbol', 'order', 'workspace_link')
    readonly_fields = ('symbol', 'order', 'workspace_link')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description='Workspace mã')
    def workspace_link(self, obj):
        return format_html('<a href="{}">Mở workspace</a>', _workspace_url_for_symbol(obj.symbol))


class WatchlistItemInline(admin.TabularInline):
    model = WatchlistItem
    verbose_name = 'Mã trong danh sách theo dõi'
    verbose_name_plural = 'Mã trong danh sách theo dõi'
    extra = 1
    fields = ('symbol',)


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'subaccount_count')
    list_filter = ('user',)
    search_fields = ('name', 'user__username')
    ordering = ('-created_at',)

    @admin.display(description='So tieu khoan')
    def subaccount_count(self, obj):
        return obj.sub_accounts.count()


@admin.register(SubAccount)
class SubAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'portfolio', 'type', 'margin_ratio', 'created_at')
    list_filter = ('type', 'portfolio')
    search_fields = ('name', 'portfolio__name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    inlines = [TransactionInline]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'symbol',
        'transaction_type',
        'date',
        'price',
        'quantity',
        'fee',
        'total_value_display',
        'sub_account',
    )
    list_filter = ('transaction_type', 'sub_account', 'symbol')
    search_fields = ('symbol', 'sub_account__name', 'sub_account__portfolio__name')
    ordering = ('-date',)
    date_hierarchy = 'date'

    @admin.display(description='Gia tri lenh (VND)')
    def total_value_display(self, obj):
        return f'{obj.total_value:,.0f}'


@admin.register(AccountSnapshot)
class AccountSnapshotAdmin(admin.ModelAdmin):
    list_display = ('sub_account', 'date', 'net_equity', 'daily_profit', 'created_at')
    list_filter = ('sub_account',)
    search_fields = ('sub_account__name', 'sub_account__portfolio__name')
    ordering = ('-date',)
    date_hierarchy = 'date'


@admin.register(UserConfig)
class UserConfigAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'verification_status',
        'email_verification_sent_at',
        'email_verified_at',
        'whale_alert_threshold',
        'theme',
        'updated_at',
    )
    list_filter = ('theme', 'email_verified')
    search_fields = ('user__username', 'user__email')
    ordering = ('user__username',)
    change_form_template = 'admin/portfolio/userconfig/change_form.html'
    actions = ('resend_verification_email_to_selected_users',)
    readonly_fields = ('email_verified', 'email_verification_sent_at', 'email_verified_at', 'created_at', 'updated_at')
    fieldsets = (
        ('Nguoi dung', {'fields': ('user',)}),
        ('Xac thuc email', {'fields': ('email_verified', 'email_verification_sent_at', 'email_verified_at')}),
        ('Cau hinh ca nhan', {'fields': ('whale_alert_threshold', 'theme')}),
        ('Goi dich vu', {'fields': ('plan', 'plan_expires_at')}),
        ('OAuth', {'fields': ('oauth_provider', 'oauth_uid')}),
        ('He thong', {'fields': ('created_at', 'updated_at')}),
    )

    @admin.display(description='Trang thai email')
    def verification_status(self, obj):
        return 'Da xac thuc' if obj.email_verified else 'Chua xac thuc'

    def get_urls(self):
        return [
            path(
                '<path:object_id>/resend-verification/',
                self.admin_site.admin_view(self.resend_verification_view),
                name='portfolio_userconfig_resend_verification',
            ),
            *super().get_urls(),
        ]

    def change_view(self, request, object_id, form_url='', extra_context=None):
        extra_context = extra_context or {}
        user_config = self.get_object(request, object_id)
        extra_context['show_resend_verification_button'] = bool(user_config and not user_config.email_verified)
        if user_config:
            extra_context['resend_verification_url'] = reverse(
                'admin:portfolio_userconfig_resend_verification',
                args=[user_config.pk],
            )
        return super().change_view(request, object_id, form_url=form_url, extra_context=extra_context)

    def resend_verification_view(self, request, object_id):
        if request.method != 'POST':
            return redirect('admin:portfolio_userconfig_change', object_id)

        user_config = get_object_or_404(UserConfig.objects.select_related('user'), pk=object_id)
        change_url = reverse('admin:portfolio_userconfig_change', args=[user_config.pk])

        if user_config.email_verified:
            messages.info(request, f'Tai khoan {user_config.user.username} da xac thuc email, khong can gui lai.')
            return HttpResponseRedirect(change_url)

        try:
            _resend_verification_for_user_config(user_config)
        except Exception as exc:
            messages.error(request, f'Gui lai email xac thuc that bai cho {user_config.user.username}: {exc}')
            return HttpResponseRedirect(change_url)

        messages.success(request, f'Da gui lai email xac thuc cho {user_config.user.username}.')
        return HttpResponseRedirect(change_url)

    @admin.action(description='Gui lai email xac thuc cho cac tai khoan chua verify')
    def resend_verification_email_to_selected_users(self, request, queryset):
        success_count = 0
        skipped_count = 0
        failure_count = 0

        for user_config in queryset.select_related('user'):
            if user_config.email_verified:
                skipped_count += 1
                continue

            try:
                _resend_verification_for_user_config(user_config)
                success_count += 1
            except Exception as exc:
                failure_count += 1
                self.message_user(
                    request,
                    f'Gui lai email xac thuc that bai cho {user_config.user.username}: {exc}',
                    level=messages.ERROR,
                )

        if success_count:
            self.message_user(request, f'Da gui lai email xac thuc cho {success_count} tai khoan.', level=messages.SUCCESS)
        if skipped_count:
            self.message_user(request, f'Bo qua {skipped_count} tai khoan da xac thuc email.', level=messages.INFO)
        if failure_count and not success_count:
            self.message_user(request, 'Khong co email xac thuc nao duoc gui thanh cong.', level=messages.WARNING)


class SystemEmailAccountAdminForm(forms.ModelForm):
    smtp_password = forms.CharField(
        label='Mật khẩu SMTP',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi mật khẩu đã lưu.',
    )

    class Meta:
        model = SystemEmailAccount
        exclude = ('password_ciphertext',)

    def save(self, commit=True):
        instance = super().save(commit=False)
        raw_password = self.cleaned_data.get('smtp_password')
        if raw_password:
            instance.set_smtp_password(raw_password)

        if commit:
            instance.save()
        return instance


@admin.register(SystemEmailAccount)
class SystemEmailAccountAdmin(admin.ModelAdmin):
    form = SystemEmailAccountAdminForm
    list_display = (
        'name',
        'host',
        'port',
        'username',
        'from_email',
        'is_active',
        'is_default',
        'last_test_status',
        'last_tested_at',
    )
    list_filter = ('is_active', 'is_default', 'use_tls', 'use_ssl', 'last_test_status')
    search_fields = ('name', 'host', 'username', 'from_email')
    ordering = ('-is_default', 'name')
    actions = ('mark_as_default', 'send_test_email_to_selected_accounts')
    readonly_fields = ('password_status', 'last_tested_at', 'last_test_status', 'last_test_message', 'created_at', 'updated_at')
    fieldsets = (
        ('Nhận diện', {'fields': ('name', 'notes', 'is_active', 'is_default')}),
        ('Máy chủ SMTP', {'fields': ('host', 'port', 'username', 'smtp_password', 'password_status', 'use_tls', 'use_ssl', 'timeout_seconds')}),
        ('Thông tin người gửi', {'fields': ('from_email', 'from_name', 'reply_to_email')}),
        ('Kết quả kiểm tra', {'fields': ('last_tested_at', 'last_test_status', 'last_test_message', 'created_at', 'updated_at')}),
    )

    @admin.display(description='Mật khẩu SMTP')
    def password_status(self, obj):
        return 'Đã lưu' if obj.password_ciphertext else 'Chưa cấu hình'

    @admin.action(description='Đặt làm cấu hình gửi mail mặc định')
    def mark_as_default(self, request, queryset):
        selected_account = queryset.order_by('pk').first()
        if not selected_account:
            self.message_user(request, 'Không có cấu hình mail nào được chọn.', level=messages.WARNING)
            return

        selected_account.is_default = True
        selected_account.is_active = True
        selected_account.save(update_fields=['is_default', 'is_active', 'updated_at'])
        self.message_user(
            request,
            f'Đã đặt cấu hình {selected_account.name} làm mail mặc định.',
            level=messages.SUCCESS,
        )

    @admin.action(description='Gửi mail kiểm tra tới email của tài khoản admin đang đăng nhập')
    def send_test_email_to_selected_accounts(self, request, queryset):
        recipient_email = (request.user.email or '').strip()
        if not recipient_email:
            self.message_user(
                request,
                'Tài khoản admin hiện tại chưa có email, không thể gửi mail kiểm tra.',
                level=messages.ERROR,
            )
            return

        success_count = 0
        failure_count = 0
        for account in queryset:
            try:
                send_test_email(account, recipient_email)
                success_count += 1
            except Exception as exc:
                failure_count += 1
                self.message_user(
                    request,
                    f'Gửi mail kiểm tra thất bại cho cấu hình {account.name}: {exc}',
                    level=messages.ERROR,
                )

        if success_count:
            self.message_user(
                request,
                f'Đã gửi {success_count} mail kiểm tra tới {recipient_email}.',
                level=messages.SUCCESS,
            )
        if failure_count and not success_count:
            self.message_user(request, 'Không có mail kiểm tra nào gửi thành công.', level=messages.WARNING)


@admin.register(SecuritiesGroup)
class SecuritiesGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'group_type', 'item_count', 'order', 'color')
    list_filter = ('group_type',)
    search_fields = ('name',)
    ordering = ('order', 'name')
    inlines = [SecuritiesItemInline]
    actions = ['sync_shared_market_groups', 'sync_shared_market_groups_clear']
    change_list_template = 'admin/portfolio/securitiesgroup/change_list.html'
    readonly_fields = ('name', 'group_type', 'description', 'color', 'order', 'created_at')

    @admin.display(description='Số mã trong nhóm')
    def item_count(self, obj):
        return obj.items.count()

    @admin.action(description='Đồng bộ lại taxonomy Nhóm thị trường dùng chung')
    def sync_shared_market_groups(self, request, queryset):
        result = sync_market_groups_for_users(
            User.objects.filter(is_active=True).order_by('username'),
            requested_by=request.user,
            mode='all',
            clear_existing=False,
        )
        _push_market_group_sync_messages(request, result)

    @admin.action(description='Xóa taxonomy hiện có và đồng bộ lại Nhóm thị trường dùng chung')
    def sync_shared_market_groups_clear(self, request, queryset):
        result = sync_market_groups_for_users(
            User.objects.filter(is_active=True).order_by('username'),
            requested_by=request.user,
            mode='all',
            clear_existing=True,
        )
        _push_market_group_sync_messages(request, result)

    def has_view_permission(self, request, obj=None):
        return super().has_view_permission(request, obj) or super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SecuritiesItem)
class SecuritiesItemAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'group', 'order', 'added_at', 'workspace_link')
    list_filter = ('group',)
    search_fields = ('symbol', 'group__name')
    ordering = ('group', 'order', 'symbol')
    readonly_fields = ('symbol', 'group', 'order', 'added_at', 'workspace_link')

    @admin.display(description='Workspace mã')
    def workspace_link(self, obj):
        return format_html('<a href="{}">Mở workspace</a>', _workspace_url_for_symbol(obj.symbol))

    def has_view_permission(self, request, obj=None):
        return super().has_view_permission(request, obj) or super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TrackedSymbol)
class TrackedSymbolAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'user', 'source_group', 'added_at')
    list_filter = ('user', 'source_group')
    search_fields = ('symbol', 'user__username')
    ordering = ('-added_at',)
    readonly_fields = ('added_at',)

    fieldsets = (
        ('Thông tin danh sách theo dõi tổng hợp', {
            'fields': ('user', 'symbol', 'source_group', 'added_at'),
        }),
    )

    def has_add_permission(self, request):
        # TrackedSymbol duoc su dung nhu danh sach tong hop trong luong theo doi.
        return False


@admin.register(PriceAlertRule)
class PriceAlertRuleAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'condition', 'target_price', 'user', 'cooldown_seconds', 'is_active', 'last_triggered_at')
    list_filter = ('condition', 'is_active', 'user')
    search_fields = ('symbol', 'user__username')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'last_triggered_at')

    fieldsets = (
        ('Thông tin cảnh báo giá', {
            'fields': ('user', 'symbol', 'condition', 'target_price', 'cooldown_seconds', 'is_active'),
        }),
        ('Theo dõi trigger', {
            'fields': ('last_triggered_at', 'created_at', 'updated_at'),
        }),
    )


@admin.register(StockProfile)
class StockProfileAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'company_name', 'industry', 'exchange', 'is_active', 'updated_at', 'workspace_link')
    list_filter = ('exchange', 'industry', 'is_active')
    search_fields = ('symbol', 'company_name', 'industry')
    ordering = ('symbol',)
    change_list_template = 'admin/portfolio/stockprofile/change_list.html'
    change_form_template = 'admin/portfolio/stockprofile/change_form.html'

    @admin.display(description='Chi tiết backend')
    def workspace_link(self, obj):
        url = _workspace_url_for_symbol(obj.pk)
        return format_html('<a href="{}">Mở workspace</a>', url)

    def change_view(self, request, object_id, form_url='', extra_context=None):
        extra_context = extra_context or {}
        extra_context['stock_workspace_url'] = _workspace_url_for_symbol(object_id)
        return super().change_view(request, object_id, form_url=form_url, extra_context=extra_context)


@admin.register(DailyPrice)
class DailyPriceAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume', 'workspace_link')
    list_filter = ('symbol',)
    search_fields = ('symbol',)
    ordering = ('-date', 'symbol')
    date_hierarchy = 'date'
    readonly_fields = ('created_at', 'workspace_link')

    @admin.display(description='Workspace mã')
    def workspace_link(self, obj):
        return format_html('<a href="{}">Mở workspace</a>', _workspace_url_for_symbol(obj.symbol))


@admin.register(IntradayTick)
class IntradayTickAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'trade_date', 'trade_time', 'price', 'volume', 'side', 'stream_id', 'created_at')
    list_filter = ('symbol', 'side', 'trade_date')
    search_fields = ('symbol', 'stream_id')
    ordering = ('-trade_date', '-trade_time')
    date_hierarchy = 'trade_date'
    readonly_fields = ('stream_id', 'created_at')


@admin.register(WatchlistGroup)
class WatchlistGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'item_count')
    list_filter = ('user',)
    search_fields = ('name', 'user__username')
    ordering = ('name',)
    inlines = [WatchlistItemInline]

    @admin.display(description='Số mã trong danh sách')
    def item_count(self, obj):
        return obj.items.count()


@admin.register(WatchlistItem)
class WatchlistItemAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'group', 'added_at')
    list_filter = ('group',)
    search_fields = ('symbol', 'group__name', 'group__user__username')
    ordering = ('-added_at',)


@admin.register(ScreenerRule)
class ScreenerRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active', 'user')
    search_fields = ('name', 'user__username')
    ordering = ('-created_at',)


@admin.register(MarketGroupSyncLog)
class MarketGroupSyncLogAdmin(admin.ModelAdmin):
    list_display = ('started_at', 'finished_at', 'duration_display', 'scope', 'target_user', 'requested_by', 'mode', 'source', 'success', 'created_groups', 'updated_groups', 'added_symbols')
    list_filter = ('scope', 'mode', 'source', 'success', 'clear_existing')
    search_fields = ('target_user__username', 'requested_by__username', 'message', 'error')
    ordering = ('-started_at',)
    date_hierarchy = 'started_at'
    readonly_fields = ('scope', 'target_user', 'requested_by', 'mode', 'clear_existing', 'success', 'total_users', 'total_groups', 'created_groups', 'updated_groups', 'added_symbols', 'source', 'message', 'error', 'started_at', 'finished_at')

    @admin.display(description='Thời gian chạy')
    def duration_display(self, obj):
        return _duration_display(obj.started_at, obj.finished_at)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(StockProfileSyncLog)
class StockProfileSyncLogAdmin(admin.ModelAdmin):
    list_display = ('started_at', 'finished_at', 'duration_display', 'requested_by', 'mode', 'source', 'success', 'total_symbols', 'created_symbols', 'updated_symbols')
    list_filter = ('mode', 'source', 'success')
    search_fields = ('requested_by__username', 'message', 'error')
    ordering = ('-started_at',)
    date_hierarchy = 'started_at'
    readonly_fields = ('scope', 'requested_by', 'mode', 'success', 'total_symbols', 'created_symbols', 'updated_symbols', 'source', 'message', 'error', 'started_at', 'finished_at')

    @admin.display(description='Thời gian chạy')
    def duration_display(self, obj):
        return _duration_display(obj.started_at, obj.finished_at)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
