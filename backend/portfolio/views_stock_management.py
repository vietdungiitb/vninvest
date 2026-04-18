from decimal import Decimal

from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_price_changes, sync_market_groups_for_user, sync_watchlist_prices
from .models import PriceAlertRule, SecuritiesGroup, TrackedSymbol, StockProfile
from .serializers import PriceAlertRuleSerializer, TrackedSymbolSerializer
from .view_helpers import _build_group_response, _build_price_alert_rule_row
from .views_portfolio_watchlist import _acquire_sync_cooldown


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesGroupListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = SecuritiesGroup.objects.all().prefetch_related('items')

        all_symbols = list({
            item.symbol
            for group in groups
            for item in group.items.all()
        })
        price_map = get_price_changes(all_symbols)

        data = [_build_group_response(g, price_map) for g in groups]
        return Response(data)

    def post(self, request):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesGroupDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, group_id):
        return generics.get_object_or_404(SecuritiesGroup, pk=group_id)

    def patch(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def delete(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesSeedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mode = request.query_params.get('mode', 'all')
        result = sync_market_groups_for_user(request.user, requested_by=request.user, mode=mode)
        response_status = status.HTTP_200_OK if result['success'] and not result['warning'] else status.HTTP_207_MULTI_STATUS
        if not result['success']:
            response_status = status.HTTP_500_INTERNAL_SERVER_ERROR

        return Response(
            {
                'created': result.get('created', []),
                'updated': result.get('updated', []),
                'message': result['message'],
                'warning': result.get('warning'),
                'source': result.get('source'),
                'total_groups': result.get('total_groups', 0),
                'success': result['success'],
            },
            status=response_status,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            days = int(request.data.get('days', 5))
            days = min(max(days, 1), 30)
        except (ValueError, TypeError):
            days = 5

        acquired, retry_after_seconds = _acquire_sync_cooldown(request.user, action='securities-sync')
        if not acquired:
            return Response(
                {
                    'detail': 'Bạn thao tác quá nhanh. Vui lòng đợi trước khi đồng bộ lại.',
                    'retry_after_seconds': retry_after_seconds,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        include_global_groups = bool(request.user.is_staff)
        results = sync_watchlist_prices(
            request.user.id,
            days=days,
            include_global_groups=include_global_groups,
        )
        if not results:
            return Response({'detail': 'Không có mã để đồng bộ trong phạm vi hiện tại.'}, status=status.HTTP_200_OK)

        return Response({
            'synced': results,
            'total_symbols': len(results),
            'scope': 'global+user' if include_global_groups else 'user-only',
        })


def _parse_tracked_symbol_threshold_million(raw_value):
    if raw_value in (None, ''):
        return None
    try:
        resolved = float(raw_value)
    except (TypeError, ValueError):
        raise ValueError('Ngưỡng whale riêng phải là số >= 1 (triệu VNĐ).')
    if resolved < 1:
        raise ValueError('Ngưỡng whale riêng phải là số >= 1 (triệu VNĐ).')
    return Decimal(str(resolved))


class TrackedSymbolListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _enrich(self, ts):
        changes = get_price_changes([ts.symbol])
        info = changes.get(ts.symbol, {})
        grp = ts.source_group
        return {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
            'updated_at': ts.updated_at,
        }

    def get(self, request):
        tracked = list(TrackedSymbol.objects.filter(user=request.user).select_related('source_group'))
        symbols = [t.symbol for t in tracked]
        changes = get_price_changes(symbols) if symbols else {}
        
        # Heatmap static data: đọc từ Redis trước (cache-first), fallback về DB
        profiles: dict[str, dict] = {}
        if symbols:
            from django.core.cache import cache as _cache
            from portfolio.tasks_stock_profile_sync import heatmap_static_cache_key, _HEATMAP_STATIC_TTL

            cache_keys = {s: heatmap_static_cache_key(s) for s in symbols}
            cached = _cache.get_many(list(cache_keys.values()))  # batch O(1) Redis hit

            redis_hits = {
                sym: cached[key]
                for sym, key in cache_keys.items()
                if key in cached
            }
            profiles.update(redis_hits)

            # DB fallback cho các mã chưa có trong Redis
            missing = [s for s in symbols if s not in profiles]
            if missing:
                db_rows = StockProfile.objects.filter(symbol__in=missing).values(
                    'symbol', 'industry', 'company_name'
                )
                lazy_cache: dict[str, dict] = {}
                for p in db_rows:
                    entry = {
                        'industry': p['industry'] or 'Khác',
                        'company_name': p['company_name'] or p['symbol'],
                    }
                    profiles[p['symbol']] = entry
                    lazy_cache[heatmap_static_cache_key(p['symbol'])] = entry
                # Lazy-fill Redis với dữ liệu từ DB để lần sau không cần DB
                if lazy_cache:
                    try:
                        _cache.set_many(lazy_cache, timeout=_HEATMAP_STATIC_TTL)
                    except Exception:
                        pass

        rows = []
        for ts in tracked:
            grp = ts.source_group
            info = changes.get(ts.symbol, {})
            static = profiles.get(ts.symbol, {})
            rows.append({
                'id': ts.id,
                'symbol': ts.symbol,
                'industry': static.get('industry', 'Khác'),
                'company_name': static.get('company_name', ts.symbol),
                'source_group_id': grp.id if grp else None,
                'source_group_name': grp.name if grp else None,
                'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
                'current_price': info.get('current_price'),
                'prev_price': info.get('prev_price'),
                'change_value': info.get('change_value'),
                'change_pct': info.get('change_pct'),
                'last_date': info.get('last_date'),
                'added_at': ts.added_at,
                'updated_at': ts.updated_at,
            })
        serializer = TrackedSymbolSerializer(rows, many=True)
        return Response(serializer.data)

    def post(self, request):
        symbol = (request.data.get('symbol') or '').strip().upper()
        if not symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        source_group_id = request.data.get('source_group_id')
        source_group = None
        if source_group_id:
            try:
                source_group = SecuritiesGroup.objects.get(id=source_group_id)
            except SecuritiesGroup.DoesNotExist:
                pass

        ts, created = TrackedSymbol.objects.get_or_create(
            user=request.user,
            symbol=symbol,
            defaults={
                'source_group': source_group,
                'whale_alert_threshold_million': threshold_million,
            },
        )
        if not created:
            return Response({'detail': f'{symbol} đã có trong danh sách theo dõi.'}, status=status.HTTP_409_CONFLICT)

        update_fields = []
        if created and source_group and ts.source_group != source_group:
            ts.source_group = source_group
            update_fields.append('source_group')
        if threshold_million is not None and ts.whale_alert_threshold_million != threshold_million:
            ts.whale_alert_threshold_million = threshold_million
            update_fields.append('whale_alert_threshold_million')
        if update_fields:
            ts.save(update_fields=update_fields)

        grp = ts.source_group
        info = get_price_changes([symbol]).get(symbol, {})
        row = {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
            'updated_at': ts.updated_at,
        }
        return Response(TrackedSymbolSerializer(row).data, status=status.HTTP_201_CREATED)


class TrackedSymbolDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def _build_row(self, ts):
        grp = ts.source_group
        info = get_price_changes([ts.symbol]).get(ts.symbol, {})
        return {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
            'updated_at': ts.updated_at,
        }

    def patch(self, request, ts_id):
        try:
            ts = TrackedSymbol.objects.select_related('source_group').get(id=ts_id, user=request.user)
        except TrackedSymbol.DoesNotExist:
            return Response({'detail': 'Không tìm thấy mã.'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []

        if 'whale_alert_threshold_million' in request.data:
            try:
                threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if ts.whale_alert_threshold_million != threshold_million:
                ts.whale_alert_threshold_million = threshold_million
                update_fields.append('whale_alert_threshold_million')

        if 'source_group_id' in request.data:
            source_group_id = request.data.get('source_group_id')
            source_group = None
            if source_group_id not in (None, ''):
                try:
                    source_group = SecuritiesGroup.objects.get(id=source_group_id)
                except SecuritiesGroup.DoesNotExist:
                    return Response({'detail': 'Nhóm thị trường nguồn không tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)
            if ts.source_group_id != (source_group.id if source_group else None):
                ts.source_group = source_group
                update_fields.append('source_group')

        if update_fields:
            if 'updated_at' not in update_fields:
                update_fields.append('updated_at')
            ts.save(update_fields=update_fields)

        return Response(TrackedSymbolSerializer(self._build_row(ts)).data)

    def delete(self, request, ts_id):
        try:
            ts = TrackedSymbol.objects.get(id=ts_id, user=request.user)
        except TrackedSymbol.DoesNotExist:
            return Response({'detail': 'Không tìm thấy mã.'}, status=status.HTTP_404_NOT_FOUND)
        ts.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class TrackedSymbolBulkThresholdView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tracked_symbol_ids = request.data.get('tracked_symbol_ids')
        if not isinstance(tracked_symbol_ids, list) or not tracked_symbol_ids:
            return Response(
                {'detail': 'tracked_symbol_ids phải là mảng id không rỗng.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_ids = []
        for raw_id in tracked_symbol_ids:
            try:
                normalized_ids.append(int(raw_id))
            except (TypeError, ValueError):
                return Response({'detail': 'tracked_symbol_ids chứa giá trị không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        queryset = TrackedSymbol.objects.filter(user=request.user, id__in=normalized_ids)
        found_ids = set(queryset.values_list('id', flat=True))
        requested_ids = set(normalized_ids)
        missing_ids = sorted(requested_ids - found_ids)
        if missing_ids:
            return Response(
                {'detail': 'Một số tracked symbol không tồn tại hoặc không thuộc user.', 'missing_ids': missing_ids},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now_ts = timezone.now()
        updated_count = queryset.update(
            whale_alert_threshold_million=threshold_million,
            updated_at=now_ts,
        )

        updated_rows = list(
            TrackedSymbol.objects
            .filter(user=request.user, id__in=found_ids)
            .select_related('source_group')
            .order_by('-added_at')
        )
        symbols = [row.symbol for row in updated_rows]
        changes = get_price_changes(symbols) if symbols else {}
        payload_rows = []
        for row in updated_rows:
            grp = row.source_group
            info = changes.get(row.symbol, {})
            payload_rows.append({
                'id': row.id,
                'symbol': row.symbol,
                'source_group_id': grp.id if grp else None,
                'source_group_name': grp.name if grp else None,
                'whale_alert_threshold_million': float(row.whale_alert_threshold_million) if row.whale_alert_threshold_million is not None else None,
                'current_price': info.get('current_price'),
                'prev_price': info.get('prev_price'),
                'change_value': info.get('change_value'),
                'change_pct': info.get('change_pct'),
                'last_date': info.get('last_date'),
                'added_at': row.added_at,
                'updated_at': row.updated_at,
            })

        return Response(
            {
                'updated_count': updated_count,
                'whale_alert_threshold_million': float(threshold_million) if threshold_million is not None else None,
                'applied_ids': sorted(found_ids),
                'rows': TrackedSymbolSerializer(payload_rows, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rules = list(PriceAlertRule.objects.filter(user=request.user).order_by('-created_at'))
        price_map = get_price_changes([rule.symbol for rule in rules])
        rows = [_build_price_alert_rule_row(rule, price_map) for rule in rules]
        return Response(PriceAlertRuleSerializer(rows, many=True).data)

    def post(self, request):
        serializer = PriceAlertRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rule, created = PriceAlertRule.objects.get_or_create(
            user=request.user,
            symbol=serializer.validated_data['symbol'],
            condition=serializer.validated_data['condition'],
            target_price=serializer.validated_data['target_price'],
            defaults={
                'cooldown_seconds': serializer.validated_data['cooldown_seconds'],
                'is_active': serializer.validated_data['is_active'],
            },
        )

        if not created:
            return Response(
                {'detail': 'Cảnh báo giá này đã tồn tại.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, rule_id):
        return generics.get_object_or_404(PriceAlertRule, id=rule_id, user=request.user)

    def patch(self, request, rule_id):
        rule = self.get_object(request, rule_id)
        serializer = PriceAlertRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data)

    def delete(self, request, rule_id):
        rule = self.get_object(request, rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleTriggerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, rule_id):
        rule = generics.get_object_or_404(PriceAlertRule, id=rule_id, user=request.user)
        rule.last_triggered_at = timezone.now()
        rule.save(update_fields=['last_triggered_at', 'updated_at'])
        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data)
