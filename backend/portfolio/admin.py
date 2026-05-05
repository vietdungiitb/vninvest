import json
import threading
from urllib.parse import urlencode
from datetime import datetime

from django.conf import settings
from django.contrib import admin
from django.contrib import messages
from django.contrib.admin.widgets import FilteredSelectMultiple
from django.contrib.auth.models import User
from django import forms
from django.core import signing
from django.db.models import Max
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html
import pandas as pd

from .models import (
    AccountSnapshot,
    AICommandCenterAuditLog,
    DailyPrice,
    GlobalScreenerRule,
    IntradayTick,
    MarketGroupSyncLog,
    Portfolio,
    PriceAlertRule,
    PlanAssignmentLog,
    ScreenerRule,
    ScreenerScheduleConfig,
    SecuritiesGroup,
    SecuritiesItem,
    OnboardingPlanPolicy,
    StockProfile,
    StockProfileSyncLog,
    SubAccount,
    SystemAISettings,
    SystemAISettingsAuditLog,
    RuntimeVnstockConfig,
    SystemEmailAccount,
    TrackedSymbol,
    Transaction,
    UserConfig,
    UserAlertHistory,
    WatchlistGroup,
    WatchlistItem,
    WhaleAdvisory,
    WhaleConfigApproval,
    WhaleConfigAuditLog,
    WhaleConfigDraft,
    WhaleConfigRollout,
    WhaleConfigVersion,
    WhaleConfigWorkerAck,
    OrderFlowSignal,
    LegalPage,
)
from .mail_service import get_active_email_account, send_test_email
from .google_oauth_service import (
    build_google_oauth_authorize_url,
    exchange_google_oauth_code,
    fetch_google_user_email,
)
from .email_verification import send_verification_email
from .services import (
    build_whale_rollout_anomaly_snapshot,
    build_whale_config_runtime_preview,
    build_rollout_propagation_snapshot,
    get_latest_rollout_for_version,
    initialize_whale_config_rollout,
    sync_market_groups_for_user,
    sync_market_groups_for_users,
    sync_stock_profiles,
)


admin.site.site_header = 'VNInvest - Trang quản trị hệ thống'
admin.site.site_title = 'VNInvest Admin'
admin.site.index_title = 'Sơ đồ chức năng hệ thống'


MAIL_GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 600
GOOGLE_OAUTH_REDIRECT_URI_SETTING = 'GOOGLE_OAUTH_REDIRECT_URI'


_original_each_context = admin.site.each_context
_original_get_app_list = admin.site.get_app_list
_original_admin_get_urls = admin.site.get_urls


def _resolve_google_oauth_redirect_uri(request) -> str:
    configured_redirect_uri = str(getattr(settings, GOOGLE_OAUTH_REDIRECT_URI_SETTING, '') or '').strip()
    if configured_redirect_uri:
        return configured_redirect_uri
    callback_path = reverse('admin:portfolio_systememailaccount_google_callback')
    redirect_uri = request.build_absolute_uri(callback_path)

    # Safety net: if app runs behind chained proxies and scheme is still http,
    # force https for non-local hosts to prevent Google redirect_uri_mismatch.
    if redirect_uri.startswith('http://'):
        host = request.get_host().split(':', 1)[0].lower()
        if host not in {'localhost', '127.0.0.1'}:
            redirect_uri = 'https://' + redirect_uri[len('http://'):]

    return redirect_uri


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
        messages.warning(request, 'Không còn tài khoản nào đang chờ xác thực email.')
        return HttpResponseRedirect(next_url)

    try:
        _resend_verification_for_user_config(pending_config)
    except Exception as exc:
        messages.error(
            request,
            f'Gửi lại email xác thực thất bại cho {pending_config.user.username}: {exc}',
        )
        return HttpResponseRedirect(next_url)

    messages.success(
        request,
        f'Đã gửi lại email xác thực cho {pending_config.user.username}.',
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
        from .adapters.vnstock_adapter import fetch_price_board_dataframe

        df = fetch_price_board_dataframe([symbol], anchor_symbol=symbol)
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
                'ceiling_price': _f(ls.get('ceiling')) or _f(mt.get('ceiling_price')),
                'floor_price': _f(ls.get('floor')) or _f(mt.get('floor_price')),
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
        'OnboardingPlanPolicy': 'Chính sách onboarding trial',
        'PlanAssignmentLog': 'Nhật ký thay đổi gói',
        'SystemEmailAccount': 'Tài khoản gửi mail',
        'WhaleAdvisory': 'Whale Alerts AI',
        'WhaleConfigDraft': 'Whale Config Drafts',
        'WhaleConfigApproval': 'Whale Config Approvals',
        'WhaleConfigVersion': 'Whale Config Versions',
        'WhaleConfigRollout': 'Whale Config Rollouts',
        'WhaleConfigWorkerAck': 'Whale Worker ACKs',
        'WhaleConfigAuditLog': 'Whale Audit Logs',
        'User': 'Người dùng',
        'Group': 'Nhóm quyền',
    }

    for app in app_list:
        for model in app.get('models', []):
            object_name = model.get('object_name')
            if object_name in menu_name_override:
                model['name'] = menu_name_override[object_name]
            # Menu chỉ dùng để điều hướng, không hiển thị thao tác thêm mới.
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
                'OnboardingPlanPolicy',
                'PlanAssignmentLog',
                'SystemEmailAccount',
            ],
        ),
        (
            'whale_alerts_mission_control',
            '05. Whale Alerts và Mission Control',
            [
                'WhaleAdvisory',
                'WhaleConfigDraft',
                'WhaleConfigApproval',
                'WhaleConfigVersion',
                'WhaleConfigRollout',
                'WhaleConfigWorkerAck',
                'WhaleConfigAuditLog',
            ],
        ),
    ]

    grouped_apps = []
    grouped_model_names = set()
    for pseudo_label, title, model_names in grouped_definitions:
        grouped_models = []
        for name in model_names:
            model = models_by_name.get(name)
            if not model:
                continue
            grouped_models.append(model)
            grouped_model_names.add(name)
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

    remaining_models = [
        model
        for object_name, model in models_by_name.items()
        if object_name not in grouped_model_names
    ]
    if remaining_models:
        grouped_apps.append(
            {
                'name': '99. Danh mục khác (tự động)',
                'app_label': 'portfolio_misc',
                'app_url': '',
                'has_module_perms': True,
                'models': sorted(remaining_models, key=lambda item: item.get('name', '')),
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
        'plan',
        'plan_source',
        'plan_expires_at',
        'plan_locked_by_admin',
        'auto_downgrade_enabled',
        'verification_status',
        'email_verification_sent_at',
        'email_verified_at',
        'whale_alert_threshold',
        'theme',
        'updated_at',
    )
    list_filter = ('theme', 'email_verified', 'plan', 'plan_source', 'plan_locked_by_admin', 'auto_downgrade_enabled')
    search_fields = ('user__username', 'user__email')
    ordering = ('user__username',)
    change_form_template = 'admin/portfolio/userconfig/change_form.html'
    actions = ('resend_verification_email_to_selected_users',)
    readonly_fields = ('email_verified', 'email_verification_sent_at', 'email_verified_at', 'created_at', 'updated_at')
    fieldsets = (
        ('Người dùng', {'fields': ('user',)}),
        ('Xác thực email', {'fields': ('email_verified', 'email_verification_sent_at', 'email_verified_at')}),
        ('Cấu hình cá nhân', {'fields': ('whale_alert_threshold', 'theme')}),
        (
            'Gói dịch vụ',
            {
                'fields': (
                    'plan',
                    'plan_expires_at',
                    'plan_source',
                    'plan_assigned_at',
                    'downgraded_at',
                    'plan_locked_by_admin',
                    'auto_downgrade_enabled',
                )
            },
        ),
        ('OAuth', {'fields': ('oauth_provider', 'oauth_uid')}),
        ('Hệ thống', {'fields': ('created_at', 'updated_at')}),
    )

    def save_model(self, request, obj, form, change):
        previous = None
        if change:
            previous = UserConfig.objects.filter(pk=obj.pk).first()

        super().save_model(request, obj, form, change)

        if not previous:
            return

        tracked_fields = {
            'plan',
            'plan_expires_at',
            'plan_source',
            'plan_locked_by_admin',
            'auto_downgrade_enabled',
        }
        changed_fields = sorted(set(form.changed_data).intersection(tracked_fields))
        if not changed_fields:
            return

        PlanAssignmentLog.objects.create(
            user=obj.user,
            old_plan=previous.plan or '',
            new_plan=obj.plan,
            old_expires_at=previous.plan_expires_at,
            new_expires_at=obj.plan_expires_at,
            reason=PlanAssignmentLog.ReasonChoices.ADMIN_OVERRIDE,
            actor_type=PlanAssignmentLog.ActorTypeChoices.ADMIN,
            actor_user=request.user if request.user.is_authenticated else None,
            metadata_json={
                'changed_fields': changed_fields,
                'source': 'admin_userconfig_save',
            },
        )

    @admin.display(description='Trạng thái email')
    def verification_status(self, obj):
        return 'Đã xác thực' if obj.email_verified else 'Chưa xác thực'

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
            messages.info(request, f'Tài khoản {user_config.user.username} đã xác thực email, không cần gửi lại.')
            return HttpResponseRedirect(change_url)

        try:
            _resend_verification_for_user_config(user_config)
        except Exception as exc:
            messages.error(request, f'Gửi lại email xác thực thất bại cho {user_config.user.username}: {exc}')
            return HttpResponseRedirect(change_url)

        messages.success(request, f'Đã gửi lại email xác thực cho {user_config.user.username}.')
        return HttpResponseRedirect(change_url)

    @admin.action(description='Gửi lại email xác thực cho các tài khoản chưa verify')
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
                    f'Gửi lại email xác thực thất bại cho {user_config.user.username}: {exc}',
                    level=messages.ERROR,
                )

        if success_count:
            self.message_user(request, f'Đã gửi lại email xác thực cho {success_count} tài khoản.', level=messages.SUCCESS)
        if skipped_count:
            self.message_user(request, f'Bỏ qua {skipped_count} tài khoản đã xác thực email.', level=messages.INFO)
        if failure_count and not success_count:
            self.message_user(request, 'Không có email xác thực nào được gửi thành công.', level=messages.WARNING)


