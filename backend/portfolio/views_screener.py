from django.core.cache import cache
from django.core.exceptions import PermissionDenied
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ScreenerRule
from .models_screener_admin import ScreenerScheduleConfig
from .screener_helpers import _apply_screener_condition, _validate_screener_rules
from .serializers import ScreenerRuleSerializer
from .services_global_screener import GlobalScreenerService


def _extract_master_snapshot_rows(snapshot):
    if snapshot is None:
        return []

    if isinstance(snapshot, list):
        rows = snapshot
    elif isinstance(snapshot, dict):
        rows = snapshot.get('rows') or snapshot.get('data') or snapshot.get('symbols') or []
    else:
        rows = []

    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def _build_cached_match_payload(row, conditions):
    if not all(_apply_screener_condition(row.get(cond['field']), cond['op'], cond['value']) for cond in conditions):
        return None

    symbol = str(row.get('symbol') or '').strip().upper()
    if not symbol:
        return None

    payload = dict(row)
    payload['symbol'] = symbol
    if 'date' not in payload and row.get('trade_date') is not None:
        payload['date'] = str(row.get('trade_date'))
    elif 'date' in payload and payload['date'] is not None:
        payload['date'] = str(payload['date'])
    return payload


def _build_response_from_cached_snapshot(snapshot_rows, conditions, rule):
    matched = []
    for row in snapshot_rows:
        payload = _build_cached_match_payload(row, conditions)
        if payload is not None:
            matched.append(payload)

    matched.sort(key=lambda item: item.get('close') or item.get('close_price') or 0, reverse=True)

    return Response(
        {
            'rule_id': rule.id,
            'rule_name': rule.name,
            'total_scanned': len(snapshot_rows),
            'matched_count': len(matched),
            'matched': matched,
        }
    )


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
        schedule_config = ScreenerScheduleConfig.objects.first()
        if schedule_config is not None and not schedule_config.is_user_custom_screener_enabled:
            raise PermissionDenied('Screener người dùng đang tạm tắt để bảo trì.')

        rule = generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)
        conditions = rule.rules_json

        cached_snapshot = cache.get(GlobalScreenerService.CACHE_KEY)
        if cached_snapshot is None:
            cached_snapshot = GlobalScreenerService.precompute_market_snapshot()

        cached_rows = _extract_master_snapshot_rows(cached_snapshot)
        return _build_response_from_cached_snapshot(cached_rows, conditions, rule)
