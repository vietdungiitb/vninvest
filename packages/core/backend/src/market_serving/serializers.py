from rest_framework import serializers

from .models import SessionFacts, SymbolSnapshot


class SymbolSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = SymbolSnapshot
        fields = [
            'symbol', 'session_date', 'price', 'price_change', 'price_change_pct',
            'volume', 'market_status', 'source', 'stale', 'fetched_at',
        ]


class SessionFactsSerializer(serializers.ModelSerializer):
    """
    OpenAPI SSOT cho SessionFacts — CVD + Strength chuẩn quốc tế.

    Trường bổ sung (computed, không lưu DB):
      delta_strength_pct  — (whale_net_flow / total) × 100
                            >10–15 % = aggressive imbalance
    """
    delta_strength_pct = serializers.SerializerMethodField(
        help_text='(whale_net_flow / total_value) × 100. Ngưỡng >10% = áp đảo một chiều.'
    )

    def get_delta_strength_pct(self, obj):
        total = (obj.total_buy_volume or 0) + (obj.total_sell_volume or 0)
        if total == 0:
            return 0.0
        return round((obj.whale_net_flow or 0) / total * 100.0, 4)

    class Meta:
        model = SessionFacts
        fields = [
            'symbol', 'session_date',
            # CVD (chuẩn quốc tế)
            'cvd_normalized',          # 0–100, 50 = trung tính
            'delta_strength_pct',      # (net_cvd/total)×100  [computed]
            # Strength
            'buy_strength',            # 0–99.5, sigmoid
            'institutional_strength',  # 0–99.5, sigmoid whale-weighted
            # Flow
            'whale_net_flow',          # VNĐ, dương = mua ròng
            'dark_flow_score',         # 0–100, absorption proxy
            # Volume aggregates
            'total_buy_volume',        # VNĐ
            'total_sell_volume',       # VNĐ
            # Meta
            'source', 'stale', 'computed_at',
        ]
