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
        rule = generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)
        conditions = rule.rules_json

        from django.db.models import Max, Q
        latest_dates = DailyPrice.objects.values('symbol').annotate(latest=Max('date'))
        symbol_date_map = {row['symbol']: row['latest'] for row in latest_dates}

        if not symbol_date_map:
            return Response({'matched': [], 'total_scanned': 0, 'rule_id': rule.id})

        all_symbols = list(symbol_date_map.keys())
        rows = []
        chunk_size = 500
        for i in range(0, len(all_symbols), chunk_size):
            chunk_syms = all_symbols[i:i + chunk_size]
            chunk_q = Q()
            for sym in chunk_syms:
                chunk_q |= Q(symbol=sym, date=symbol_date_map[sym])
            rows.extend(
                DailyPrice.objects.filter(chunk_q).values(
                    'symbol', 'close_price', 'volume', 'open_price', 'high_price', 'low_price', 'date'
                )
            )

        required_fields = {cond['field'] for cond in conditions}
        needs_history = required_fields & {
            'rsi_14',
            'sma20',
            'sma50',
            'momentum_20d_pct',
            'price_vs_sma20_pct',
            'price_vs_sma50_pct',
            'range_position_pct',
            'avg_volume_20',
            'macd_hist',
            'volume_rvol',
            'sma20_vs_sma50_pct',
        }

        history_map = {}
        if needs_history:
            from datetime import date as date_cls, timedelta

            cutoff = date_cls.today() - timedelta(days=70)
            hist_qs = (
                DailyPrice.objects
                .filter(symbol__in=all_symbols, date__gte=cutoff)
                .values('symbol', 'date', 'close_price', 'volume', 'high_price', 'low_price')
                .order_by('symbol', 'date')
            )
            for row in hist_qs:
                sym = row['symbol']
                if sym not in history_map:
                    history_map[sym] = []
                history_map[sym].append(row)

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
