from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from vninvest_core.client_ip import get_client_ip

from django.utils import timezone
from django.shortcuts import get_object_or_404
import uuid
import logging
import stripe

from identity_access.models import CoreTenant
from identity_access.utils.resolve_tenant import resolve_tenant
from vninvest_core.pagination import CoreCursorPagination
from vninvest_core.exceptions import (
    ValidationErrorException,
    ConflictErrorException,
    PermissionErrorException,
)

from .permissions import RequiresTenantPermission
from .envelope import envelope
from .models import Invoice, QuotaRecord, Subscription, PaymentTransaction, VNPayIPNLog
from .serializers import InvoiceSerializer, QuotaRecordSerializer, SubscriptionSerializer
from .vnpay_service import VNPayService
from .stripe_service import stripe_service
from .plan_catalog import (
    CANONICAL_PLANS,
    PLAN_PRICES_VND,
    PLAN_DURATIONS_DAYS,
    normalize_plan,
)

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


class PublicLegalPagesView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return envelope({'results': []})


# ─── GIAI ĐOẠN 2: VNPAY PAYMENT GATEWAY INTEGRATION ────────────────────────

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
            ipn_log.error_message = f"Internal processing error: {str(exc)}"
            ipn_log.save(update_fields=['error_message'])
            return Response({"RspCode": "99", "Message": f"Internal Error: {str(exc)}"}, status=status.HTTP_200_OK)

        return Response({"RspCode": "00", "Message": "Confirm success"}, status=status.HTTP_200_OK)


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
                detail=f"Lỗi Stripe: {str(e)}",
                code="stripe_error"
            )
        except ValueError as e:
            logger.error(f"Value error creating checkout session: {e}")
            raise ValidationErrorException(
                detail=str(e),
                code="stripe_error"
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
                detail=f"Lỗi Stripe: {str(e)}",
                code="stripe_error"
            )
        except ValueError as e:
            logger.error(f"Value error creating portal session: {e}")
            raise ValidationErrorException(
                detail=str(e),
                code="stripe_error"
            )