class SystemAISettingsAdminForm(forms.ModelForm):
    ai_api_key_raw = forms.CharField(
        label='AI API key hệ thống',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi key đã lưu.',
    )
    prefetch_runtime_settings_json = forms.JSONField(
        label='Prefetch Runtime Settings (JSON)',
        required=False,
        widget=forms.Textarea(attrs={'rows': 10}),
        help_text='Cấu hình runtime prefetch ticker. Áp dụng ngay sau khi lưu.',
    )
    intraday_universe_groups = forms.ModelMultipleChoiceField(
        label='Nhóm trong IntradayTick Universe',
        queryset=SecuritiesGroup.objects.all(),
        required=False,
        widget=FilteredSelectMultiple('Nhóm thị trường', is_stacked=False),
        help_text='Chọn nhóm được cưỡng bức đưa vào IntradayTick universe dù không có user theo dõi.',
    )
    prefetch_time_policy_json = forms.JSONField(
        label='Prefetch Time Policy (JSON)',
        required=False,
        widget=forms.Textarea(attrs={'rows': 18}),
        help_text='Quản lý policy prefetch theo khung giờ thị trường. Runtime áp dụng ngay, không cần restart.',
    )
    realtime_stream_enabled = forms.BooleanField(
        label='Bật Realtime Stream (Đường 2)',
        required=False,
        help_text='Kích hoạt DbWriterConsumer ghi tick từ Redis Stream vào DB mỗi 5s.',
    )
    intraday_tick_auto_cleanup_enabled = forms.BooleanField(
        label='Tự động xóa IntradayTick cũ',
        required=False,
        help_text='Bật task cleanup chạy lúc 18:30 hàng ngày.',
    )
    intraday_tick_keep_days = forms.IntegerField(
        label='Giữ lại IntradayTick (ngày)',
        min_value=1,
        required=False,
        initial=7,
        help_text='Số ngày tối thiểu giữ lại data. Dev: 3, Prod: 7-14.',
    )

    class Meta:
        model = SystemAISettings
        exclude = ('ai_api_key',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            from .views import _get_runtime_prefetch_settings, _get_runtime_prefetch_time_policy

            runtime_settings = _get_runtime_prefetch_settings()
            self.fields['prefetch_runtime_settings_json'].initial = runtime_settings
            selected_group_ids = runtime_settings.get('intraday_universe_group_ids', []) if isinstance(runtime_settings, dict) else []
            if isinstance(selected_group_ids, (list, tuple)):
                self.fields['intraday_universe_groups'].initial = SecuritiesGroup.objects.filter(id__in=selected_group_ids)
            else:
                self.fields['intraday_universe_groups'].initial = SecuritiesGroup.objects.none()
            self.fields['prefetch_time_policy_json'].initial = _get_runtime_prefetch_time_policy()
            if isinstance(runtime_settings, dict):
                self.fields['realtime_stream_enabled'].initial = bool(runtime_settings.get('realtime_stream_enabled', False))
                self.fields['intraday_tick_auto_cleanup_enabled'].initial = bool(runtime_settings.get('intraday_tick_auto_cleanup_enabled', True))
                self.fields['intraday_tick_keep_days'].initial = int(runtime_settings.get('intraday_tick_keep_days', 7))
        except Exception:
            # Fail-soft: vẫn cho phép mở form kể cả khi runtime policy backend đang lỗi tạm thời.
            self.fields['prefetch_runtime_settings_json'].initial = {}
            self.fields['intraday_universe_groups'].initial = SecuritiesGroup.objects.none()
            self.fields['prefetch_time_policy_json'].initial = {}

    def clean_prefetch_runtime_settings_json(self):
        payload = self.cleaned_data.get('prefetch_runtime_settings_json')
        if payload in (None, ''):
            payload = {}

        selected_groups = self.cleaned_data.get('intraday_universe_groups')
        selected_group_ids = [int(group.id) for group in (selected_groups or [])]

        try:
            from .views import _coerce_prefetch_runtime_settings, _default_prefetch_runtime_settings

            merged = dict(payload if isinstance(payload, dict) else {})
            merged['intraday_universe_group_ids'] = selected_group_ids
            merged['realtime_stream_enabled'] = bool(self.cleaned_data.get('realtime_stream_enabled', False))
            merged['intraday_tick_auto_cleanup_enabled'] = bool(self.cleaned_data.get('intraday_tick_auto_cleanup_enabled', True))
            keep_days = self.cleaned_data.get('intraday_tick_keep_days')
            if keep_days is not None:
                merged['intraday_tick_keep_days'] = max(int(keep_days), 1)
            return _coerce_prefetch_runtime_settings(merged, fallback=_default_prefetch_runtime_settings())
        except ValueError as exc:
            raise forms.ValidationError(str(exc)) from exc

    def clean_prefetch_time_policy_json(self):
        payload = self.cleaned_data.get('prefetch_time_policy_json')
        if payload in (None, ''):
            return None

        try:
            from .views import _coerce_prefetch_time_policy, _default_prefetch_time_policy

            return _coerce_prefetch_time_policy(payload, fallback=_default_prefetch_time_policy())
        except ValueError as exc:
            raise forms.ValidationError(str(exc)) from exc

    def save(self, commit=True):
        instance = super().save(commit=False)
        raw_key = str(self.cleaned_data.get('ai_api_key_raw') or '').strip()
        if raw_key:
            instance.set_ai_api_key(raw_key)
        if commit:
            instance.save()
        return instance


@admin.register(SystemAISettings)
class SystemAISettingsAdmin(admin.ModelAdmin):
    form = SystemAISettingsAdminForm
    list_display = (
        'name',
        'is_active',
        'ai_provider',
        'effective_model_display',
        'allow_env_fallback',
        'api_key_status',
        'updated_at',
    )
    list_filter = ('is_active', 'ai_provider', 'allow_env_fallback')
    search_fields = ('name', 'notes')
    readonly_fields = ('api_key_status', 'created_at', 'updated_at')
    actions = ('mark_as_active', 'test_connection_for_selected', 'reset_prefetch_time_policy_to_default')
    fieldsets = (
        ('Nhận diện', {'fields': ('name', 'is_active', 'notes')}),
        ('AI runtime', {'fields': ('ai_provider', 'ai_model', 'allow_env_fallback', 'ai_api_key_raw', 'api_key_status')}),
        ('Prefetch runtime', {'fields': ('prefetch_runtime_settings_json', 'intraday_universe_groups', 'prefetch_time_policy_json')}),
        ('Realtime Stream & Retention', {'fields': ('realtime_stream_enabled', 'intraday_tick_auto_cleanup_enabled', 'intraday_tick_keep_days')}),
        ('Hệ thống', {'fields': ('created_at', 'updated_at')}),
    )

    @admin.display(description='Model hiệu lực')
    def effective_model_display(self, obj):
        return obj.get_effective_ai_model()

    @admin.display(description='API key hệ thống')
    def api_key_status(self, obj):
        return 'Đã lưu' if obj.ai_api_key_configured else 'Chưa lưu trong DB'

    @admin.action(description='Đặt làm cấu hình AI hệ thống đang active')
    def mark_as_active(self, request, queryset):
        target = queryset.order_by('-updated_at', '-id').first()
        if not target:
            self.message_user(request, 'Không có cấu hình nào được chọn.', level=messages.WARNING)
            return

        target.is_active = True
        target.save(update_fields=['is_active', 'updated_at'])
        self.message_user(request, f'Đã kích hoạt System AI Settings: {target.name}.', level=messages.SUCCESS)

    def _build_admin_snapshot(self, obj):
        from .views import _get_runtime_governance_delta_thresholds, _get_runtime_prefetch_settings, _get_runtime_prefetch_time_policy

        if obj is None:
            return {}
        return {
            'id': obj.id,
            'name': obj.name,
            'is_active': bool(obj.is_active),
            'ai_provider': str(obj.ai_provider or '').strip().lower(),
            'ai_model': str(obj.ai_model or '').strip(),
            'effective_ai_model': obj.get_effective_ai_model(),
            'allow_env_fallback': bool(obj.allow_env_fallback),
            'ai_api_key_configured': obj.ai_api_key_configured,
            'notes': str(obj.notes or ''),
            'governance_delta_thresholds': _get_runtime_governance_delta_thresholds(),
            'prefetch_runtime_settings': _get_runtime_prefetch_settings(),
            'prefetch_time_policy': _get_runtime_prefetch_time_policy(),
        }

    def save_model(self, request, obj, form, change):
        before_obj = None
        if change and obj.pk:
            before_obj = type(obj).objects.filter(pk=obj.pk).first()
        before_snapshot = self._build_admin_snapshot(before_obj)

        super().save_model(request, obj, form, change)

        runtime_payload = form.cleaned_data.get('prefetch_runtime_settings_json')
        if runtime_payload is not None:
            from .views import _set_runtime_prefetch_settings

            _set_runtime_prefetch_settings(runtime_payload)

        policy_payload = form.cleaned_data.get('prefetch_time_policy_json')
        if policy_payload is not None:
            from .views import _set_runtime_prefetch_time_policy

            _set_runtime_prefetch_time_policy(policy_payload)

        after_snapshot = self._build_admin_snapshot(obj)
        if before_snapshot != after_snapshot:
            SystemAISettingsAuditLog.objects.create(
                settings=obj,
                actor=request.user if request.user.is_authenticated else None,
                action='update_settings',
                reason='updated_via_django_admin',
                before_json=before_snapshot,
                after_json=after_snapshot,
            )

    @admin.action(description='Reset prefetch time policy về mặc định')
    def reset_prefetch_time_policy_to_default(self, request, queryset):
        target = queryset.order_by('-updated_at', '-id').first()
        if not target:
            self.message_user(request, 'Không có cấu hình nào được chọn.', level=messages.WARNING)
            return

        before_snapshot = self._build_admin_snapshot(target)

        from .views import _default_prefetch_time_policy, _set_runtime_prefetch_time_policy

        _set_runtime_prefetch_time_policy(_default_prefetch_time_policy())

        after_snapshot = self._build_admin_snapshot(target)
        if before_snapshot != after_snapshot:
            SystemAISettingsAuditLog.objects.create(
                settings=target,
                actor=request.user if request.user.is_authenticated else None,
                action='update_settings',
                reason='reset_prefetch_time_policy_via_django_admin',
                before_json=before_snapshot,
                after_json=after_snapshot,
            )

        self.message_user(request, 'Đã reset prefetch time policy về mặc định.', level=messages.SUCCESS)

    @admin.action(description='Kiểm tra kết nối AI cho cấu hình đã chọn')
    def test_connection_for_selected(self, request, queryset):
        from .ai_runtime_config import resolve_ai_runtime_config
        from .ai_service import test_ai_connection

        target = queryset.order_by('-updated_at', '-id').first()
        if not target:
            self.message_user(request, 'Không có cấu hình nào được chọn.', level=messages.WARNING)
            return

        resolved = resolve_ai_runtime_config(user=None, system_settings=target)
        if not resolved.get('ready'):
            self.message_user(
                request,
                f"Cấu hình chưa sẵn sàng: {resolved.get('message') or resolved.get('reason')}",
                level=messages.ERROR,
            )
            return

        payload = test_ai_connection(
            provider=str(resolved.get('provider') or ''),
            model=str(resolved.get('model') or ''),
            api_key=str(resolved.get('api_key') or ''),
        )
        if payload.get('ok'):
            self.message_user(
                request,
                f"Test kết nối thành công ({payload.get('provider')}/{payload.get('model')}).",
                level=messages.SUCCESS,
            )
            return

        self.message_user(
            request,
            f"Test kết nối thất bại: {payload.get('message')}",
            level=messages.ERROR,
        )


@admin.register(SystemAISettingsAuditLog)
class SystemAISettingsAuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'actor', 'action', 'settings', 'reason')
    list_filter = ('action', 'actor')
    search_fields = ('reason', 'actor__username', 'settings__name')
    readonly_fields = ('settings', 'actor', 'action', 'reason', 'before_json', 'after_json', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AICommandCenterAuditLog)
class AICommandCenterAuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'actor', 'action', 'command_center_config', 'reason')
    list_filter = ('action', 'actor', 'created_at')
    search_fields = ('reason', 'actor__username', 'command_center_config__user__username')
    readonly_fields = ('command_center_config', 'actor', 'action', 'reason', 'before_json', 'after_json', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RuntimeVnstockConfig)
class RuntimeVnstockConfigAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'max_concurrency',
        'retry_attempts',
        'price_board_source',
        'enable_concurrent_limit',
        'enable_rate_limit_detection',
        'updated_by',
        'updated_at',
    )
    readonly_fields = ('changelog', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return False


@admin.register(OnboardingPlanPolicy)
class OnboardingPlanPolicyAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'is_active',
        'trial_plan',
        'trial_duration_days',
        'fallback_plan',
        'effective_from',
        'effective_to',
        'updated_at',
    )
    list_filter = ('is_active', 'trial_plan', 'fallback_plan')
    search_fields = ('id', 'created_by__username', 'updated_by__username')
    ordering = ('-updated_at',)
    actions = ('activate_selected_policy',)
    readonly_fields = ('created_by', 'updated_by', 'created_at', 'updated_at')

    @admin.action(description='Kích hoạt policy đã chọn (tự động tắt policy khác)')
    def activate_selected_policy(self, request, queryset):
        policy = queryset.order_by('-updated_at').first()
        if not policy:
            self.message_user(request, 'Không có policy nào được chọn.', level=messages.WARNING)
            return

        OnboardingPlanPolicy.objects.exclude(pk=policy.pk).filter(is_active=True).update(
            is_active=False,
            updated_by=request.user,
            updated_at=timezone.now(),
        )
        if not policy.is_active:
            policy.is_active = True
            policy.updated_by = request.user
            policy.save(update_fields=['is_active', 'updated_by', 'updated_at'])

        self.message_user(
            request,
            f'Đã kích hoạt policy #{policy.pk} và tắt các policy active khác.',
            level=messages.SUCCESS,
        )

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(PlanAssignmentLog)
class PlanAssignmentLogAdmin(admin.ModelAdmin):
    list_display = (
        'created_at',
        'user',
        'old_plan',
        'new_plan',
        'reason',
        'actor_type',
        'actor_user',
    )
    list_filter = ('reason', 'actor_type', 'created_at', 'new_plan')
    search_fields = ('user__username', 'user__email', 'actor_user__username', 'old_plan', 'new_plan')
    ordering = ('-created_at',)
    readonly_fields = (
        'user',
        'old_plan',
        'new_plan',
        'old_expires_at',
        'new_expires_at',
        'reason',
        'actor_type',
        'actor_user',
        'metadata_json',
        'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class SystemEmailAccountAdminForm(forms.ModelForm):
    smtp_password = forms.CharField(
        label='Mật khẩu SMTP',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi mật khẩu đã lưu.',
    )
    google_client_secret = forms.CharField(
        label='Google Client Secret',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi client secret đã lưu.',
    )
    google_refresh_token = forms.CharField(
        label='Google Refresh Token',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi refresh token đã lưu.',
    )

    class Meta:
        model = SystemEmailAccount
        exclude = ('password_ciphertext', 'google_client_secret_ciphertext', 'google_refresh_token_ciphertext')

    def clean(self):
        cleaned_data = super().clean()

        # Persist raw secret inputs onto the instance before model validation runs.
        # Model.clean() checks encrypted fields, not the transient form fields.
        raw_password = cleaned_data.get('smtp_password')
        if raw_password:
            self.instance.set_smtp_password(raw_password)

        raw_google_secret = cleaned_data.get('google_client_secret')
        if raw_google_secret:
            self.instance.set_google_client_secret(raw_google_secret)

        raw_refresh_token = cleaned_data.get('google_refresh_token')
        if raw_refresh_token:
            self.instance.set_google_refresh_token(raw_refresh_token)

        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        raw_password = self.cleaned_data.get('smtp_password')
        if raw_password:
            instance.set_smtp_password(raw_password)

        raw_google_secret = self.cleaned_data.get('google_client_secret')
        if raw_google_secret:
            instance.set_google_client_secret(raw_google_secret)

        raw_refresh_token = self.cleaned_data.get('google_refresh_token')
        if raw_refresh_token:
            instance.set_google_refresh_token(raw_refresh_token)

        if commit:
            instance.save()
        return instance


@admin.register(SystemEmailAccount)
class SystemEmailAccountAdmin(admin.ModelAdmin):
    form = SystemEmailAccountAdminForm
    list_display = (
        'name',
        'auth_type',
        'host',
        'port',
        'username',
        'from_email',
        'is_active',
        'is_default',
        'last_test_status',
        'last_tested_at',
    )
    list_filter = ('auth_type', 'is_active', 'is_default', 'use_tls', 'use_ssl', 'last_test_status')
    search_fields = ('name', 'host', 'username', 'from_email')
    ordering = ('-is_default', 'name')
    actions = ('mark_as_default', 'send_test_email_to_selected_accounts')
    readonly_fields = (
        'password_status',
        'google_client_secret_status',
        'google_refresh_token_status',
        'last_tested_at',
        'last_test_status',
        'last_test_message',
        'oauth_connected_at',
        'token_last_refreshed_at',
        'token_last_error',
        'created_at',
        'updated_at',
        'oauth_actions',
    )
    fieldsets = (
        ('Nhận diện', {'fields': ('name', 'auth_type', 'oauth_provider', 'notes', 'is_active', 'is_default')}),
        ('Máy chủ SMTP', {'fields': ('host', 'port', 'username', 'smtp_password', 'password_status', 'use_tls', 'use_ssl', 'timeout_seconds')}),
        (
            'Google OAuth2',
            {
                'fields': (
                    'google_client_id',
                    'google_client_secret',
                    'google_client_secret_status',
                    'google_refresh_token',
                    'google_refresh_token_status',
                    'google_account_email',
                    'google_token_scope',
                    'oauth_connected_at',
                    'token_last_refreshed_at',
                    'token_last_error',
                    'oauth_actions',
                )
            },
        ),
        ('Thông tin người gửi', {'fields': ('from_email', 'from_name', 'reply_to_email')}),
        ('Kết quả kiểm tra', {'fields': ('last_tested_at', 'last_test_status', 'last_test_message', 'created_at', 'updated_at')}),
    )

    @admin.display(description='Mật khẩu SMTP')
    def password_status(self, obj):
        return 'Đã lưu' if obj.password_ciphertext else 'Chưa cấu hình'

    @admin.display(description='Google Client Secret')
    def google_client_secret_status(self, obj):
        return 'Đã lưu' if obj.google_client_secret_ciphertext else 'Chưa cấu hình'

    @admin.display(description='Google Refresh Token')
    def google_refresh_token_status(self, obj):
        return 'Đã lưu' if obj.google_refresh_token_ciphertext else 'Chưa cấu hình'

    @admin.display(description='OAuth2 actions')
    def oauth_actions(self, obj):
        if not obj or not obj.pk:
            return 'Lưu cấu hình trước khi thao tác OAuth2.'
        connect_url = reverse('admin:portfolio_systememailaccount_google_connect', args=[obj.pk])
        revoke_url = reverse('admin:portfolio_systememailaccount_google_revoke', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}">Connect Google</a>&nbsp;'
            '<a class="button" href="{}">Revoke Token</a>',
            connect_url,
            revoke_url,
        )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/google/connect/',
                self.admin_site.admin_view(self.google_connect_view),
                name='portfolio_systememailaccount_google_connect',
            ),
            path(
                'google/callback/',
                self.admin_site.admin_view(self.google_callback_view),
                name='portfolio_systememailaccount_google_callback',
            ),
            path(
                '<path:object_id>/google/revoke/',
                self.admin_site.admin_view(self.google_revoke_view),
                name='portfolio_systememailaccount_google_revoke',
            ),
        ]
        return custom_urls + urls

    def google_connect_view(self, request, object_id):
        account = get_object_or_404(SystemEmailAccount, pk=object_id)
        change_url = reverse('admin:portfolio_systememailaccount_change', args=[account.pk])
        if account.auth_type != SystemEmailAccount.AuthTypeChoices.GOOGLE_OAUTH2:
            self.message_user(request, 'Cấu hình này chưa chọn auth_type=google_oauth2.', level=messages.ERROR)
            return HttpResponseRedirect(change_url)

        if not account.google_client_id or not account.get_google_client_secret():
            self.message_user(request, 'Thiếu Google Client ID/Secret.', level=messages.ERROR)
            return HttpResponseRedirect(change_url)

        state_payload = signing.dumps(
            {'account_id': account.pk, 'user_id': request.user.pk},
            salt='portfolio.system-email-google-oauth-state',
        )
        request.session['mail_google_oauth_state'] = state_payload
        request.session['mail_google_oauth_account_id'] = account.pk

        redirect_uri = _resolve_google_oauth_redirect_uri(request)
        scope = (account.google_token_scope or '').strip() or 'https://www.googleapis.com/auth/gmail.send openid email'
        authorize_url = build_google_oauth_authorize_url(
            client_id=account.google_client_id,
            redirect_uri=redirect_uri,
            state=state_payload,
            scope=scope,
        )
        return redirect(authorize_url)

    def google_callback_view(self, request):
        state = request.GET.get('state', '')
        code = request.GET.get('code', '')
        oauth_error = request.GET.get('error', '')
        session_state_token = request.session.get('mail_google_oauth_state', '')
        account_id = request.session.get('mail_google_oauth_account_id')

        if oauth_error:
            self.message_user(request, f'Google OAuth lỗi: {oauth_error}', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:portfolio_systememailaccount_changelist'))

        if not state or not session_state_token or state != session_state_token:
            self.message_user(request, 'OAuth state không hợp lệ. Vui lòng thử lại.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:portfolio_systememailaccount_changelist'))

        try:
            state_payload = signing.loads(
                state,
                salt='portfolio.system-email-google-oauth-state',
                max_age=MAIL_GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
            )
        except signing.SignatureExpired:
            self.message_user(request, 'OAuth state đã hết hạn. Vui lòng kết nối lại Google.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:portfolio_systememailaccount_changelist'))
        except signing.BadSignature:
            self.message_user(request, 'OAuth state bị sai chữ ký. Vui lòng thử lại.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:portfolio_systememailaccount_changelist'))

        if not code or not account_id:
            self.message_user(request, 'Thiếu authorization code hoặc account context.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:portfolio_systememailaccount_changelist'))

        payload_account_id = state_payload.get('account_id')
        payload_user_id = state_payload.get('user_id')
        if payload_account_id != account_id or payload_user_id != request.user.pk:
            self.message_user(request, 'OAuth state không khớp account/user hiện tại.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:portfolio_systememailaccount_changelist'))

        account = get_object_or_404(SystemEmailAccount, pk=account_id)
        change_url = reverse('admin:portfolio_systememailaccount_change', args=[account.pk])

        try:
            redirect_uri = _resolve_google_oauth_redirect_uri(request)
            token_payload = exchange_google_oauth_code(
                client_id=account.google_client_id,
                client_secret=account.get_google_client_secret(),
                code=code,
                redirect_uri=redirect_uri,
                timeout_seconds=account.timeout_seconds,
            )
            refresh_token = str(token_payload.get('refresh_token') or '').strip()
            access_token = str(token_payload.get('access_token') or '').strip()
            scope = str(token_payload.get('scope') or '').strip()

            if refresh_token:
                account.set_google_refresh_token(refresh_token)
            elif not account.has_google_refresh_token:
                raise ValueError('Google không trả refresh_token. Hãy cấp lại consent với prompt=consent.')
            if scope:
                account.google_token_scope = scope

            email = fetch_google_user_email(access_token=access_token, timeout_seconds=account.timeout_seconds)
            if email:
                account.google_account_email = email
            account.oauth_provider = 'google'
            account.oauth_connected_at = timezone.now()
            account.token_last_error = ''
            account.save(update_fields=[
                'google_refresh_token_ciphertext',
                'google_token_scope',
                'google_account_email',
                'oauth_provider',
                'oauth_connected_at',
                'token_last_error',
                'updated_at',
            ])
            self.message_user(request, f'Kết nối Google thành công cho cấu hình {account.name}.', level=messages.SUCCESS)
        except Exception as exc:
            account.token_last_error = str(exc)
            account.save(update_fields=['token_last_error', 'updated_at'])
            self.message_user(request, f'Kết nối Google thất bại: {exc}', level=messages.ERROR)
        finally:
            request.session.pop('mail_google_oauth_state', None)
            request.session.pop('mail_google_oauth_account_id', None)

        return HttpResponseRedirect(change_url)

    def google_revoke_view(self, request, object_id):
        account = get_object_or_404(SystemEmailAccount, pk=object_id)
        account.clear_google_refresh_token()
        account.google_account_email = ''
        account.oauth_connected_at = None
        account.token_last_error = ''
        account.save(update_fields=[
            'google_refresh_token_ciphertext',
            'google_account_email',
            'oauth_connected_at',
            'token_last_error',
            'updated_at',
        ])
        self.message_user(request, f'Đã gỡ token Google cho cấu hình {account.name}.', level=messages.SUCCESS)
        return HttpResponseRedirect(reverse('admin:portfolio_systememailaccount_change', args=[account.pk]))

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


