from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime

from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from .domain_constants import WHALE_ALERT_DEFAULT_THRESHOLD_VND
from .models import GlobalScreenerRule, IntradayTick, OrderFlowSignal
from portfolio.market_data_service import MarketDataService
from portfolio.services import WhaleSignalEngine
from portfolio.screener_helpers import _apply_screener_condition, _screener_build_technical


class GlobalScreenerService:
    CACHE_KEY = 'global_screener_master_snapshot'
    CACHE_TTL_SECONDS = 3600
    HISTORY_LOOKBACK_DAYS = 70

    @staticmethod
    def _coerce_snapshot_date(raw_value) -> date | None:
        if raw_value is None:
            return None
        if isinstance(raw_value, datetime):
            return raw_value.date()
        if isinstance(raw_value, date):
            return raw_value

        text = str(raw_value).strip()
        if not text:
            return None

        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None

    @staticmethod
    def _empty_whale_summary(snapshot_date: date | None = None) -> dict:
        return {
            'date': snapshot_date.isoformat() if snapshot_date else None,
            'buy_value': 0.0,
            'sell_value': 0.0,
            'unknown_value': 0.0,
            'total_value': 0.0,
            'net_value': 0.0,
            'buy_pct': 0.0,
            'sell_pct': 0.0,
            'unknown_pct': 0.0,
            'trade_count': 0,
            'whale_value': 0.0,
            'shark_value': 0.0,
            'small_value': 0.0,
            'latest_at': None,
        }

    @staticmethod
    def _matched_value_from_price_volume(price_value: float, volume_value: float) -> float:
        multiplier = 1.0 if price_value >= 1000 else 1000.0
        return float(price_value or 0) * float(volume_value or 0) * multiplier

    @staticmethod
    def _empty_dark_flow_summary(snapshot_date: date | None = None) -> dict:
        return {
            'date': snapshot_date.isoformat() if snapshot_date else None,
            'strength': 0.0,
            'avg_strength': 0.0,
            'max_strength': 0.0,
            'signal_count': 0,
            'cvd': 0.0,
            'avg_cvd': 0.0,
            'latest_signal_type': None,
            'latest_severity': None,
            'latest_at': None,
        }

    @classmethod
    def _summarize_whale_ticks(cls, symbols: set[str], snapshot_date: date) -> dict[str, dict]:
        summaries = {symbol: cls._empty_whale_summary(snapshot_date) for symbol in symbols}
        if not summaries:
            return summaries

        tick_rows = (
            IntradayTick.objects
            .filter(symbol__in=symbols, trade_date=snapshot_date)
            .values('symbol', 'trade_time', 'price', 'volume', 'side', 'match_type', 'created_at')
            .order_by('symbol', 'trade_time', 'id')
        )

        for row in tick_rows:
            symbol = str(row.get('symbol') or '').strip().upper()
            if not symbol or symbol not in summaries:
                continue

            summary = summaries[symbol]
            price_value = float(row.get('price') or 0)
            volume_value = float(row.get('volume') or 0)
            matched_value = cls._matched_value_from_price_volume(price_value, volume_value)
            side_value = WhaleSignalEngine.classify_side(row.get('side') or row.get('match_type'))
            size_class = WhaleSignalEngine.classify_size(matched_value)
            event_at = row.get('created_at')

            summary['trade_count'] += 1
            summary['total_value'] += matched_value

            if side_value == 'buy':
                summary['buy_value'] += matched_value
            elif side_value == 'sell':
                summary['sell_value'] += matched_value
            else:
                summary['unknown_value'] += matched_value

            if size_class == 'shark':
                summary['shark_value'] += matched_value
            elif size_class == 'whale':
                summary['whale_value'] += matched_value
            else:
                summary['small_value'] += matched_value

            if event_at is not None and (summary['latest_at'] is None or event_at > summary['latest_at']):
                summary['latest_at'] = event_at

        for summary in summaries.values():
            total_value = float(summary['total_value'] or 0.0)
            buy_value = float(summary['buy_value'] or 0.0)
            sell_value = float(summary['sell_value'] or 0.0)
            unknown_value = float(summary['unknown_value'] or 0.0)
            summary['net_value'] = round(buy_value - sell_value, 2)
            summary['buy_pct'] = round((buy_value / total_value) * 100, 2) if total_value > 0 else 0.0
            summary['sell_pct'] = round((sell_value / total_value) * 100, 2) if total_value > 0 else 0.0
            summary['unknown_pct'] = round((unknown_value / total_value) * 100, 2) if total_value > 0 else 0.0
            summary['total_value'] = round(total_value, 2)
            summary['buy_value'] = round(buy_value, 2)
            summary['sell_value'] = round(sell_value, 2)
            summary['unknown_value'] = round(unknown_value, 2)
            summary['whale_value'] = round(float(summary['whale_value'] or 0.0), 2)
            summary['shark_value'] = round(float(summary['shark_value'] or 0.0), 2)
            summary['small_value'] = round(float(summary['small_value'] or 0.0), 2)

        return summaries

    @classmethod
    def _summarize_dark_flow_signals(cls, symbols: set[str], snapshot_date: date) -> dict[str, dict]:
        summaries = {symbol: cls._empty_dark_flow_summary(snapshot_date) for symbol in symbols}
        if not summaries:
            return summaries

        signal_rows = (
            OrderFlowSignal.objects
            .filter(symbol__in=symbols)
            .filter(Q(trade_date=snapshot_date) | Q(created_at__date=snapshot_date))
            .values('symbol', 'signal_type', 'strength', 'cvd_at_signal', 'severity', 'created_at')
            .order_by('symbol', 'created_at', 'id')
        )

        for row in signal_rows:
            symbol = str(row.get('symbol') or '').strip().upper()
            if not symbol or symbol not in summaries:
                continue

            summary = summaries[symbol]
            strength_value = float(row.get('strength') or 0.0)
            cvd_value = float(row.get('cvd_at_signal') or 0.0)
            event_at = row.get('created_at')

            summary['signal_count'] += 1
            summary['avg_strength'] += strength_value
            summary['avg_cvd'] += cvd_value
            summary['max_strength'] = max(float(summary['max_strength'] or 0.0), strength_value)

            if event_at is not None and (summary['latest_at'] is None or event_at > summary['latest_at']):
                summary['latest_at'] = event_at
                summary['strength'] = strength_value
                summary['cvd'] = cvd_value
                summary['latest_signal_type'] = row.get('signal_type')
                summary['latest_severity'] = row.get('severity')

        for summary in summaries.values():
            signal_count = int(summary['signal_count'] or 0)
            if signal_count > 0:
                summary['avg_strength'] = round(float(summary['avg_strength'] or 0.0) / signal_count, 2)
                summary['avg_cvd'] = round(float(summary['avg_cvd'] or 0.0) / signal_count, 2)
            else:
                summary['avg_strength'] = 0.0
                summary['avg_cvd'] = 0.0
            summary['strength'] = round(float(summary['strength'] or 0.0), 2)
            summary['cvd'] = round(float(summary['cvd'] or 0.0), 2)
            summary['max_strength'] = round(float(summary['max_strength'] or 0.0), 2)

        return summaries

    @classmethod
    def _build_flow_enrichment_map(cls, latest_rows_map: dict[str, dict]) -> dict[str, dict]:
        date_groups: dict[date, list[str]] = defaultdict(list)

        for symbol, latest_row in latest_rows_map.items():
            if not isinstance(latest_row, dict):
                continue

            snapshot_date = cls._coerce_snapshot_date(latest_row.get('date')) or timezone.localdate()
            normalized_symbol = str(symbol or '').strip().upper()
            if normalized_symbol:
                date_groups[snapshot_date].append(normalized_symbol)

        enrichment_map: dict[str, dict] = {}
        for snapshot_date, symbols in date_groups.items():
            symbol_set = {str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()}
            whale_summary_map = cls._summarize_whale_ticks(symbol_set, snapshot_date)
            dark_flow_summary_map = cls._summarize_dark_flow_signals(symbol_set, snapshot_date)

            for symbol in symbol_set:
                whale_summary = whale_summary_map.get(symbol, cls._empty_whale_summary(snapshot_date))
                dark_flow_summary = dark_flow_summary_map.get(symbol, cls._empty_dark_flow_summary(snapshot_date))

                whale_total_value = float(whale_summary.get('total_value') or 0.0)
                dark_flow_strength = float(dark_flow_summary.get('strength') or 0.0)
                whale_intensity = WhaleSignalEngine.calculate_whale_intensity(
                    whale_total_value,
                    WHALE_ALERT_DEFAULT_THRESHOLD_VND,
                    dark_flow_strength,
                )

                enrichment_map[symbol] = {
                    **{f'whale_{key}': value for key, value in whale_summary.items()},
                    **{f'dark_flow_{key}': value for key, value in dark_flow_summary.items()},
                    'whale_intensity': whale_intensity,
                    'flow_snapshot': {
                        'date': snapshot_date.isoformat(),
                        'whale': whale_summary,
                        'dark_flow': dark_flow_summary,
                        'whale_intensity': whale_intensity,
                    },
                }

        return enrichment_map

    @classmethod
    def precompute_market_snapshot(cls, symbols: list[str] | None = None) -> dict:
        universe_symbols = [str(symbol).strip().upper() for symbol in (symbols or []) if str(symbol).strip()] or MarketDataService.get_universe_symbols()
        latest_rows_map = MarketDataService.get_latest_snapshot(universe_symbols)

        if not latest_rows_map:
            snapshot = {
                'generated_at': timezone.now().isoformat(),
                'symbol_count': 0,
                'rows': [],
            }
            cache.set(cls.CACHE_KEY, snapshot, timeout=cls.CACHE_TTL_SECONDS)
            return snapshot

        history_map = MarketDataService.get_historical_indicators(
            universe_symbols,
            lookback_days=cls.HISTORY_LOOKBACK_DAYS,
            include_fields=['date', 'close_price', 'volume', 'high_price', 'low_price'],
        )
        flow_enrichment_map = cls._build_flow_enrichment_map(latest_rows_map)

        rows: list[dict] = []
        for symbol, latest_row in latest_rows_map.items():
            if not isinstance(latest_row, dict):
                continue

            tech = _screener_build_technical(symbol, {**latest_row, 'symbol': symbol}, history_map)
            flow_enrichment = flow_enrichment_map.get(symbol, {})
            row = {
                'symbol': symbol,
                'date': str(latest_row.get('date')) if latest_row.get('date') is not None else None,
                **latest_row,
                **tech,
                **flow_enrichment,
            }
            rows.append(row)

        snapshot = {
            'generated_at': timezone.now().isoformat(),
            'symbol_count': len(rows),
            'rows': rows,
        }
        cache.set(cls.CACHE_KEY, snapshot, timeout=cls.CACHE_TTL_SECONDS)
        return snapshot

    @classmethod
    def match_active_rules(cls, snapshot: dict | None = None) -> list[str]:
        cached_snapshot = snapshot if snapshot is not None else cache.get(cls.CACHE_KEY) or {}
        rows = cached_snapshot.get('rows') if isinstance(cached_snapshot, dict) else []
        if not isinstance(rows, list) or not rows:
            return []

        matched_symbols: set[str] = set()
        active_rules = GlobalScreenerRule.objects.filter(is_active=True).order_by('-updated_at', '-created_at')

        for rule in active_rules:
            conditions = rule.rules_json if isinstance(rule.rules_json, list) else []
            if not conditions:
                continue

            for row in rows:
                if not isinstance(row, dict):
                    continue

                if all(_apply_screener_condition(row.get(condition.get('field')), condition.get('op'), condition.get('value')) for condition in conditions):
                    symbol = str(row.get('symbol') or '').strip().upper()
                    if symbol:
                        matched_symbols.add(symbol)

        return sorted(matched_symbols)
