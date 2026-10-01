"""
Partner-namespace views that delegate to the commercial app's models.

These views sit in identity_access to avoid circular imports while keeping
the commercial app self-contained. They're registered under /core/v1/partner/*.
"""
import logging

from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from identity_access.envelope import adopt_envelope, envelope, paginated_envelope
from identity_access.models import CoreTenant
from identity_access.permissions import IsTenantActive, require_pat_scopes_or_human_session
from identity_access.utils.resolve_tenant import require_tenant_permission as _require_tenant_permission

logger = logging.getLogger(__name__)


TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]


def _get_tenant(user):
    return CoreTenant.objects.get(owner_user=user)


class PartnerCostTrendView(APIView):
    """
    GET /api/core/v1/partner/billing/cost-trend/?months=6
    
    Monthly cost breakdown for the last N months.
    Delegates to commercial.views_analytics.PartnerCostTrendView.
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:read')
        try:
            from commercial.views_analytics import PartnerCostTrendView as InnerView
            view = InnerView.as_view()
            # `commercial` chưa chắc đã bọc → adopt_envelope để endpoint này
            # không có hai shape cùng lúc.
            return adopt_envelope(view(request._request))
        except ImportError:
            return envelope({'monthly': [], 'note': 'commercial app not available'})
        except Exception as e:
            logger.error('PartnerCostTrendView failed for user=%s: %s', request.user.id, e, exc_info=True)
            return envelope({'monthly': [], 'note': str(e)})


class PartnerUsageMetersView(generics.GenericAPIView):
    """Usage meters — latest QuotaHistory snapshot per meter_code (C4)."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:read')
        try:
            from django.db.models import Subquery, OuterRef
            from commercial.models import QuotaHistory
            from commercial.serializers import PartnerUsageMeterSerializer

            tenant = _get_tenant(request.user)
            latest_ids = QuotaHistory.objects.filter(
                tenant=tenant, meter_code=OuterRef('meter_code')
            ).order_by('-date').values('id')[:1]
            rows = QuotaHistory.objects.filter(
                tenant=tenant, id=Subquery(latest_ids)
            ).order_by('meter_code')

            return paginated_envelope({'results': PartnerUsageMeterSerializer(rows, many=True).data})
        except ImportError:
            # commercial app not available — return empty list
            return paginated_envelope({'results': []})


class PartnerUsageQuotasView(generics.GenericAPIView):
    """Usage quotas — latest QuotaHistory snapshot per meter_code (C4)."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:read')
        try:
            from django.db.models import Subquery, OuterRef
            from commercial.models import QuotaHistory
            from commercial.serializers import PartnerUsageMeterSerializer

            tenant = _get_tenant(request.user)
            latest_ids = QuotaHistory.objects.filter(
                tenant=tenant, meter_code=OuterRef('meter_code')
            ).order_by('-date').values('id')[:1]
            rows = QuotaHistory.objects.filter(
                tenant=tenant, id=Subquery(latest_ids)
            ).order_by('meter_code')

            return paginated_envelope({'results': PartnerUsageMeterSerializer(rows, many=True).data})
        except ImportError:
            # commercial app not available — return empty list
            return paginated_envelope({'results': []})


class PartnerBillingSubscriptionView(generics.GenericAPIView):
    """Subscription detail — delegates to commercial Subscription if exists."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:read')
        try:
            from commercial.models import Subscription
            from commercial.serializers import SubscriptionSerializer
            tenant = _get_tenant(request.user)
            sub = Subscription.objects.filter(tenant=tenant).first()
            if sub is None:
                # Return graceful empty state instead of 404
                return envelope({
                    'status': 'none',
                    'plan': tenant.plan,
                    'billing_period_start': tenant.billing_period_start,
                    'billing_period_end': tenant.billing_period_end,
                    'trial_ends_at': tenant.trial_ends_at,
                })
            return envelope(SubscriptionSerializer(sub).data)
        except ImportError:
            # commercial app not yet migrated
            return envelope({
                'status': 'none',
                'plan': None,
                'billing_period_start': None,
                'billing_period_end': None,
                'trial_ends_at': None,
            })
        except Exception as e:
            logger.error('PartnerBillingSubscriptionView failed for user=%s: %s', request.user.id, e, exc_info=True)
            return envelope({
                'status': 'none',
                'plan': None,
                'billing_period_start': None,
                'billing_period_end': None,
                'trial_ends_at': None,
            })