@admin.register(GlobalScreenerRule)
class GlobalScreenerRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name',)
    ordering = ('-updated_at', '-created_at')


@admin.register(ScreenerScheduleConfig)
class ScreenerScheduleConfigAdmin(admin.ModelAdmin):
    list_display = ('cron_expression', 'is_user_custom_screener_enabled', 'updated_at', 'created_at')
    list_filter = ('is_user_custom_screener_enabled',)
    ordering = ('-updated_at', '-created_at')


@admin.register(UserAlertHistory)
class UserAlertHistoryAdmin(admin.ModelAdmin):
    list_display = ('matched_at', 'user', 'symbol', 'alert_type')
    list_filter = ('alert_type', 'symbol')
    search_fields = ('user__username', 'symbol', 'message')
    ordering = ('-matched_at', '-id')
    readonly_fields = ('user', 'symbol', 'alert_type', 'message', 'matched_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


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


def _is_supervisor(user):
    return bool(user and user.is_staff)


def _is_analyst(user):
    return bool(user and user.is_authenticated)


def _log_whale_config_audit(
    *,
    actor,
    action,
    draft=None,
    version=None,
    rollout=None,
    reason='',
    before_json=None,
    after_json=None,
    ticket_ref='',
):
    WhaleConfigAuditLog.objects.create(
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        action=action,
        draft=draft,
        version=version,
        rollout=rollout,
        reason=reason or '',
        before_json=before_json or {},
        after_json=after_json or {},
        ticket_ref=ticket_ref or '',
    )


def _push_whale_config_preview_messages(model_admin, request, preview):
    diff_lines = preview.get('diff_lines') or []
    if diff_lines:
        preview_text = ' | '.join(diff_lines[:4])
        if len(diff_lines) > 4:
            preview_text = f'{preview_text} | ...'
        model_admin.message_user(request, f'Diff preview: {preview_text}', level=messages.INFO)
    else:
        model_admin.message_user(
            request,
            'Diff preview: không có thay đổi trên các trường quan trọng.',
            level=messages.INFO,
        )

    dependency_summary = preview.get('dependency_summary') or {}
    if dependency_summary:
        status_label = 'healthy' if not dependency_summary.get('blocking_issues') else 'degraded'
        model_admin.message_user(
            request,
            f'Dependency check ({status_label}): {dependency_summary.get("summary", "n/a")}',
            level=messages.INFO,
        )

    for warning in preview.get('warnings') or []:
        model_admin.message_user(request, warning, level=messages.WARNING)

    for issue in preview.get('blocking_issues') or []:
        model_admin.message_user(request, issue, level=messages.ERROR)


def _render_signal_badge(signal: str, summary: str):
    palette = {
        'green': ('#166534', '#dcfce7', 'GREEN'),
        'amber': ('#92400e', '#fef3c7', 'AMBER'),
        'red': ('#991b1b', '#fee2e2', 'RED'),
    }
    fg, bg, label = palette.get(signal, palette['red'])
    return format_html(
        '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-weight:600;color:{};background:{};">{}: {}</span>',
        fg,
        bg,
        label,
        summary,
    )


@admin.register(WhaleConfigDraft)
class WhaleConfigDraftAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'status', 'created_by', 'submitted_at', 'linked_version', 'updated_at')
    list_filter = ('status', 'created_by')
    search_fields = ('name', 'created_by__username')
    readonly_fields = ('submitted_at', 'created_at', 'updated_at')
    actions = ('submit_selected_drafts',)

    fieldsets = (
        ('Draft', {'fields': ('name', 'config_json', 'status', 'reason')}),
        ('Workflow', {'fields': ('created_by', 'submitted_at', 'linked_version')}),
        ('System', {'fields': ('created_at', 'updated_at')}),
    )

    def get_readonly_fields(self, request, obj=None):
        readonly = list(self.readonly_fields)
        if not _is_supervisor(request.user):
            readonly.append('status')
            readonly.append('linked_version')
        if obj and obj.status != WhaleConfigDraft.StatusChoices.DRAFT:
            readonly.extend(['name', 'config_json'])
        return tuple(dict.fromkeys(readonly))

    def has_view_permission(self, request, obj=None):
        return _is_analyst(request.user)

    def has_add_permission(self, request):
        return _is_analyst(request.user)

    def has_change_permission(self, request, obj=None):
        if not _is_analyst(request.user):
            return False
        if _is_supervisor(request.user):
            return True
        if obj is None:
            return True
        return obj.created_by_id == request.user.id and obj.status == WhaleConfigDraft.StatusChoices.DRAFT

    def has_delete_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    def save_model(self, request, obj, form, change):
        before_json = {}
        if change:
            original = WhaleConfigDraft.objects.get(pk=obj.pk)
            before_json = {
                'name': original.name,
                'status': original.status,
                'reason': original.reason,
                'config_json': original.config_json,
            }

        if not obj.created_by_id:
            obj.created_by = request.user

        super().save_model(request, obj, form, change)

        _log_whale_config_audit(
            actor=request.user,
            action='update_draft' if change else 'create_draft',
            draft=obj,
            reason=obj.reason,
            before_json=before_json,
            after_json={
                'name': obj.name,
                'status': obj.status,
                'reason': obj.reason,
                'config_json': obj.config_json,
            },
        )

    @admin.action(description='Submit selected drafts')
    def submit_selected_drafts(self, request, queryset):
        updated = 0
        for draft in queryset:
            if not _is_supervisor(request.user) and draft.created_by_id != request.user.id:
                continue
            if draft.status != WhaleConfigDraft.StatusChoices.DRAFT:
                continue

            preview = build_whale_config_runtime_preview(
                draft.config_json,
                rollout_mode='draft',
                current_config=draft.linked_version.config_json if draft.linked_version_id else None,
            )
            _push_whale_config_preview_messages(self, request, preview)
            if preview.get('blocking_issues'):
                continue

            before = {'status': draft.status}
            draft.status = WhaleConfigDraft.StatusChoices.SUBMITTED
            draft.submitted_at = timezone.now()
            draft.save(update_fields=['status', 'submitted_at', 'updated_at'])
            updated += 1

            _log_whale_config_audit(
                actor=request.user,
                action='submit_draft',
                draft=draft,
                reason=draft.reason,
                before_json=before,
                after_json={
                    'status': draft.status,
                    'submitted_at': draft.submitted_at.isoformat() if draft.submitted_at else None,
                    'diff_preview': preview.get('diff_items') or [],
                },
            )

        if updated:
            self.message_user(request, f'Đã submit {updated} draft.', level=messages.SUCCESS)
        else:
            self.message_user(request, 'Không có draft hợp lệ để submit.', level=messages.WARNING)


