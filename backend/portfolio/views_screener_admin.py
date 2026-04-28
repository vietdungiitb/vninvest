from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GlobalScreenerRule
from .models_screener_admin import ScreenerScheduleConfig
from .screener_helpers import _validate_screener_rules
from .tasks_global_screener import run_global_screener_manual_task


class ScreenerScheduleConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreenerScheduleConfig
        fields = ['id', 'cron_expression', 'is_user_custom_screener_enabled', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_cron_expression(self, value):
        normalized = str(value or '').strip()
        if not normalized:
            raise serializers.ValidationError('Biểu thức cron không được để trống.')
        if len(normalized) > 64:
            raise serializers.ValidationError('Biểu thức cron vượt quá độ dài cho phép.')
        return normalized


class GlobalScreenerRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalScreenerRule
        fields = ['id', 'name', 'rules_json', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        normalized = str(value or '').strip()
        if not normalized:
            raise serializers.ValidationError('Tên luật không được để trống.')
        return normalized

    def validate_rules_json(self, value):
        ok, err = _validate_screener_rules(value)
        if not ok:
            raise serializers.ValidationError(err)
        return value


def _get_schedule_config() -> ScreenerScheduleConfig:
    config = ScreenerScheduleConfig.objects.order_by('-updated_at', '-created_at', '-pk').first()
    if config is None:
        config = ScreenerScheduleConfig.objects.create()
    return config


class AdminScreenerConfigView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        config = _get_schedule_config()
        return Response(ScreenerScheduleConfigSerializer(config).data)

    def put(self, request):
        config = _get_schedule_config()
        serializer = ScreenerScheduleConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ScreenerScheduleConfigSerializer(config).data)


class AdminGlobalScreenerRuleListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        rules = GlobalScreenerRule.objects.order_by('-updated_at', '-created_at', '-pk')
        return Response(GlobalScreenerRuleSerializer(rules, many=True).data)

    def post(self, request):
        serializer = GlobalScreenerRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = serializer.save()
        return Response(GlobalScreenerRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class AdminGlobalScreenerRuleDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get_rule(self, rule_id: int) -> GlobalScreenerRule:
        return get_object_or_404(GlobalScreenerRule, pk=rule_id)

    def put(self, request, rule_id: int):
        rule = self._get_rule(rule_id)
        serializer = GlobalScreenerRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(GlobalScreenerRuleSerializer(rule).data)

    def delete(self, request, rule_id: int):
        rule = self._get_rule(rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminGlobalScreenerRunManualView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        async_result = run_global_screener_manual_task.apply_async(kwargs={}, countdown=0)
        return Response(
            {
                'status': 'queued',
                'message': 'Đã gửi lệnh quét nền thành công.',
                'task_id': getattr(async_result, 'id', None),
            },
            status=status.HTTP_202_ACCEPTED,
        )