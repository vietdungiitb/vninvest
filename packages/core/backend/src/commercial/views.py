import logging
import uuid

import stripe
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from identity_access.models import CoreTenant
from identity_access.utils.resolve_tenant import resolve_tenant
from vninvest_core.api_envelope import envelope_response
from vninvest_core.client_ip import get_client_ip
from vninvest_core.exceptions import (
    PermissionErrorException,
    ValidationErrorException,
)
from vninvest_core.pagination import CoreCursorPagination

from .envelope import envelope
from .models import Invoice, LicenseKey, PaymentTransaction, QuotaRecord, Subscription, VNPayIPNLog
from .permissions import RequiresTenantPermission
from .plan_catalog import (
    CANONICAL_PLANS,
    PLAN_DURATIONS_DAYS,
    PLAN_PRICES_VND,
    normalize_plan,
)
from .schema import (
    LegalPagesDataSerializer,
    PaymentStatusDataSerializer,
    StripePortalDataSerializer,
    StripeSessionDataSerializer,
    VNPayCreateDataSerializer,
)
from .serializers import (
    InvoiceSerializer,
    LicenseKeySerializer,
    QuotaRecordSerializer,
    SubscriptionSerializer,
)
from .stripe_service import stripe_service
from .license_service import LicenseService
from .vnpay_service import VNPayService

logger = logging.getLogger(__name__)


class QuotaCursorPagination(CoreCursorPagination):
    ordering = '-period_start'


class SubscriptionDetailView(generics.RetrieveAPIView):
    serializer_class = SubscriptionSerializer
    # Plan + price + renewal dates are commitments, not usage metrics, so this
    # rides the billing token rather than the usage token.
    required_tenant_permissions = ('billing:read',)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]

    def get_object(self):
        tenant = resolve_tenant(self.request)
        return generics.get_object_or_404(Subscription, tenant=tenant)


class QuotaListView(generics.ListAPIView):
    serializer_class = QuotaRecordSerializer
    # Usage metrics, not money. `viewer` already holds `usage:read` in
    # SYSTEM_ROLE_PERMISSIONS, so quota stays viewer-readable by existing
    # policy. Change the token to 'billing:read' if quota must become
    # owner/admin-only as well.
    required_tenant_permissions = ('usage:read',)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]
    pagination_class = QuotaCursorPagination

    def get_queryset(self):
        tenant = resolve_tenant(self.request)
        return QuotaRecord.objects.filter(tenant=tenant).order_by('-period_start')


class InvoiceListView(generics.ListAPIView):
    serializer_class = InvoiceSerializer
    # `Invoice` has no user FK, so this endpoint is the only place the rule
    # "a viewer must not see other members' invoices" can live. Token matches
    # D07_API_SPECIFICATION_20261002.md:707 ("Owner, Admin").
    required_tenant_permissions = ('billing:read',)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]
    pagination_class = CoreCursorPagination

    def get_queryset(self):
        tenant = resolve_tenant(self.request)
        return Invoice.objects.filter(tenant=tenant).order_by('-created_at')


@extend_schema(
    responses={200: envelope_response(LegalPagesDataSerializer)},
)
class PublicLegalPagesView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        # CỐ TÌNH KHÔNG bọc envelope.
        #
        # Đây là route **public, không xác thực** (`AllowAny`), nằm ngoài bề mặt
        # API có xác thực mà `{data, meta}` áp dụng. `tests/
        # test_identity_access_permissions.py:173` tên là
        # `test_public_legal_pages_route_unchanged` và chốt đúng
        # `{'results': []}` — đó là **chốt hình dạng có chủ đích**, không phải
        # assertion cũ sót lại.
        #
        # Lần migrate truoc da boc endpoint nay va lam 2 test do hong; revert la
        # dung. Xem `check-envelope-contract.py` (`SKIP_PUBLIC_BOOTSTRAP`).
        return Response({'results': []})


# ─── GIAI ĐOẠN 2: VNPAY PAYMENT GATEWAY INTEGRATION ────────────────────────