@admin.register(WhaleAdvisory)
class WhaleAdvisoryAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'symbol', 'side', 'matched_value', 'threshold', 'ai_provider',
        'prompt_tokens', 'completion_tokens', 'created_at',
    )
    list_filter = ('side', 'ai_provider', 'created_at')
    search_fields = ('symbol', 'ai_summary', 'ai_detail')
    ordering = ('-created_at',)
    readonly_fields = (
        'symbol', 'matched_value', 'side', 'threshold', 'ai_summary', 'ai_detail',
        'ai_provider', 'prompt_tokens', 'completion_tokens', 'created_at',
    )

    def has_view_permission(self, request, obj=None):
        return _is_analyst(request.user)

    def has_add_permission(self, request):
        return False


# ---------------------------------------------------------------------------
# SystemSetting Admin
# ---------------------------------------------------------------------------
from .models import SystemSetting  # noqa: E402


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'description_short', 'updated_by', 'updated_at')
    search_fields = ('key', 'value', 'description')
    readonly_fields = ('updated_at', 'created_at')
    ordering = ('key',)

    fieldsets = (
        ('Cấu hình', {
            'fields': ('key', 'value', 'description'),
            'description': (
                'Thay đổi giá trị xong nhấn Lưu — hệ thống áp dụng ngay sau tối đa 5 phút '
                '(thời gian cache Redis TTL). Để áp dụng ngay lập tức, reload backend container.'
            ),
        }),
        ('Thông tin', {
            'fields': ('updated_by', 'updated_at', 'created_at'),
            'classes': ('collapse',),
        }),
    )

    def description_short(self, obj):
        return (obj.description or '')[:80] + ('…' if len(obj.description or '') > 80 else '')
    description_short.short_description = 'Mô tả'

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
        try:
            from django.core.cache import cache
            cache.delete(f'system_setting:{obj.key}')
        except Exception:
            pass

    def has_view_permission(self, request, obj=None):
        return request.user.is_staff

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(WhaleConfigApproval)
class WhaleConfigApprovalAdmin(admin.ModelAdmin):
    list_display = ('id', 'draft', 'reviewer', 'decision', 'created_at')
    list_filter = ('decision', 'reviewer')
    search_fields = ('draft__name', 'reviewer__username', 'comment')
    readonly_fields = ('created_at',)

    def has_view_permission(self, request, obj=None):
        return _is_analyst(request.user)

    def has_add_permission(self, request):
        return _is_supervisor(request.user)

    def has_change_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.decision == obj.DecisionChoices.APPROVED:
            obj.draft.status = obj.draft.StatusChoices.APPROVED
            obj.draft.save(update_fields=['status', 'updated_at'])
            WhaleConfigAuditLog.objects.create(
                actor=request.user,
                action='approve',
                draft=obj.draft,
                reason=obj.comment or '',
                before_json={'status': 'submitted'},
                after_json={'status': 'approved'},
            )
        elif obj.decision == obj.DecisionChoices.REJECTED:
            obj.draft.status = obj.draft.StatusChoices.REJECTED
            obj.draft.save(update_fields=['status', 'updated_at'])
            WhaleConfigAuditLog.objects.create(
                actor=request.user,
                action='reject',
                draft=obj.draft,
                reason=obj.comment or '',
                before_json={'status': 'submitted'},
                after_json={'status': 'rejected'},
            )


