import hmac
import hashlib
import time
import logging
import random
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from vninvest_core.client_ip import get_client_ip
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema

from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from identity_access.authentication import CorePATAuthentication
from advertising.models import AdCampaign, AdDailySummary, TrademarkConfig
from advertising.serializers import AdCampaignSerializer, AdDailySummarySerializer
from advertising.tasks import _get_redis_client
from vninvest_core.exceptions import ValidationErrorException, PermissionErrorException

logger = logging.getLogger(__name__)


class AdvertisingAnonRateThrottle(AnonRateThrottle):
    rate = '60/minute'


class AdvertisingUserRateThrottle(UserRateThrottle):
    rate = '120/minute'


@extend_schema(
    summary='Noi dung widget (campaign dang chay)',
    description='Payload la config hien tai + danh sach campaign ma widget duoc phep render.',
    # FLAT payload: this view returns bare `Response({...})`, not an envelope.
    # Documenting it with `envelope_response()` would claim a `{data, meta}` shape
    # the API does not send, and `test_flat_views_are_not_documented_as_envelope`
    # (vninvest_core/tests/test_api_envelope_schema.py:528) exists to catch exactly
    # that. `OpenApiTypes.OBJECT` still records a response schema, so the operation
    # stops counting as undocumented.
    responses={200: OpenApiTypes.OBJECT},
)
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
                db_query = db_query.filter(Q(tenant=tenant) | Q(tenant__isnull=True))
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
        client_ip = get_client_ip(request)
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


def _sign_ad_tracking_urls(request, campaign_id_str, tenant_id_str, symbol):
    """Build HMAC-signed click/impression tracking URLs for a campaign.

    Shared by ContentDisplayView (legacy single-ad) and WidgetAdView (array).
    """
    expires_at = int(time.time()) + 300  # 5 minutes expiry window
    # Was a hand-rolled left-most X-Forwarded-For read. That entry is the one the
    # CLIENT supplied, so the ad-signing HMAC was computed over an address the
    # caller chose. Delegates to the shared SSOT, which honours the header only
    # when the immediate peer is a trusted proxy.
    client_ip = get_client_ip(request)
    ad_signing_secret = getattr(
        settings, 'CORE_AD_SIGNING_SECRET', 'dev-ad-signing-secret-replace-in-production'
    )
    msg = f"{campaign_id_str}:{tenant_id_str}:{client_ip}:{expires_at}"
    sig = hmac.new(
        ad_signing_secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256
    ).hexdigest()
    domain = request.build_absolute_uri('/')[:-1]
    click_tracking_url = (
        f"{domain}/api/v1/metrics/log/click/{campaign_id_str}/"
        f"?symbol={symbol}&tenant_id={tenant_id_str}&expires_at={expires_at}&sig={sig}"
    )
    impression_tracking_url = (
        f"{domain}/api/v1/metrics/log/view/"
        f"?campaign_id={campaign_id_str}&symbol={symbol}&tenant_id={tenant_id_str}"
        f"&expires_at={expires_at}&sig={sig}"
    )
    return click_tracking_url, impression_tracking_url