@extend_schema(
    # 400/401/403 để nguyên: lỗi đi qua RFC 9457 problem+json, KHÔNG phải
    # `{data, meta}`. Xem `commercial/envelope.py`.
    responses={200: envelope_response(VNPayCreateDataSerializer)},
)
@extend_schema(
    summary='CreateVNPayPaymentView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class CreateVNPayPaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        POST /api/v1/commercial/payments/create/
        Request Body: { "amount": 100000, "plan": "pro" }
        """
        user = request.user
        try:
            tenant = user.core_tenant
        except CoreTenant.DoesNotExist:
            raise PermissionErrorException(
                detail="Tài khoản không được liên kết với bất kỳ Workspace/Tenant nào.",
                code="tenant_not_found"
            )

        amount = request.data.get('amount')
        raw_plan = request.data.get('plan')

        if not amount or not raw_plan:
            raise ValidationErrorException(
                detail="amount và plan là bắt buộc.",
                code="validation_error"
            )

        # Chuẩn hóa plan (VIP_* hoặc canonical) → canonical code; reject nếu không hợp lệ.
        plan = normalize_plan(raw_plan)
        if not plan:
            raise ValidationErrorException(
                detail="plan không hợp lệ (phải là starter/pro/enterprise hoặc VIP_1M/VIP_6M/VIP_12M).",
                code="validation_error"
            )

        try:
            amount_dec = float(amount)
            if amount_dec <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            raise ValidationErrorException(
                detail="amount phải là số dương hợp lệ.",
                code="validation_error"
            )

        # Validate server-side: amount phải khớp giá chuẩn của plan (chống tam giá).
        expected_amount = PLAN_PRICES_VND.get(plan)
        if expected_amount is not None and amount_dec != expected_amount:
            raise ValidationErrorException(
                detail="amount không khớp với gói cước đã chọn.",
                code="validation_error"
            )

        # Create or fetch open invoice
        with transaction.atomic():
            # Find open invoice for this plan, or create new one
            invoice = Invoice.objects.filter(
                tenant=tenant,
                status=Invoice.StatusChoices.OPEN,
                amount_due=amount_dec
            ).first()

            if not invoice:
                # Generate unique invoice number
                invoice_number = f"INV-{uuid.uuid4().hex[:12].upper()}"
                invoice = Invoice.objects.create(
                    tenant=tenant,
                    invoice_number=invoice_number,
                    status=Invoice.StatusChoices.OPEN,
                    amount_due=amount_dec,
                    currency='VND',
                    period_start=timezone.now().date(),
                    period_end=(timezone.now() + timezone.timedelta(days=30)).date(),
                    due_date=(timezone.now() + timezone.timedelta(days=7)).date(),
                    line_items={'plan': plan}
                )

            # Generate unique payment txn_ref
            txn_ref = f"TXN-{uuid.uuid4().hex[:16].upper()}"
            client_ip = get_client_ip(request)

            # Generate Signed URL
            pay_url = VNPayService.generate_payment_url(
                txn_ref=txn_ref,
                amount=amount_dec,
                description=f"Thanh toan goi {plan.upper()} - {invoice.invoice_number}",
                client_ip=client_ip
            )

            # Create payment transaction record
            txn = PaymentTransaction.objects.create(
                invoice=invoice,
                tenant=tenant,
                txn_ref=txn_ref,
                amount=amount_dec,
                plan=plan,
                status=PaymentTransaction.StatusChoices.PENDING,
                pay_url=pay_url
            )

        return envelope({
            'status': 'success',
            'txn_ref': txn_ref,
            'pay_url': pay_url,
            'amount': amount_dec,
            'plan': plan
        }, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='VNPayIPNWebhookView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class VNPayIPNWebhookView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        """
        GET /api/v1/commercial/payments/vnpay-ipn/
        VNPay sends IPN as a GET webhook request.
        """
        query_params = request.GET.dict()
        txn_ref = query_params.get('vnp_TxnRef')
        response_code = query_params.get('vnp_ResponseCode')
        vnp_transaction_no = query_params.get('vnp_TransactionNo')

        # Log IPN request thô
        ipn_log = VNPayIPNLog.objects.create(
            txn_ref=txn_ref or 'UNKNOWN',
            raw_query=request.META.get('QUERY_STRING', '')
        )

        if not txn_ref:
            ipn_log.error_message = "No vnp_TxnRef in query parameters."
            ipn_log.save(update_fields=['error_message'])
            return Response({"RspCode": "99", "Message": "Input required data"}, status=status.HTTP_200_OK)

        # 1. Verify Signature
        is_valid = VNPayService.verify_ipn_signature(query_params)
        ipn_log.is_valid_signature = is_valid
        ipn_log.save(update_fields=['is_valid_signature'])

        if not is_valid:
            ipn_log.error_message = "Signature verification failed."
            ipn_log.save(update_fields=['error_message'])
            return Response({"RspCode": "97", "Message": "Signature invalid"}, status=status.HTTP_200_OK)

        # 2. Lock and Update transaction atomic with select_for_update() to prevent race conditions
        try:
            with transaction.atomic():
                txn = PaymentTransaction.objects.select_for_update().get(txn_ref=txn_ref)

                # Check if already processed
                if txn.status in (PaymentTransaction.StatusChoices.SUCCESS, PaymentTransaction.StatusChoices.FAILED):
                    ipn_log.processed = True
                    ipn_log.error_message = f"Transaction already finalized with status: {txn.status}"
                    ipn_log.save(update_fields=['processed', 'error_message'])
                    return Response({"RspCode": "02", "Message": "Order already confirmed"}, status=status.HTTP_200_OK)

                # Validate amount (defense-in-depth): VNPay gửi vnp_Amount = amount*100
                #
                # An unparsable amount must REJECT, not skip the check. The previous
                # code did `ipn_amount = -1` on failure and then guarded with
                # `if ipn_amount >= 0 and ...`, so `vnp_Amount=notanumber` disabled
                # amount verification entirely for that callback.
                raw_amount = query_params.get('vnp_Amount')
                try:
                    ipn_amount = int(raw_amount) // 100
                except (ValueError, TypeError):
                    ipn_log.error_message = (
                        f"Unparsable vnp_Amount: {raw_amount!r}"
                    )
                    ipn_log.save(update_fields=['error_message'])
                    return Response(
                        {"RspCode": "99", "Message": "Amount invalid"},
                        status=status.HTTP_200_OK,
                    )
                if ipn_amount < 0 or ipn_amount != txn.amount:
                    ipn_log.error_message = f"Amount mismatch: IPN={ipn_amount}, txn={txn.amount} (raw={raw_amount})"
                    ipn_log.save(update_fields=['error_message'])
                    return Response({"RspCode": "99", "Message": "Amount mismatch"}, status=status.HTTP_200_OK)

                # Process transaction update
                txn.vnp_transaction_no = vnp_transaction_no
                txn.error_code = response_code

                if response_code == '00':
                    # Success
                    txn.status = PaymentTransaction.StatusChoices.SUCCESS
                    txn.save(update_fields=['status', 'vnp_transaction_no', 'error_code'])

                    # Update Invoice
                    invoice = txn.invoice
                    invoice.status = Invoice.StatusChoices.PAID
                    invoice.paid_at = timezone.now()
                    invoice.save(update_fields=['status', 'paid_at'])

                    # Activate or Extend Tenant Subscription
                    # Đọc plan từ PaymentTransaction (đã lưu lúc create), fallback invoice.line_items.
                    plan_name = txn.plan or (invoice.line_items or {}).get('plan') or ''
                    if plan_name not in CANONICAL_PLANS:
                        # Không xác định được plan hợp lệ → ghi log và reject IPN (không default "pro").
                        ipn_log.error_message = f"Không xác định được plan hợp lệ cho txn {txn_ref} (txn.plan={txn.plan!r})."
                        ipn_log.save(update_fields=['error_message'])
                        return Response({"RspCode": "99", "Message": "Plan không hợp lệ"}, status=status.HTTP_200_OK)

                    duration_days = PLAN_DURATIONS_DAYS.get(plan_name, 30)

                    # Create or update subscription
                    sub, created = Subscription.objects.get_or_create(
                        tenant=txn.tenant,
                        defaults={
                            'plan': plan_name,
                            'status': Subscription.StatusChoices.ACTIVE,
                            'current_period_start': timezone.now().date(),
                            'current_period_end': (timezone.now() + timezone.timedelta(days=duration_days)).date()
                        }
                    )

                    if not created:
                        sub.plan = plan_name
                        sub.status = Subscription.StatusChoices.ACTIVE
                        sub.current_period_start = timezone.now().date()
                        # If existing active subscription, extend the end date
                        if sub.current_period_end >= timezone.now().date():
                            sub.current_period_end = sub.current_period_end + timezone.timedelta(days=duration_days)
                        else:
                            sub.current_period_end = (timezone.now() + timezone.timedelta(days=duration_days)).date()
                        sub.save()

                    # Trigger tenant model sync
                    tenant = txn.tenant
                    tenant.plan = plan_name
                    tenant.save(update_fields=['plan'])

                else:
                    # Failed
                    txn.status = PaymentTransaction.StatusChoices.FAILED
                    txn.save(update_fields=['status', 'vnp_transaction_no', 'error_code'])

                    invoice = txn.invoice
                    invoice.status = Invoice.StatusChoices.OPEN  # Keep open for retry
                    invoice.save(update_fields=['status'])

                # Success confirm
                ipn_log.processed = True
                ipn_log.save(update_fields=['processed'])

        except PaymentTransaction.DoesNotExist:
            ipn_log.error_message = f"PaymentTransaction not found for txn_ref: {txn_ref}"
            ipn_log.save(update_fields=['error_message'])
            return Response({"RspCode": "01", "Message": "Order not found"}, status=status.HTTP_200_OK)
        except Exception as exc:
            ipn_log.error_message = f"Internal processing error: {exc!s}"
            ipn_log.save(update_fields=['error_message'])
            return Response({"RspCode": "99", "Message": f"Internal Error: {exc!s}"}, status=status.HTTP_200_OK)

        return Response({"RspCode": "00", "Message": "Confirm success"}, status=status.HTTP_200_OK)


@extend_schema(
    responses={200: envelope_response(PaymentStatusDataSerializer)},
)
class PaymentStatusCheckView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, txn_ref):
        """
        GET /api/v1/commercial/payments/status/<txn_ref>/
        """
        user = request.user
        try:
            tenant = user.core_tenant
        except CoreTenant.DoesNotExist:
            raise PermissionErrorException(
                detail="Tài khoản không được liên kết với bất kỳ Workspace/Tenant nào.",
                code="tenant_not_found"
            )

        txn = get_object_or_404(PaymentTransaction, txn_ref=txn_ref, tenant=tenant)
        return envelope({
            'txn_ref': txn.txn_ref,
            'amount': txn.amount,
            'status': txn.status,
            'vnp_transaction_no': txn.vnp_transaction_no,
            'updated_at': txn.updated_at.isoformat()
        })


# ─── GIAI ĐOẠN 2: STRIPE BILLING PORTAL INTEGRATION ────────────────────────

@extend_schema(
    responses={201: envelope_response(StripeSessionDataSerializer)},
)
@extend_schema(
    summary='StripeCheckoutSessionView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class StripeCheckoutSessionView(APIView):
    """
    POST /api/core/v1/partner/billing/stripe/session/
    
    Create a Stripe Checkout Session for subscription upgrade.
    Request Body: { "plan": "pro", "success_url": "...", "cancel_url": "..." }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        try:
            tenant = user.core_tenant
        except CoreTenant.DoesNotExist:
            raise PermissionErrorException(
                detail="Tài khoản không được liên kết với bất kỳ Workspace/Tenant nào.",
                code="tenant_not_found"
            )

        if not stripe_service.is_configured():
            raise ValidationErrorException(
                detail="Stripe thanh toán chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
                code="stripe_not_configured"
            )

        plan = request.data.get('plan')
        success_url = request.data.get('success_url')
        cancel_url = request.data.get('cancel_url')

        if not plan:
            raise ValidationErrorException(
                detail="plan là bắt buộc (starter, pro, enterprise).",
                code="validation_error"
            )

        if not success_url or not cancel_url:
            raise ValidationErrorException(
                detail="success_url và cancel_url là bắt buộc.",
                code="validation_error"
            )

        price_id = stripe_service.get_price_id(plan)
        if not price_id:
            raise ValidationErrorException(
                detail=f"Gói {plan} không có Stripe Price ID được cấu hình.",
                code="stripe_price_not_configured"
            )

        try:
            session = stripe_service.create_checkout_session(
                tenant=tenant,
                price_id=price_id,
                success_url=success_url,
                cancel_url=cancel_url,
            )
            return envelope({
                'session_id': session.id,
                'url': session.url,
            }, status=status.HTTP_201_CREATED)
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating checkout session: {e}")
            raise ValidationErrorException(
                detail=f"Lỗi Stripe: {e!s}",
                code="stripe_error"
            )
        except ValueError as e:
            logger.error(f"Value error creating checkout session: {e}")
            raise ValidationErrorException(
                detail=str(e),
                code="stripe_error"
            )


@extend_schema(
    responses={201: envelope_response(StripePortalDataSerializer)},
)
@extend_schema(
    summary='StripePortalSessionView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class StripePortalSessionView(APIView):
    """
    POST /api/core/v1/partner/billing/stripe/portal/
    
    Create a Stripe Customer Portal Session for self-service billing management.
    Request Body: { "return_url": "..." }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        try:
            tenant = user.core_tenant
        except CoreTenant.DoesNotExist:
            raise PermissionErrorException(
                detail="Tài khoản không được liên kết với bất kỳ Workspace/Tenant nào.",
                code="tenant_not_found"
            )

        if not stripe_service.is_configured():
            raise ValidationErrorException(
                detail="Stripe thanh toán chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
                code="stripe_not_configured"
            )

        return_url = request.data.get('return_url')
        if not return_url:
            raise ValidationErrorException(
                detail="return_url là bắt buộc.",
                code="validation_error"
            )

        if not tenant.stripe_customer_id:
            raise ValidationErrorException(
                detail="Tenant chưa có Stripe Customer. Vui lòng nâng cấp gói trước.",
                code="stripe_customer_not_found"
            )

        try:
            session = stripe_service.create_portal_session(
                tenant=tenant,
                return_url=return_url,
            )
            return envelope({
                'url': session.url,
            }, status=status.HTTP_201_CREATED)
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating portal session: {e}")
            raise ValidationErrorException(
                detail=f"Lỗi Stripe: {e!s}",
                code="stripe_error"
            )
        except ValueError as e:
            logger.error(f"Value error creating portal session: {e}")
            raise ValidationErrorException(
                detail=str(e),
                code="stripe_error"
            )

# ---------------------------------------------------------------------------
# License Key Views (License Portal MVP)
# ---------------------------------------------------------------------------


class LicenseKeyListView(generics.ListCreateAPIView):
    serializer_class = LicenseKeySerializer
    required_tenant_permissions = ("billing:read",)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]

    def get_queryset(self):
        tenant = resolve_tenant(self.request)
        return LicenseKey.objects.filter(tenant=tenant).order_by("-issued_at")

    def perform_create(self, serializer):
        tenant = resolve_tenant(self.request)
        active_count = LicenseKey.objects.filter(tenant=tenant, revoked_at__isnull=True).count()
        plan = getattr(tenant, "subscription", None)
        plan_code = plan.plan if plan else "free"
        quota = {"free": 0, "starter": 0, "pro": 5, "enterprise": 50, "custom": 100, "internal": 1000}.get(plan_code, 0)
        if active_count >= quota:
            raise ValidationErrorException(detail=f"License key quota exceeded ({active_count}/{quota}). Upgrade plan to issue more keys.")

        from django.utils import timezone
        from datetime import timedelta

        tier = self.request.data.get("tier", "pro")
        domain = self.request.data.get("domain_binding", "")
        dev_email = self.request.data.get("dev_email", "")
        duration_days = int(self.request.data.get("duration_days", 365))

        plan_tier_map = {
            "starter": [],
            "pro": ["pro", "academic"],
            "enterprise": ["pro", "enterprise", "academic"],
            "custom": ["pro", "enterprise", "academic"],
            "internal": ["pro", "enterprise", "academic"],
        }
        allowed_tiers = plan_tier_map.get(plan_code, [])
        if tier not in allowed_tiers:
            raise ValidationErrorException(detail=f'Tier "{tier}" not allowed for plan "{plan_code}". Upgrade plan.')

        expires_at = timezone.now() + timedelta(days=duration_days)

        from .license_service import LicenseService
        import os
        key_path = os.environ.get("LICENSE_PRIVATE_KEY_PATH", "/secrets/license-private.pem")
        svc = LicenseService(key_path)
        capabilities = self.request.data.get("capabilities", None)
        blob = svc.mint(tier=tier, domain=domain, expires_at=expires_at, capabilities=capabilities)

        serializer.save(
            tenant=tenant,
            key_blob=blob,
            tier=tier,
            domain_binding=domain,
            expires_at=expires_at,
            issued_by=self.request.user if hasattr(self.request, "user") else None,
            metadata={"dev_email": dev_email, "duration_days": duration_days},
        )


class LicenseKeyDetailView(generics.RetrieveAPIView):
    serializer_class = LicenseKeySerializer
    required_tenant_permissions = ("billing:read",)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]
    lookup_field = "id"

    def get_queryset(self):
        tenant = resolve_tenant(self.request)
        return LicenseKey.objects.filter(tenant=tenant)


class LicenseKeyRevokeView(APIView):
    required_tenant_permissions = ("billing:write",)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]

    def post(self, request, pk):
        tenant = resolve_tenant(request)
        key = get_object_or_404(LicenseKey, id=pk, tenant=tenant)
        if key.is_revoked:
            return Response(envelope(data={"message": "Already revoked"}), status=status.HTTP_200_OK)
        from django.utils import timezone
        key.revoked_at = timezone.now()
        key.save(update_fields=["revoked_at"])
        return Response(envelope(data={"message": "Revoked", "id": str(key.id)}), status=status.HTTP_200_OK)


class LicenseKeyRenewView(APIView):
    required_tenant_permissions = ("billing:write",)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]

    def post(self, request, pk):
        tenant = resolve_tenant(request)
        old_key = get_object_or_404(LicenseKey, id=pk, tenant=tenant)
        if old_key.is_revoked:
            return Response(envelope(data={"error": "Cannot renew revoked key"}), status=status.HTTP_400_BAD_REQUEST)

        duration_days = int(request.data.get("duration_days", 365))
        from django.utils import timezone
        from datetime import timedelta
        new_expires = timezone.now() + timedelta(days=duration_days)

        from .license_service import LicenseService
        import os
        key_path = os.environ.get("LICENSE_PRIVATE_KEY_PATH", "/secrets/license-private.pem")
        svc = LicenseService(key_path)
        blob = svc.mint(tier=old_key.tier, domain=old_key.domain_binding, expires_at=new_expires, capabilities=old_key.metadata.get("capabilities"))

        old_key.revoked_at = timezone.now()
        old_key.save(update_fields=["revoked_at"])

        new_key = LicenseKey.objects.create(
            tenant=tenant,
            key_blob=blob,
            tier=old_key.tier,
            domain_binding=old_key.domain_binding,
            expires_at=new_expires,
            issued_by=request.user if hasattr(request, "user") else None,
            metadata={**old_key.metadata, "renewed_from": str(old_key.id), "duration_days": duration_days},
        )
        return Response(envelope(data={"id": str(new_key.id), "expires_at": new_expires.isoformat(), "message": "Renewed"}), status=status.HTTP_201_CREATED)


class LicenseKeyRevealView(APIView):
    required_tenant_permissions = ("billing:write",)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]

    def get(self, request, pk):
        tenant = resolve_tenant(request)
        key = get_object_or_404(LicenseKey, id=pk, tenant=tenant)
        if key.is_revoked:
            return Response(envelope(data={"error": "Key is revoked"}), status=status.HTTP_400_BAD_REQUEST)
        return Response(envelope(data={"id": str(key.id), "key_blob": key.key_blob}), status=status.HTTP_200_OK)


class LicenseKeyQuotaView(APIView):
    required_tenant_permissions = ("billing:read",)
    permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]

    def get(self, request):
        tenant = resolve_tenant(request)
        active_count = LicenseKey.objects.filter(tenant=tenant, revoked_at__isnull=True).count()
        plan = getattr(tenant, "subscription", None)
        plan_code = plan.plan if plan else "free"
        quota = {"free": 0, "starter": 0, "pro": 5, "enterprise": 50, "custom": 100, "internal": 1000}.get(plan_code, 0)
        return Response(envelope(data={"used": active_count, "limit": quota, "plan": plan_code}), status=status.HTTP_200_OK)


class LicenseKeyStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        blob_hash = request.query_params.get("hash", "")
        if not blob_hash:
            return Response(envelope(data={"error": "hash required"}), status=status.HTTP_400_BAD_REQUEST)
        revoked = LicenseKey.objects.filter(key_blob__contains=blob_hash[:20], revoked_at__isnull=False).exists()
        return Response(envelope(data={"revoked": revoked}), status=status.HTTP_200_OK)
