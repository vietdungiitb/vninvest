from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DailyPrice, ScreenerRule
from .screener_helpers import _apply_screener_condition, _screener_build_technical, _validate_screener_rules
from .serializers import ScreenerRuleSerializer


class ScreenerRuleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rules = ScreenerRule.objects.filter(user=request.user)
        return Response(ScreenerRuleSerializer(rules, many=True).data)

    def post(self, request):
        serializer = ScreenerRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        ok, err = _validate_screener_rules(serializer.validated_data.get('rules_json', []))
        if not ok:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save(user=request.user)
        return Response(ScreenerRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class ScreenerRuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_rule(self, request, rule_id):
        return generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)

    def get(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        return Response(ScreenerRuleSerializer(rule).data)

    def put(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        serializer = ScreenerRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if 'rules_json' in serializer.validated_data:
            ok, err = _validate_screener_rules(serializer.validated_data['rules_json'])
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save()
        return Response(ScreenerRuleSerializer(rule).data)

    def delete(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScreenerRuleRunView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, rule_id):
        from .market_data_service import MarketDataService
        rule = generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)
        conditions = rule.rules_json

        # 1. Lấy toàn bộ symbols có dữ liệu (SSOT)
        all_symbols = MarketDataService.get_universe_symbols()

        if not all_symbols:
            return Response({'matched': [], 'total_scanned': 0, 'rule_id': rule.id})

        # 2. Fetch snapshot (Latest Price)
        # MarketDataService handles chunking and caching internally if optimized, 
        # or we just use it as the unified access point.
        latest_rows_map = MarketDataService.get_latest_snapshot(all_symbols)

        required_fields = {cond['field'] for cond in conditions}
        needs_history = required_fields & {
            'rsi_14', 'sma20', 'sma50', 'momentum_20d_pct', 
            'price_vs_sma20_pct', 'price_vs_sma50_pct', 'range_position_pct',
            'avg_volume_20', 'macd_hist', 'volume_rvol', 'sma20_vs_sma50_pct',
        }

        # 3. Fetch history if needed
        history_map = {}
        if needs_history:
            # Screener typically needs ~50-70 rows for MA/RSI
            history_map = MarketDataService.get_historical_indicators(
                all_symbols,
                lookback_days=70,
                include_fields=['date', 'close_price', 'volume', 'high_price', 'low_price']
            )

        matched = []
        rows_to_scan = latest_rows_map.values()
        total_scanned = len(rows_to_scan)
        
        for row in rows_to_scan:
            sym = row.get('symbol') or next((s for s, r in latest_rows_map.items() if r == row), None)
            if not sym: continue
            
            # Adapting snapshot format
            adapter_row = {**row, 'symbol': sym}
            tech = _screener_build_technical(sym, adapter_row, history_map)
            
            if all(_apply_screener_condition(tech.get(c['field']), c['op'], c['value']) for c in conditions):
                matched.append(
                    {
                        'symbol': sym,
                        'date': str(row['date']),
                        **tech,
                    }
                )

        matched = []
        total_scanned = len(rows)
        for row in rows:
            sym = row['symbol']
            tech = _screener_build_technical(sym, row, history_map)
            if all(_apply_screener_condition(tech.get(c['field']), c['op'], c['value']) for c in conditions):
                matched.append(
                    {
                        'symbol': sym,
                        'date': str(row['date']),
                        **tech,
                    }
                )

        matched.sort(key=lambda x: x.get('close') or 0, reverse=True)

        return Response(
            {
                'rule_id': rule.id,
                'rule_name': rule.name,
                'total_scanned': total_scanned,
                'matched_count': len(matched),
                'matched': matched,
            }
        )
