"""
Co-observation Service for Dark Money Flow + Whale Campaign Analysis
Correlates whale campaigns with dark flow signals on same timeline

Used in: Symbol investigation endpoint for trader analysis
"""

from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import math
import pytz
from django.utils import timezone
from portfolio.models import OrderFlowSignal


class TimeWindowResolver:
    """Resolve UI window parameter (session, 5m, etc) to absolute time bounds"""
    
    @staticmethod
    def get_bounds(window: str, reference_time: datetime = None) -> Tuple[datetime, datetime]:
        """Resolve time bounds for window parameter"""
        if reference_time is None:
            reference_time = timezone.now()
        
        if reference_time.tzinfo is None:
            reference_time = timezone.make_aware(reference_time, timezone.utc)
        
        if window == 'session':
            vn_tz = pytz.timezone('Asia/Ho_Chi_Minh')
            ref_vn = reference_time.astimezone(vn_tz)
            session_start = ref_vn.replace(hour=9, minute=0, second=0, microsecond=0)
            session_end = ref_vn.replace(hour=15, minute=0, second=0, microsecond=0)
            
            if ref_vn.hour < 9:
                session_start -= timedelta(days=1)
                session_end -= timedelta(days=1)
            
            return session_start.astimezone(timezone.utc), session_end.astimezone(timezone.utc)
        elif window == '5m':
            start = reference_time - timedelta(minutes=5)
            return start, reference_time
        elif window == '15m':
            start = reference_time - timedelta(minutes=15)
            return start, reference_time
        elif window == '1h':
            start = reference_time - timedelta(hours=1)
            return start, reference_time
        elif window == '5d':
            start = reference_time - timedelta(days=5)
            return start, reference_time
        else:
            raise ValueError(f"Invalid window: {window}")


class CorrelationOptimizer:
    """Calculate correlation confidence between whale campaigns and dark signals"""
    
    CORRELATION_MIN_THRESHOLD = 0.5
    
    @staticmethod
    def calculate_confidence(
        campaign_time: datetime,
        signal_time: datetime,
        campaign_side: str,
        signal_type: str,
        campaign_strength: float,
        signal_strength: float
    ) -> Tuple[float, str]:
        """Score correlation confidence 0.0-1.0"""
        
        time_diff = abs((signal_time - campaign_time).total_seconds())
        time_factor = math.exp(-time_diff / 120.0)  # 2-minute half-life
        
        side_alignments = {
            ('BUY', 'absorption'): 0.95,
            ('BUY', 'iceberg'): 0.55,
            ('BUY', 'twap_bot'): 0.70,
            ('SELL', 'absorption'): 0.60,
            ('SELL', 'iceberg'): 0.90,
            ('SELL', 'twap_bot'): 0.75,
            ('MIXED', 'absorption'): 0.65,
            ('MIXED', 'iceberg'): 0.65,
            ('MIXED', 'twap_bot'): 0.65,
        }
        side_factor = side_alignments.get((campaign_side, signal_type), 0.45)
        
        avg_strength = (campaign_strength + signal_strength) / 2.0
        min_strength = min(campaign_strength, signal_strength)
        
        if min_strength < 30:
            strength_factor = 0.5
        elif min_strength > 70:
            strength_factor = 0.9
        else:
            strength_factor = 0.5 + (avg_strength - 50) / 100.0
        
        confidence = 0.40 * time_factor + 0.40 * side_factor + 0.20 * strength_factor
        reason = f"time={time_factor:.2f}|side={side_factor:.2f}|strength={strength_factor:.2f}"
        
        return round(confidence, 3), reason


