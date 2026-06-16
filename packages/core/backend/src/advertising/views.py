import hmac
import hashlib
import time
import logging
import random
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from identity_access.authentication import CorePATAuthentication
from advertising.models import AdCampaign, AdDailySummary
from advertising.serializers import AdCampaignSerializer, AdDailySummarySerializer
from advertising.tasks import _get_redis_client

logger = logging.getLogger(__name__)


class AdvertisingAnonRateThrottle(AnonRateThrottle):
    rate = '60/minute'


class AdvertisingUserRateThrottle(UserRateThrottle):
    rate = '120/minute'


class ContentDisplayView(APIView):
    """
    GET /api/v1/content/display/
    Returns active ad campaign details and trademark visibility flag.
    """
    authentication_classes = [CorePATAuthentication]
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AdvertisingAnonRateThrottle, AdvertisingUserRateThrottle]

    def get(self, request):
        user = request.user
        is_premium = False
        tenant = None

        if user and user.is_authenticated:
            try:
                tenant = user.core_tenant
                # starter, pro, enterprise, custom, internal represent paid plans
                if tenant.plan in {'starter', 'pro', 'enterprise', 'custom', 'internal'}:
                    is_premium = True
            except AttributeError:
                pass

        if is_premium:
            return Response({
                "show_ads": False,
                "hide_trademark": True,
                "ad": None
            }, status=status.HTTP_200_OK)

        slot_size = request.query_params.get('slot_size', '300x50').strip().lower()
        symbol = request.query_params.get('symbol', '').strip().upper()

        # Try to resolve campaign list from Redis Sets index
        try:
            redis_client = _get_redis_client()
            union_keys = [f"ads:active:all:{slot_size}"]
            if symbol:
                union_keys.append(f"ads:active:symbol:{symbol}:{slot_size}")
            if tenant:
                union_keys.append(f"ads:active:tenant:{tenant.public_id}:{slot_size}")
            
            campaign_ids = redis_client.sunion(*union_keys)
            campaign_ids = [c.decode('utf-8') for c in campaign_ids] if campaign_ids else []
        except Exception as exc:
            logger.warning("Failed to fetch ad campaign indexes from Redis: %s", exc)
            campaign_ids = []

        campaigns = []
        if campaign_ids:
            campaigns = list(AdCampaign.objects.filter(id__in=campaign_ids, status=AdCampaign.Status.ACTIVE))

        # DB Fallback if Redis index is empty/failed
        if not campaigns:
            now = timezone.now()
            w, h = 300, 50
            if 'x' in slot_size:
                try:
                    w, h = map(int, slot_size.split('x'))
                except ValueError:
                    pass
            
            db_query = AdCampaign.objects.filter(
                status=AdCampaign.Status.ACTIVE,
                banner_width=w,
                banner_height=h,
                start_date__lte=now,
                end_date__gte=now
            )
            if tenant:
                db_query = db_query.filter(models.Q(tenant=tenant) | models.Q(tenant__isnull=True))
            else:
                db_query = db_query.filter(tenant__isnull=True)
                
            campaigns = list(db_query)

        # Select campaign by weight rotation
        selected_campaign = None
        if campaigns:
            weights = [c.weight for c in campaigns]
            try:
                selected_campaign = random.choices(campaigns, weights=weights, k=1)[0]
            except Exception:
                selected_campaign = campaigns[0]

        if not selected_campaign:
            # Fallback to hardcoded default internal promo ad
            return Response({
                "show_ads": True,
                "hide_trademark": False,
                "ad": {
                    "campaign_id": "00000000-0000-0000-0000-000000000000",
                    "image_source": {
                        "default": "https://cdn.vninvest.vn/content/banners/default/promo_30050.webp",
                        "retina": "https://cdn.vninvest.vn/content/banners/default/promo_30050_2x.webp",
                        "svg": "https://cdn.vninvest.vn/content/banners/default/promo_30050.svg"
                    },
                    "click_url": "https://vninvest.vn/upgrade?utm_source=widget_free_default",
                    "click_tracking_url": "",
                    "impression_tracking_url": "",
                    "width": 300,
                    "height": 50
                }
            }, status=status.HTTP_200_OK)

        # Generate HMAC security signature
        expires_at = int(time.time()) + 300  # 5 minutes expiry window
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        campaign_id_str = str(selected_campaign.id)
        tenant_id_str = str(tenant.public_id) if tenant else ""

        ad_signing_secret = getattr(settings, 'CORE_AD_SIGNING_SECRET', 'dev-ad-signing-secret-replace-in-production')
        msg = f"{campaign_id_str}:{tenant_id_str}:{client_ip}:{expires_at}"
        sig = hmac.new(ad_signing_secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).hexdigest()

        # Build absolute URLs
        domain = request.build_absolute_uri('/')[:-1]
        click_tracking_url = f"{domain}/api/v1/metrics/log/click/{campaign_id_str}/?symbol={symbol}&tenant_id={tenant_id_str}&expires_at={expires_at}&sig={sig}"
        impression_tracking_url = f"{domain}/api/v1/metrics/log/view/?campaign_id={campaign_id_str}&symbol={symbol}&tenant_id={tenant_id_str}&expires_at={expires_at}&sig={sig}"

        return Response({
            "show_ads": True,
            "hide_trademark": False,
            "ad": {
                "campaign_id": campaign_id_str,
                "image_source": {
                    "default": selected_campaign.banner_url,
                    "retina": selected_campaign.banner_url_retina or selected_campaign.banner_url,
                    "svg": selected_campaign.banner_url_svg or selected_campaign.banner_url
                },
                "click_url": selected_campaign.destination_url,
                "click_tracking_url": click_tracking_url,
                "impression_tracking_url": impression_tracking_url,
                "width": selected_campaign.banner_width,
                "height": selected_campaign.banner_height
            }
        }, status=status.HTTP_200_OK)


