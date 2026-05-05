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
    class Meta:
        model = SessionFacts
        fields = [
            'symbol', 'session_date',
            'cvd_normalized', 'buy_strength', 'institutional_strength',
            'whale_net_flow', 'dark_flow_score',
            'total_buy_volume', 'total_sell_volume',
            'source', 'stale', 'computed_at',
        ]