class CoObservationService:
    """Main service for co-observing whale campaigns + dark flow signals"""
    
    def __init__(self):
        self.correlation_tracker = {}
    
    def get_symbol_investigation(
        self,
        symbol: str,
        window: str = 'session',
        include_whale: bool = True,
        include_dark_flow: bool = True,
        sort: str = 'created_at',
        user=None,
        query_params: Optional[Dict] = None,
    ) -> Dict:
        """Main entry point for symbol investigation"""
        
        server_time = timezone.now()
        start_time, end_time = TimeWindowResolver.get_bounds(window, server_time)
        
        window_params = {
            'window': window,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        }
        
        campaigns = []
        if include_whale:
            from portfolio.market_data_service import MarketDataService
            service = MarketDataService()
            campaign_query = {
                'window': window,
                'campaign_limit': '100',
                'limit': '50',
                'sort': 'ts',
            }
            if query_params:
                campaign_query.update({k: v for k, v in query_params.items() if v is not None})
            payload = service.get_whale_campaigns(user=user, query_params=campaign_query)
            all_campaigns = payload.get('results') or []
            campaigns = [item for item in all_campaigns if (item.get('symbol') or '').upper() == symbol.upper()]
            campaigns = self._filter_campaigns_by_time(campaigns, start_time, end_time)
        
        dark_signals = []
        if include_dark_flow:
            dark_signals = self._get_dark_signals(symbol, start_time, end_time)
        
        correlations = self._correlate_campaigns_and_signals(campaigns, dark_signals)
        campaigns = self._enrich_campaigns_with_correlations(campaigns, correlations)
        dark_signals = self._enrich_signals_with_correlations(dark_signals, correlations)
        campaigns, dark_signals = self._apply_sort(campaigns, dark_signals, sort)
        timeline = self._build_investigation_timeline(campaigns, dark_signals, correlations)
        grouped_timeline = self._build_timeline_groups(campaigns, dark_signals)
        conviction = self._assess_conviction(campaigns, dark_signals, correlations)

        correlated_campaigns = self._normalize_campaigns_for_investigation(campaigns)
        correlated_signals = self._normalize_signals_for_investigation(dark_signals)
        
        return {
            'symbol': symbol,
            'server_time': server_time.isoformat(),
            'window_params': window_params,
            'whale_campaigns': campaigns,
            'dark_flow_signals': dark_signals,
            # Compatibility payload for Symbol Investigation panel.
            'correlated_campaigns': correlated_campaigns,
            'correlated_signals': correlated_signals,
            'co_observation_summary': conviction,
            'timeline': timeline,
            'grouped_timeline': grouped_timeline,
        }

    @staticmethod
    def _to_dt(value):
        if not value:
            return datetime.min.replace(tzinfo=pytz.UTC)
        try:
            parsed = timezone.datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                return timezone.make_aware(parsed, timezone.utc)
            return parsed
        except Exception:
            return datetime.min.replace(tzinfo=pytz.UTC)

    @staticmethod
    def _max_corr(items: List[Dict], key: str) -> float:
        values = [float(item.get(key, 0.0) or 0.0) for item in items]
        return max(values) if values else 0.0

    def _apply_sort(self, campaigns: List[Dict], dark_signals: List[Dict], sort: str) -> Tuple[List[Dict], List[Dict]]:
        """Sort output collections according to requested strategy."""
        if sort == 'correlation_strength':
            campaigns = sorted(
                campaigns,
                key=lambda item: (
                    self._max_corr(item.get('dark_flow_correlations') or [], 'correlation_confidence'),
                    self._to_dt(item.get('created_at')),
                ),
                reverse=True,
            )
            dark_signals = sorted(
                dark_signals,
                key=lambda item: (
                    self._max_corr(item.get('whale_campaign_correlations') or [], 'correlation_confidence'),
                    self._to_dt(item.get('created_at')),
                ),
                reverse=True,
            )
            return campaigns, dark_signals

        # Default strategy is newest first.
        campaigns = sorted(campaigns, key=lambda item: self._to_dt(item.get('created_at')), reverse=True)
        dark_signals = sorted(dark_signals, key=lambda item: self._to_dt(item.get('created_at')), reverse=True)
        return campaigns, dark_signals
    
    @staticmethod
    def _filter_campaigns_by_time(campaigns: List[Dict], start_time, end_time) -> List[Dict]:
        """Filter campaigns to those with activity in time window"""
        filtered = []
        for campaign in campaigns:
            try:
                created = timezone.datetime.fromisoformat(campaign.get('created_at', ''))
                last_event = timezone.datetime.fromisoformat(campaign.get('last_event_at', ''))
                if created <= end_time and last_event >= start_time:
                    filtered.append(campaign)
            except:
                filtered.append(campaign)
        return filtered
    
    @staticmethod
    def _get_dark_signals(symbol: str, start_time, end_time) -> List[Dict]:
        """Fetch dark flow signals from database"""
        signals = OrderFlowSignal.objects.filter(
            symbol=symbol,
            created_at__gte=start_time,
            created_at__lte=end_time,
            signal_type__in=['absorption', 'iceberg', 'twap_bot', 'mixed']
        ).order_by('-created_at')
        
        result = []
        for sig in signals:
            result.append({
                'id': sig.id,
                'symbol': sig.symbol,
                'event_id': sig.event_id,
                'signal_type': sig.signal_type,
                'severity': sig.severity,
                'strength': sig.strength,
                'confidence': sig.confidence,
                'created_at': sig.created_at.isoformat(),
                'matched_value': sig.components_json.get('matched_value', 0)
            })
        
        return result
    
    def _correlate_campaigns_and_signals(self, campaigns: List[Dict], signals: List[Dict]) -> Dict:
        """Correlate campaigns with signals based on time and side alignment"""
        correlations = {}
        
        for campaign in campaigns:
            campaign_id = campaign.get('campaign_id')
            campaign_side = campaign.get('side_bias', 'MIXED').upper()
            campaign_strength = campaign.get('campaign_strength', 50)
            
            try:
                campaign_time = timezone.datetime.fromisoformat(campaign.get('created_at', ''))
            except:
                campaign_time = timezone.now()
            
            matching_signals = []
            
            for signal in signals:
                try:
                    signal_time = timezone.datetime.fromisoformat(signal.get('created_at', ''))
                except:
                    signal_time = timezone.now()
                
                time_diff = abs((signal_time - campaign_time).total_seconds())
                
                if time_diff <= 300:
                    confidence, reason = CorrelationOptimizer.calculate_confidence(
                        campaign_time=campaign_time,
                        signal_time=signal_time,
                        campaign_side=campaign_side,
                        signal_type=signal.get('signal_type', 'mixed'),
                        campaign_strength=campaign_strength,
                        signal_strength=signal.get('strength', 50)
                    )
                    
                    if confidence >= CorrelationOptimizer.CORRELATION_MIN_THRESHOLD:
                        matching_signals.append({
                            'event_id': signal.get('event_id'),
                            'signal_type': signal.get('signal_type'),
                            'time_diff_seconds': int(time_diff),
                            'correlation_confidence': confidence,
                            'reason': reason,
                            'severity': signal.get('severity')
                        })
            
            if matching_signals:
                matching_signals.sort(key=lambda x: x['correlation_confidence'], reverse=True)
                correlations[campaign_id] = matching_signals
        
        self.correlation_tracker = {
            'campaign_to_signals': correlations,
            'signal_to_campaigns': self._reverse_correlations(correlations)
        }
        
        return correlations
    
    @staticmethod
    def _reverse_correlations(campaign_correlations: Dict) -> Dict:
        """Reverse mapping: event_id -> list of correlated campaigns"""
        reverse = {}
        for campaign_id, signals in campaign_correlations.items():
            for sig in signals:
                event_id = sig['event_id']
                if event_id not in reverse:
                    reverse[event_id] = []
                reverse[event_id].append({
                    'campaign_id': campaign_id,
                    'time_diff_seconds': sig['time_diff_seconds'],
                    'correlation_confidence': sig['correlation_confidence']
                })
        return reverse
    
    def _enrich_campaigns_with_correlations(self, campaigns: List[Dict], correlations: Dict) -> List[Dict]:
        """Add dark flow correlations to each campaign"""
        result = []
        for campaign in campaigns:
            campaign_id = campaign.get('campaign_id')
            campaign['dark_flow_correlations'] = correlations.get(campaign_id, [])
            result.append(campaign)
        return result
    
    def _enrich_signals_with_correlations(self, signals: List[Dict], correlations: Dict = None) -> List[Dict]:
        """Add whale campaign correlations to each signal"""
        if correlations is None:
            correlations = self.correlation_tracker.get('signal_to_campaigns', {})
        
        result = []
        for signal in signals:
            event_id = signal.get('event_id')
            signal['whale_campaign_correlations'] = correlations.get(event_id, [])
            result.append(signal)
        return result
    
    def _build_investigation_timeline(self, campaigns: List[Dict], signals: List[Dict], correlations: Dict) -> List[Dict]:
        """Build chronological timeline of all events"""
        events = []
        
        for campaign in campaigns:
            events.append({
                'timestamp': campaign.get('created_at'),
                'event_type': 'whale_campaign_start',
                'event_id': campaign.get('campaign_id'),
                'symbol': campaign.get('symbol'),
                'side': campaign.get('side_bias'),
                'strength': campaign.get('campaign_strength'),
                'description': f"{campaign.get('side_bias', '').title()} whale campaign",
                'is_correlated': campaign.get('campaign_id') in correlations
            })
        
        for signal in signals:
            reverse_map = self.correlation_tracker.get('signal_to_campaigns', {})
            events.append({
                'timestamp': signal.get('created_at'),
                'event_type': 'dark_flow_signal',
                'event_id': signal.get('event_id'),
                'signal_type': signal.get('signal_type'),
                'strength': signal.get('strength'),
                'severity': signal.get('severity'),
                'description': f"{signal.get('signal_type', 'unknown').upper()} signal",
                'is_correlated': signal.get('event_id') in reverse_map
            })
        
        events.sort(key=lambda x: x.get('timestamp', ''))
        return events

    def _build_timeline_groups(self, campaigns: List[Dict], signals: List[Dict], bucket_minutes: int = 5) -> List[Dict]:
        """Group whale campaigns + dark signals into time buckets for co-observation scanning."""
        bucket_seconds = max(int(bucket_minutes), 1) * 60
        grouped = {}

        def _bucket_start(ts_value: str) -> Optional[datetime]:
            try:
                ts = timezone.datetime.fromisoformat(str(ts_value).replace('Z', '+00:00'))
                if ts.tzinfo is None:
                    ts = timezone.make_aware(ts, timezone.utc)
                epoch = int(ts.timestamp())
                aligned = epoch - (epoch % bucket_seconds)
                return datetime.fromtimestamp(aligned, tz=timezone.utc)
            except Exception:
                return None

        for campaign in campaigns:
            start = _bucket_start(campaign.get('created_at'))
            if start is None:
                continue
            key = start.isoformat()
            grouped.setdefault(key, {
                'group_start': key,
                'group_end': (start + timedelta(seconds=bucket_seconds)).isoformat(),
                'whale_campaigns': [],
                'dark_flow_signals': [],
            })
            grouped[key]['whale_campaigns'].append({
                'campaign_id': campaign.get('campaign_id'),
                'symbol': campaign.get('symbol'),
                'side': campaign.get('side_bias'),
                'strength': campaign.get('campaign_strength'),
                'created_at': campaign.get('created_at'),
            })

        for signal in signals:
            start = _bucket_start(signal.get('created_at'))
            if start is None:
                continue
            key = start.isoformat()
            grouped.setdefault(key, {
                'group_start': key,
                'group_end': (start + timedelta(seconds=bucket_seconds)).isoformat(),
                'whale_campaigns': [],
                'dark_flow_signals': [],
            })
            grouped[key]['dark_flow_signals'].append({
                'signal_id': signal.get('id'),
                'event_id': signal.get('event_id'),
                'signal_type': signal.get('signal_type'),
                'strength': signal.get('strength'),
                'created_at': signal.get('created_at'),
            })

        groups = sorted(grouped.values(), key=lambda item: item.get('group_start') or '', reverse=True)
        for item in groups:
            item['has_co_observation'] = bool(item['whale_campaigns'] and item['dark_flow_signals'])
        return groups

    @staticmethod
    def _normalize_campaigns_for_investigation(campaigns: List[Dict]) -> List[Dict]:
        normalized = []
        for item in campaigns:
            normalized.append({
                'event_id': item.get('campaign_id'),
                'campaign_id': item.get('campaign_id'),
                'symbol': item.get('symbol'),
                'side': item.get('side_bias') or 'MIXED',
                'matched_value': float(item.get('total_matched_value') or 0.0),
                'campaign_strength': float(item.get('campaign_strength') or 0.0),
                'created_at': item.get('created_at'),
                'last_event_at': item.get('last_event_at'),
            })
        return normalized

    @staticmethod
    def _normalize_signals_for_investigation(signals: List[Dict]) -> List[Dict]:
        normalized = []
        for item in signals:
            normalized.append({
                'signal_id': item.get('id'),
                'event_id': item.get('event_id'),
                'signal_type': item.get('signal_type'),
                'strength': float(item.get('strength') or 0.0),
                'confidence': item.get('confidence'),
                'severity': item.get('severity'),
                'created_at': item.get('created_at'),
            })
        return normalized
    
    def _assess_conviction(self, campaigns: List[Dict], signals: List[Dict], correlations: Dict) -> Dict:
        """Assess overall conviction level"""
        total_correlations = sum(len(v) for v in correlations.values())
        high_confidence_count = sum(
            1 for v in correlations.values()
            for item in v if item.get('correlation_confidence', 0) > 0.75
        )
        
        if high_confidence_count >= 2:
            conviction = 'HIGH'
            reason = f"{high_confidence_count} high-confidence correlations detected"
        elif total_correlations > 0:
            conviction = 'MEDIUM'
            reason = f"{total_correlations} correlation{'s' if total_correlations > 1 else ''} detected"
        else:
            conviction = 'LOW'
            reason = "No correlated signals detected"
        
        return {
            'total_whale_campaigns': len(campaigns),
            'total_dark_signals': len(signals),
            'correlated_pairs': total_correlations,
            'high_confidence_pairs': high_confidence_count,
            'overall_conviction': conviction,
            'conviction_reason': reason
        }


def get_symbol_investigation(symbol: str, window: str = 'session') -> Dict:
    """Quick entry point for symbol investigation"""
    service = CoObservationService()
    return service.get_symbol_investigation(symbol, window)