class PartnerBillingInvoicesView(generics.GenericAPIView):
    """Invoices list — delegates to commercial Invoice if exists."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:read')
        try:
            from commercial.models import Invoice
            from commercial.serializers import InvoiceSerializer
            tenant = _get_tenant(request.user)
            qs = Invoice.objects.filter(tenant=tenant).order_by('-created_at')
            return envelope(InvoiceSerializer(qs, many=True).data)
        except ImportError:
            # commercial app not yet migrated
            return envelope([])
        except Exception as e:
            logger.error('PartnerBillingInvoicesView failed for user=%s: %s', request.user.id, e, exc_info=True)
            return envelope([])


# ─── STRIPE BILLING PARTNER VIEWS ──────────────────────────────────────────

class PartnerStripeCheckoutSessionView(APIView):
    """
    POST /api/core/v1/partner/billing/stripe/session/
    
    Create a Stripe Checkout Session for subscription upgrade.
    Delegates to commercial.StripeCheckoutSessionView.
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:write')
        try:
            from commercial.views import StripeCheckoutSessionView
            view = StripeCheckoutSessionView.as_view()
            return view(request._request)
        except ImportError:
            return Response({'error': 'Stripe billing not available'}, status=503)
        except Exception as e:
            logger.error('PartnerStripeCheckoutSessionView failed for user=%s: %s', request.user.id, e, exc_info=True)
            return Response({'error': str(e)}, status=500)


class PartnerStripePortalSessionView(APIView):
    """
    POST /api/core/v1/partner/billing/stripe/portal/
    
    Create a Stripe Customer Portal Session for self-service billing management.
    Delegates to commercial.StripePortalSessionView.
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:write')
        try:
            from commercial.views import StripePortalSessionView
            view = StripePortalSessionView.as_view()
            return view(request._request)
        except ImportError:
            return Response({'error': 'Stripe billing not available'}, status=503)
        except Exception as e:
            logger.error('PartnerStripePortalSessionView failed for user=%s: %s', request.user.id, e, exc_info=True)
            return Response({'error': str(e)}, status=500)


class PartnerUsageHistoryView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/usage/history/
    
    Query params:
    - meter_code (optional): Filter by specific meter
    - days (optional, default 30): Number of days of history to return
    - start_date (optional): Start date (YYYY-MM-DD)
    - end_date (optional): End date (YYYY-MM-DD)
    
    Returns daily quota history for charting.
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'billing:read')
        try:
            from commercial.models import QuotaHistory
            from commercial.serializers import QuotaHistorySerializer
            from django.utils import timezone
            from datetime import timedelta
            
            tenant = _get_tenant(request.user)
            
            # Parse query params
            meter_code = request.query_params.get('meter_code')
            days = int(request.query_params.get('days', 30))
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
            
            # Build queryset
            qs = QuotaHistory.objects.filter(tenant=tenant)
            
            if meter_code:
                qs = qs.filter(meter_code=meter_code)
            
            if start_date_str:
                qs = qs.filter(date__gte=start_date_str)
            else:
                # Default to last N days
                start_date = timezone.now().date() - timedelta(days=days)
                qs = qs.filter(date__gte=start_date)
            
            if end_date_str:
                qs = qs.filter(date__lte=end_date_str)
            
            qs = qs.order_by('date', 'meter_code')

            return paginated_envelope({'results': QuotaHistorySerializer(qs, many=True).data})
        except ImportError:
            # commercial app or QuotaHistory not yet migrated
            return paginated_envelope({'results': []})
        except Exception as e:
            logger.error('PartnerUsageHistoryView failed for user=%s: %s', request.user.id, e, exc_info=True)
            return Response({'error': str(e)}, status=500)