# ---------------------------------------------------------------------------
# Sprint 28 — LegalPage Admin
# ---------------------------------------------------------------------------
@admin.register(LegalPage)
class LegalPageAdmin(admin.ModelAdmin):
    list_display = ('id', 'slug', 'locale', 'title', 'version', 'is_active', 'published_at', 'updated_at')
    list_filter = ('slug', 'locale', 'is_active')
    search_fields = ('title', 'summary', 'content_markdown')
    ordering = ('slug', 'locale', '-version')
    readonly_fields = ('created_at', 'updated_at', 'updated_by')
    actions = ('activate_selected_legal_page',)

    fieldsets = (
        ('Thông tin cơ bản', {
            'fields': ('slug', 'locale', 'title', 'version', 'is_active', 'published_at'),
        }),
        ('Nội dung', {
            'fields': ('summary', 'content_markdown'),
        }),
        ('Metadata', {
            'fields': ('updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.action(description='Kích hoạt trang đã chọn (tắt bản active cùng slug+locale)')
    def activate_selected_legal_page(self, request, queryset):
        from django.db import transaction as _tx
        page = queryset.order_by('-version').first()
        if not page:
            self.message_user(request, 'Không có trang nào được chọn.', level=messages.WARNING)
            return
        with _tx.atomic():
            LegalPage.objects.filter(
                slug=page.slug, locale=page.locale, is_active=True
            ).exclude(pk=page.pk).update(is_active=False)
            if not page.is_active:
                page.is_active = True
            if not page.published_at:
                page.published_at = timezone.now()
            page.updated_by = request.user
            page.save(update_fields=['is_active', 'published_at', 'updated_by', 'updated_at'])
        self.message_user(
            request,
            f'Đã kích hoạt "{page.title}" [{page.slug}/{page.locale}] và tắt các bản cũ.',
            level=messages.SUCCESS,
        )

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

    def has_add_permission(self, request):
        return _is_supervisor(request.user)

    def has_change_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    def has_delete_permission(self, request, obj=None):
        return _is_supervisor(request.user)


@admin.register(WhaleConfigVersion)
class WhaleConfigVersionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'version_code', 'status', 'created_by', 'approved_by', 'approved_at', 'activated_at',
        'latest_rollout_signal', 'latest_anomaly_signal',
    )
    list_filter = ('status', 'created_by', 'approved_by')
    search_fields = ('version_code', 'notes')
    readonly_fields = (
        'approved_by', 'approved_at', 'activated_at', 'latest_rollout_signal', 'latest_anomaly_signal',
        'created_at', 'updated_at',
    )
    actions = ('mark_as_active_version', 'mark_as_rolled_back')

    def latest_rollout_signal(self, obj):
        rollout = get_latest_rollout_for_version(obj)
        if not rollout:
            return 'No rollout'
        snapshot = build_rollout_propagation_snapshot(rollout)
        return _render_signal_badge(snapshot['signal'], snapshot['summary'])

    latest_rollout_signal.short_description = 'Propagation'

    def latest_anomaly_signal(self, obj):
        rollout = get_latest_rollout_for_version(obj)
        if not rollout:
            return 'No anomaly scan'
        snapshot = build_whale_rollout_anomaly_snapshot(rollout)
        signal = 'green' if snapshot['healthy'] else 'red'
        return _render_signal_badge(signal, snapshot['summary'])

    latest_anomaly_signal.short_description = 'Anomaly'

    def has_view_permission(self, request, obj=None):
        return _is_analyst(request.user)

    def has_add_permission(self, request):
        return _is_supervisor(request.user)

    def has_change_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    def has_delete_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    @admin.action(description='Approve & mark selected version as active')
    def mark_as_active_version(self, request, queryset):
        if not _is_supervisor(request.user):
            self.message_user(request, 'Bạn không có quyền apply config.', level=messages.ERROR)
            return

        target = queryset.order_by('-id').first()
        if not target:
            self.message_user(request, 'Không có version nào được chọn.', level=messages.WARNING)
            return

        preview = build_whale_config_runtime_preview(target.config_json, rollout_mode='now')
        _push_whale_config_preview_messages(self, request, preview)
        if preview.get('blocking_issues'):
            self.message_user(request, 'Apply bị chặn bởi integrity checks.', level=messages.ERROR)
            return

        before_status = target.status
        target.status = WhaleConfigVersion.StatusChoices.ACTIVE
        target.approved_by = request.user
        now = timezone.now()
        target.approved_at = now
        target.activated_at = now
        target.save(update_fields=['status', 'approved_by', 'approved_at', 'activated_at', 'updated_at'])

        WhaleConfigVersion.objects.exclude(pk=target.pk).filter(
            status=WhaleConfigVersion.StatusChoices.ACTIVE
        ).update(status=WhaleConfigVersion.StatusChoices.ARCHIVED, updated_at=now)

        rollout, propagation = initialize_whale_config_rollout(
            target,
            initiated_by=request.user,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            note='created_from_admin_apply',
        )

        _log_whale_config_audit(
            actor=request.user,
            action='apply',
            version=target,
            rollout=rollout,
            reason='approve_and_apply_from_admin',
            before_json={'status': before_status},
            after_json={
                'status': target.status,
                'diff_preview': preview.get('diff_items') or [],
                'dependency_check': (preview.get('dependency_summary') or {}).get('checks', {}),
                'propagation': propagation,
            },
        )

        self.message_user(request, f'Version {target.version_code} đã được kích hoạt.', level=messages.SUCCESS)
        self.message_user(request, f'Propagation: {propagation["summary"]}', level=messages.INFO)

    @admin.action(description='Mark selected versions as rolled back')
    def mark_as_rolled_back(self, request, queryset):
        if not _is_supervisor(request.user):
            self.message_user(request, 'Bạn không có quyền rollback.', level=messages.ERROR)
            return

        count = 0
        for version in queryset:
            before_status = version.status
            version.status = WhaleConfigVersion.StatusChoices.ROLLED_BACK
            version.save(update_fields=['status', 'updated_at'])
            count += 1

            _log_whale_config_audit(
                actor=request.user,
                action='rollback',
                version=version,
                reason='rollback_from_admin',
                before_json={'status': before_status},
                after_json={'status': version.status},
            )

        if count:
            self.message_user(request, f'Đã rollback {count} version.', level=messages.SUCCESS)
        else:
            self.message_user(request, 'Không có version nào để rollback.', level=messages.WARNING)


@admin.register(WhaleConfigRollout)
class WhaleConfigRolloutAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'version', 'mode', 'status', 'propagation_signal', 'anomaly_signal', 'ack_progress', 'initiated_by',
        'effective_from', 'started_at', 'finished_at',
    )
    list_filter = ('mode', 'status', 'initiated_by')
    search_fields = ('version__version_code', 'note')
    readonly_fields = ('propagation_signal', 'anomaly_signal', 'ack_progress', 'started_at', 'finished_at', 'created_at')

    def propagation_signal(self, obj):
        snapshot = build_rollout_propagation_snapshot(obj)
        return _render_signal_badge(snapshot['signal'], snapshot['summary'])

    propagation_signal.short_description = 'Signal'

    def anomaly_signal(self, obj):
        snapshot = build_whale_rollout_anomaly_snapshot(obj)
        signal = 'green' if snapshot['healthy'] else 'red'
        return _render_signal_badge(signal, snapshot['summary'])

    anomaly_signal.short_description = 'Anomaly'

    def ack_progress(self, obj):
        snapshot = build_rollout_propagation_snapshot(obj)
        return f"{snapshot['acked_count']}/{snapshot['expected_count']}"

    ack_progress.short_description = 'ACK progress'

    def has_view_permission(self, request, obj=None):
        return _is_analyst(request.user)

    def has_add_permission(self, request):
        return _is_supervisor(request.user)

    def has_change_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    def has_delete_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    def save_model(self, request, obj, form, change):
        preview = build_whale_config_runtime_preview(
            obj.version.config_json if obj.version_id else {},
            rollout_mode=obj.mode,
            canary_scope_json=obj.canary_scope_json,
            effective_from=obj.effective_from,
        )
        _push_whale_config_preview_messages(self, request, preview)
        if preview.get('blocking_issues'):
            self.message_user(request, 'Rollout bị chặn bởi integrity checks.', level=messages.ERROR)
            return

        if not obj.initiated_by_id:
            obj.initiated_by = request.user
        if change:
            super().save_model(request, obj, form, change)
        else:
            rollout, propagation = initialize_whale_config_rollout(
                obj.version,
                initiated_by=obj.initiated_by,
                mode=obj.mode,
                effective_from=obj.effective_from,
                canary_scope_json=obj.canary_scope_json,
                note=obj.note,
            )
            obj.pk = rollout.pk
            obj.status = rollout.status
            obj.started_at = rollout.started_at
            obj.finished_at = rollout.finished_at
            obj.created_at = rollout.created_at
            self.message_user(request, f'Propagation: {propagation["summary"]}', level=messages.INFO)


@admin.register(WhaleConfigWorkerAck)
class WhaleConfigWorkerAckAdmin(admin.ModelAdmin):
    list_display = ('id', 'rollout', 'worker_name', 'worker_version', 'ack_state', 'acked_at', 'created_at')
    list_filter = ('acked', 'rollout')
    search_fields = ('worker_name', 'worker_version', 'details')
    readonly_fields = ('created_at',)

    def ack_state(self, obj):
        if obj.acked and obj.worker_version == obj.rollout.version.version_code:
            return _render_signal_badge('green', 'acked')
        if obj.acked:
            return _render_signal_badge('amber', f'version={obj.worker_version or "unknown"}')
        return _render_signal_badge('red', 'awaiting_ack')

    ack_state.short_description = 'State'

    def has_view_permission(self, request, obj=None):
        return _is_analyst(request.user)

    def has_add_permission(self, request):
        return _is_supervisor(request.user)

    def has_change_permission(self, request, obj=None):
        return _is_supervisor(request.user)

    def has_delete_permission(self, request, obj=None):
        return _is_supervisor(request.user)


@admin.register(WhaleConfigAuditLog)
class WhaleConfigAuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'actor', 'action', 'draft', 'version', 'rollout', 'ticket_ref')
    list_filter = ('action', 'actor')
    search_fields = ('reason', 'ticket_ref', 'actor__username', 'draft__name', 'version__version_code')
    readonly_fields = (
        'actor',
        'action',
        'draft',
        'version',
        'rollout',
        'reason',
        'before_json',
        'after_json',
        'ticket_ref',
        'created_at',
    )

    def has_view_permission(self, request, obj=None):
        return _is_analyst(request.user)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StockProfileSyncLog)
class StockProfileSyncLogAdmin(admin.ModelAdmin):


    @admin.register(OrderFlowSignal)
    class OrderFlowSignalAdmin(admin.ModelAdmin):
        list_display = (
            'id', 'symbol', 'signal_type', 'strength', 'confidence',
            'tick_rate', 'small_order_ratio', 'created_at',
        )
        list_filter = ('signal_type', 'confidence', 'created_at')
        search_fields = ('symbol',)
        ordering = ('-created_at',)
        readonly_fields = (
            'symbol', 'signal_type', 'strength', 'confidence', 'tick_rate',
            'small_order_ratio', 'cvd_at_signal', 'price_at_signal',
            'window_seconds', 'components_json', 'created_at',
        )

        def has_add_permission(self, request):
            return False

        def has_change_permission(self, request, obj=None):
            return False

        def has_delete_permission(self, request, obj=None):
            return request.user.is_superuser
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
