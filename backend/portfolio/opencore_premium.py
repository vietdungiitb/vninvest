"""
OpenCore Premium Features & Indicators

Định nghĩa danh sách tính năng nâng cao (indicators, analysis, tools).
Xác định feature tier (free vs paid).
"""

from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class PremiumIndicator:
    """Premium indicator definition."""
    key: str
    name: str
    description: str
    category: str  # 'momentum', 'trend', 'volatility', 'correlation', etc.
    min_plan: str  # 'free', 'pro', 'enterprise'
    is_realtime: bool = False
    supports_alerts: bool = False
    api_weight: int = 1  # API quota cost


# Define all premium indicators
PREMIUM_INDICATORS: Dict[str, PremiumIndicator] = {
    # Free tier indicators
    'sma': PremiumIndicator(
        key='sma',
        name='Simple Moving Average',
        description='20, 50, 200-day moving average',
        category='trend',
        min_plan='free',
        is_realtime=True,
        supports_alerts=True,
        api_weight=1
    ),
    'rsi': PremiumIndicator(
        key='rsi',
        name='Relative Strength Index',
        description='14-period RSI',
        category='momentum',
        min_plan='free',
        is_realtime=True,
        api_weight=1
    ),
    'volume_profile': PremiumIndicator(
        key='volume_profile',
        name='Volume Profile',
        description='Trading volume by price level',
        category='volume',
        min_plan='free',
        api_weight=2
    ),
    
    # Pro tier indicators
    'whale_momentum': PremiumIndicator(
        key='whale_momentum',
        name='Whale Momentum Index',
        description='Large order flow momentum',
        category='momentum',
        min_plan='pro',
        is_realtime=True,
        supports_alerts=True,
        api_weight=3
    ),
    'dark_pool_flow': PremiumIndicator(
        key='dark_pool_flow',
        name='Dark Pool Flow Analysis',
        description='Order imbalance and dark pool activity',
        category='order_flow',
        min_plan='pro',
        is_realtime=True,
        supports_alerts=True,
        api_weight=5
    ),
    'correlation_matrix': PremiumIndicator(
        key='correlation_matrix',
        name='Stock Correlation Matrix',
        description='Cross-correlation with market, sectors, and peers',
        category='correlation',
        min_plan='pro',
        is_realtime=False,
        api_weight=2
    ),
    'volatility_surface': PremiumIndicator(
        key='volatility_surface',
        name='Volatility Surface Analysis',
        description='Term structure and skew analysis',
        category='volatility',
        min_plan='pro',
        api_weight=4
    ),
    'sentiment_score': PremiumIndicator(
        key='sentiment_score',
        name='AI Sentiment Score',
        description='News, social media, and analyst sentiment',
        category='sentiment',
        min_plan='pro',
        is_realtime=False,
        supports_alerts=True,
        api_weight=3
    ),
    
    # Enterprise tier indicators
    'predictive_ml': PremiumIndicator(
        key='predictive_ml',
        name='ML Price Prediction',
        description='Machine learning-based price forecasting',
        category='prediction',
        min_plan='enterprise',
        is_realtime=True,
        supports_alerts=True,
        api_weight=10
    ),
    'cross_market_alpha': PremiumIndicator(
        key='cross_market_alpha',
        name='Cross-Market Alpha Detection',
        description='Arbitrage and alpha opportunities across markets',
        category='arbitrage',
        min_plan='enterprise',
        api_weight=8
    ),
    'fund_flow_analysis': PremiumIndicator(
        key='fund_flow_analysis',
        name='Fund Flow Analysis',
        description='ETF, mutual fund inflow/outflow patterns',
        category='flow',
        min_plan='enterprise',
        api_weight=5
    ),
    'hedging_strategy': PremiumIndicator(
        key='hedging_strategy',
        name='AI Hedging Strategy Generator',
        description='Portfolio hedging optimization',
        category='portfolio',
        min_plan='enterprise',
        api_weight=7
    ),
}