@extend_schema(
    summary='Doc/ghi config widget',
    # PATCH carries a body, so the request side must be typed too; response-only
    # is not enough and spectacular still reports "unable to guess serializer".
    request=OpenApiTypes.OBJECT,
    # FLAT payload — see the note on `ContentDisplayView`. `envelope_response()`
    # here would document a `{data, meta}` shape this view never sends.
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
    },
)
class WidgetConfigView(APIView):
    """
    GET /core/v1/widget/config[/]
    Trademark enforcement config for the chart widget. No auth required.
    The client reads this endpoint to decide whether to run the trademark watchdog.
    Response: { "trademark": { "enabled": bool, "activationTs": int|null, "version": str } }

    PATCH /core/v1/widget/config[/]
    Update trademark config from the operator admin page. IsAdminUser required.
    Response: { "trademark": { "enabled": bool, "activationTs": int|null, "version": str } }
    """
    authentication_classes = [CorePATAuthentication, SessionAuthentication]
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AdvertisingAnonRateThrottle, AdvertisingUserRateThrottle]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get(self, request):
        config = TrademarkConfig.get_config()
        return Response({
            "trademark": {
                "enabled": config.enabled,
                "activationTs": config.activation_ts,
                "version": config.version,
            }
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        config = TrademarkConfig.get_config()
        enabled = request.data.get("enabled")
        activation_ts = request.data.get("activation_ts")

        if enabled is not None:
            config.enabled = bool(enabled)
        if activation_ts is not None:
            config.activation_ts = int(activation_ts) if activation_ts else None

        # Increment version for cache invalidation
        try:
            major, minor = config.version.split("_v")
            config.version = f"cfg_v{int(minor) + 1}"
        except Exception:
            config.version = "cfg_v2"

        config.save()

        return Response({
            "trademark": {
                "enabled": config.enabled,
                "activationTs": config.activation_ts,
                "version": config.version,
            }
        }, status=status.HTTP_200_OK)


@extend_schema(
    summary='Lay quang cao cho widget',
    responses={200: OpenApiTypes.OBJECT},  # FLAT payload, not an envelope
)
class WidgetAdView(APIView):
    """
    GET /core/v1/widget/ad[/]
    Returns eligible ad campaigns for the chart widget as an array.
    Optional Bearer PAT: premium tenants receive an empty list.
    Response: { "campaigns": [ AdCampaign, ... ] }
    """
    authentication_classes = [CorePATAuthentication]
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AdvertisingAnonRateThrottle, AdvertisingUserRateThrottle]

    MAX_CAMPAIGNS = 20

    def get(self, request):
        user = request.user
        tenant = None
        is_premium = False

        if user and user.is_authenticated:
            try:
                tenant = user.core_tenant
                if tenant.plan in {'starter', 'pro', 'enterprise', 'custom', 'internal'}:
                    is_premium = True
            except AttributeError:
                pass

        # Premium tenants: no ads
        if is_premium:
            return Response({"campaigns": []}, status=status.HTTP_200_OK)

        symbol = request.query_params.get('symbol', '').strip().upper()
        now = timezone.now()

        db_query = AdCampaign.objects.filter(
            status=AdCampaign.Status.ACTIVE,
            start_date__lte=now,
            end_date__gte=now,
        )
        if tenant:
            db_query = db_query.filter(Q(tenant=tenant) | Q(tenant__isnull=True))
        else:
            db_query = db_query.filter(tenant__isnull=True)

        campaigns = list(db_query.order_by('-weight')[:self.MAX_CAMPAIGNS])

        tenant_id_str = str(tenant.public_id) if tenant else ""
        result = []
        for campaign in campaigns:
            campaign_id_str = str(campaign.id)
            click_tracking_url, impression_tracking_url = _sign_ad_tracking_urls(
                request, campaign_id_str, tenant_id_str, symbol or 'ALL'
            )
            result.append({
                "campaign_id": campaign_id_str,
                "image_source": {
                    "default": campaign.banner_url,
                    "retina": campaign.banner_url_retina or campaign.banner_url,
                    "svg": campaign.banner_url_svg or campaign.banner_url,
                },
                "video_url": None,
                "click_url": campaign.destination_url,
                "click_tracking_url": click_tracking_url,
                "impression_tracking_url": impression_tracking_url,
                "width": campaign.banner_width,
                "height": campaign.banner_height,
                "targeting": campaign.targeting_rules or {},
                "start_at": int(campaign.start_date.timestamp() * 1000) if campaign.start_date else None,
                "end_at": int(campaign.end_date.timestamp() * 1000) if campaign.end_date else None,
            })

        return Response({"campaigns": result}, status=status.HTTP_200_OK)


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
            raise ValidationErrorException("Missing signature parameters.")

        # 1. Verify expiration window
        try:
            if int(expires_at) < time.time():
                raise PermissionErrorException("Signature expired.")
        except (ValueError, TypeError):
            raise ValidationErrorException("Invalid expiration time.")

        # 2. Check client IP match
        client_ip = get_client_ip(request)

        # 3. Verify HMAC signature integrity
        ad_signing_secret = getattr(settings, 'CORE_AD_SIGNING_SECRET', 'dev-ad-signing-secret-replace-in-production')
        msg = f"{camp_id}:{tenant_id}:{client_ip}:{expires_at}"
        expected_sig = hmac.new(ad_signing_secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(str(sig), expected_sig):
            raise PermissionErrorException("Invalid signature verification failed.")

        payload = {
            'campaign_id': camp_id,
            'tenant_id': tenant_id,
            'symbol': symbol,
            'ip_address': client_ip,
            'user_agent': request.META.get('HTTP_USER_AGENT', '')
        }
        return payload

    def queue_event(self, stream_key, payload):
        try:
            redis_client = _get_redis_client()
            redis_client.xadd(stream_key, payload, maxlen=50000, approximate=True)
            return True
        except Exception as exc:
            logger.error("Failed to push ad log event to Redis Stream: %s", exc)
            return False


@extend_schema(
    summary='Ghi log hien thi quang cao',
    request=OpenApiTypes.OBJECT,
    responses={202: OpenApiTypes.OBJECT},  # FLAT payload, not an envelope
)
class MetricsLogViewView(BaseMetricsLogView):
    """
    POST /api/v1/metrics/log/view/
    Ghi nhận Impression từ Widget.
    """
    def post(self, request):
        payload = self.verify_request(request)

        queued = self.queue_event('ads:impressions:stream', payload)
        if not queued:
            return Response({"detail": "Internal tracking failure."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"status": "ok", "tracked": True}, status=status.HTTP_202_ACCEPTED)


@extend_schema(
    summary='Ghi log click quang cao',
    request=OpenApiTypes.OBJECT,
    responses={202: OpenApiTypes.OBJECT},  # FLAT payload, not an envelope
)
class MetricsLogClickView(BaseMetricsLogView):
    """
    POST /api/v1/metrics/log/click/<uuid:campaign_id>/
    Ghi nhận Click từ Widget.
    """
    def post(self, request, campaign_id):
        payload = self.verify_request(request, campaign_id)

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