class BaseMetricsLogView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AdvertisingAnonRateThrottle, AdvertisingUserRateThrottle]

    def verify_request(self, request, campaign_id=None):
        sig = request.data.get('sig') or request.query_params.get('sig')
        expires_at = request.data.get('expires_at') or request.query_params.get('expires_at')
        camp_id = request.data.get('campaign_id') or request.query_params.get('campaign_id') or str(campaign_id or '')
        tenant_id = request.data.get('tenant_id') or request.query_params.get('tenant_id') or ""
        symbol = request.data.get('symbol') or request.query_params.get('symbol') or "ALL"

        if not all([sig, expires_at, camp_id]):
            return None, Response({"detail": "Missing signature parameters."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Verify expiration window
        try:
            if int(expires_at) < time.time():
                return None, Response({"detail": "Signature expired."}, status=status.HTTP_403_FORBIDDEN)
        except (ValueError, TypeError):
            return None, Response({"detail": "Invalid expiration time."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Check client IP match
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()

        # 3. Verify HMAC signature integrity
        ad_signing_secret = getattr(settings, 'CORE_AD_SIGNING_SECRET', 'dev-ad-signing-secret-replace-in-production')
        msg = f"{camp_id}:{tenant_id}:{client_ip}:{expires_at}"
        expected_sig = hmac.new(ad_signing_secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(str(sig), expected_sig):
            return None, Response({"detail": "Invalid signature verification failed."}, status=status.HTTP_403_FORBIDDEN)

        payload = {
            'campaign_id': camp_id,
            'tenant_id': tenant_id,
            'symbol': symbol,
            'ip_address': client_ip,
            'user_agent': request.META.get('HTTP_USER_AGENT', '')
        }
        return payload, None

    def queue_event(self, stream_key, payload):
        try:
            redis_client = _get_redis_client()
            redis_client.xadd(stream_key, payload, maxlen=50000, approximate=True)
            return True
        except Exception as exc:
            logger.error("Failed to push ad log event to Redis Stream: %s", exc)
            return False


class MetricsLogViewView(BaseMetricsLogView):
    """
    POST /api/v1/metrics/log/view/
    Ghi nhận Impression từ Widget.
    """
    def post(self, request):
        payload, error_response = self.verify_request(request)
        if error_response:
            return error_response

        queued = self.queue_event('ads:impressions:stream', payload)
        if not queued:
            return Response({"detail": "Internal tracking failure."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"status": "ok", "tracked": True}, status=status.HTTP_202_ACCEPTED)


class MetricsLogClickView(BaseMetricsLogView):
    """
    POST /api/v1/metrics/log/click/<uuid:campaign_id>/
    Ghi nhận Click từ Widget.
    """
    def post(self, request, campaign_id):
        payload, error_response = self.verify_request(request, campaign_id)
        if error_response:
            return error_response

        queued = self.queue_event('ads:clicks:stream', payload)
        if not queued:
            return Response({"detail": "Internal tracking failure."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"status": "ok", "tracked": True}, status=status.HTTP_202_ACCEPTED)


# =========================================================================
# Operator Admin Dashboard Views
# =========================================================================

class OperatorAdCampaignViewSet(viewsets.ModelViewSet):
    queryset = AdCampaign.objects.all()
    serializer_class = AdCampaignSerializer
    permission_classes = [permissions.IsAdminUser]
    authentication_classes = [CorePATAuthentication, SessionAuthentication]


class OperatorAdDailySummaryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AdDailySummary.objects.all().select_related('campaign')
    serializer_class = AdDailySummarySerializer
    permission_classes = [permissions.IsAdminUser]
    authentication_classes = [CorePATAuthentication, SessionAuthentication]