class PremiumFeatureGate:
    """
    Feature gating based on license plan.
    """

    # ── Feature keys cho Sprint W6/I1/AI4 ────────────────────────────────────
    # Free: telegram_bot_community, preferred_symbols_crud
    # Pro+: whale_backtesting, sentiment_analysis, telegram_bot_full
    _FEATURE_PLAN_MAP = {
        'whale_backtesting':        'pro',
        'sentiment_analysis':       'pro',
        'telegram_bot_full':        'pro',   # Full symbol (no mask), unlimited alerts
        'telegram_bot_community':   'free',  # Market-wide alerts only
        'preferred_symbols_crud':   'free',  # Quản lý 3 mã quà tặng
    }

    _PLAN_HIERARCHY = {'free': 0, 'pro': 1, 'enterprise': 2}

    @staticmethod
    def _get_user_plan(user) -> str:
        """Lấy tên plan hiện tại của user từ DPILicense."""
        try:
            from portfolio.opencore_dpi import DPILicense
            lic = DPILicense.objects.filter(
                user=user, status='active'
            ).select_related('plan').order_by('-created_at').first()
            if lic:
                return str(lic.plan.name).lower()
        except Exception:
            pass
        return 'free'

    @classmethod
    def can_use_feature(cls, user, feature_key: str) -> bool:
        """
        Kiểm tra user có quyền dùng feature_key không.
        Dùng cho: whale_backtesting, sentiment_analysis, telegram_bot_full, v.v.
        """
        required_plan = cls._FEATURE_PLAN_MAP.get(feature_key, 'pro')
        if required_plan == 'free':
            return True
        user_plan = cls._get_user_plan(user)
        user_level = cls._PLAN_HIERARCHY.get(user_plan, 0)
        required_level = cls._PLAN_HIERARCHY.get(required_plan, 1)
        return user_level >= required_level

    @staticmethod
    def mask_symbol(symbol: str) -> str:
        """
        Băm mã CK cho user Free — định nghĩa tập trung tại đây.
        Quy tắc:
          len 1-2: 1 ký tự đầu + '*' * còn lại
          len 3-4: 1 ký tự đầu + '*' * còn lại
          len >= 5: 2 ký tự đầu + '*' * (len-4) + 2 ký tự cuối
        Ví dụ: VNM→V**, HP→H*, VN30F1M→VN***1M
        """
        s = str(symbol or '').upper().strip()
        n = len(s)
        if n <= 0:
            return s
        if n <= 4:
            return s[0] + '*' * (n - 1)
        return s[:2] + '*' * (n - 4) + s[-2:]

    @staticmethod
    def get_available_indicators(plan: str) -> List[str]:
        """Get indicator keys available for plan."""
        available = []
        for key, indicator in PREMIUM_INDICATORS.items():
            if indicator.min_plan in ['free', plan]:
                available.append(key)
        return available
    
    @staticmethod
    def get_indicator(key: str) -> Optional[PremiumIndicator]:
        """Get indicator definition."""
        return PREMIUM_INDICATORS.get(key)
    
    @staticmethod
    def can_calculate_indicator(user_plan: str, indicator_key: str) -> bool:
        """Check if user can calculate indicator."""
        indicator = PREMIUM_INDICATORS.get(indicator_key)
        if not indicator:
            return False
        
        # Plan hierarchy: free < pro < enterprise
        plan_hierarchy = {'free': 0, 'pro': 1, 'enterprise': 2}
        user_level = plan_hierarchy.get(user_plan, 0)
        required_level = plan_hierarchy.get(indicator.min_plan, 0)
        
        return user_level >= required_level
    
    @staticmethod
    def get_api_weight(indicator_key: str) -> int:
        """Get API weight (quota cost) for indicator."""
        indicator = PREMIUM_INDICATORS.get(indicator_key)
        return indicator.api_weight if indicator else 1


# Advanced features by plan
ADVANCED_FEATURES_BY_PLAN = {
    'free': {
        'description': 'Community Edition',
        'indicators': ['sma', 'rsi', 'volume_profile'],
        'max_watchlists': 5,
        'max_alerts': 10,
        'api_calls_per_day': 500,
        'ai_advisory': False,
        'whale_detection': False,
        'custom_alerts': False,
        'portfolio_sync': False,
        'team_workspace': False,
        'export_data': False,
        'sla_support': False,
    },
    'pro': {
        'description': 'Professional Trading',
        'indicators': ['sma', 'rsi', 'volume_profile', 'whale_momentum', 
                      'dark_pool_flow', 'correlation_matrix', 'volatility_surface', 'sentiment_score'],
        'max_watchlists': 50,
        'max_alerts': 100,
        'api_calls_per_day': 10000,
        'ai_advisory': True,
        'whale_detection': True,
        'custom_alerts': True,
        'portfolio_sync': True,
        'team_workspace': True,
        'export_data': True,
        'sla_support': False,
    },
    'enterprise': {
        'description': 'Enterprise Solutions',
        'indicators': list(PREMIUM_INDICATORS.keys()),
        'max_watchlists': 500,
        'max_alerts': 10000,
        'api_calls_per_day': 100000,
        'ai_advisory': True,
        'whale_detection': True,
        'custom_alerts': True,
        'portfolio_sync': True,
        'team_workspace': True,
        'export_data': True,
        'sla_support': True,
        'priority_processing': True,
        'custom_deployment': True,
    },
}


def get_plan_features(plan: str) -> Dict:
    """Get feature list for plan."""
    return ADVANCED_FEATURES_BY_PLAN.get(plan, ADVANCED_FEATURES_BY_PLAN['free'])
