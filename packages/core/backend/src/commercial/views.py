from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.utils import timezone
from django.shortcuts import get_object_or_404
import uuid
import logging

from identity_access.models import CoreTenant
from vninvest_core.pagination import CoreCursorPagination
from vninvest_core.exceptions import (
    ValidationErrorException,
    ConflictErrorException,
    PermissionErrorException,
)

from .models import Invoice, QuotaRecord, Subscription, PaymentTransaction, VNPayIPNLog
from .serializers import InvoiceSerializer, QuotaRecordSerializer, SubscriptionSerializer
from .vnpay_service import VNPayService

logger = logging.getLogger(__name__)


class SubscriptionDetailView(generics.RetrieveAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return generics.get_object_or_404(Subscription, tenant=tenant)


class QuotaListView(generics.ListAPIView):
    serializer_class = QuotaRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CoreCursorPagination

    def get_queryset(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return QuotaRecord.objects.filter(tenant=tenant).order_by('-period_start')


class InvoiceListView(generics.ListAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = CoreCursorPagination

    def get_queryset(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return Invoice.objects.filter(tenant=tenant).order_by('-created_at')


class PublicLegalPagesView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({'results': []})


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
        plan = request.data.get('plan')

        if not amount or not plan:
            raise ValidationErrorException(
                detail="amount và plan là bắt buộc.",
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
                    due_date=(timezone.now() + timezone.timedelta(days=7)).date()
                )

            # Generate unique payment txn_ref
            txn_ref = f"TXN-{uuid.uuid4().hex[:16].upper()}"
            client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')

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
                status=PaymentTransaction.StatusChoices.PENDING,
                pay_url=pay_url
            )

        return Response({
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
                    plan_name = "pro"  # Default fallback
                    if "pro" in invoice.invoice_number.lower():
                        plan_name = "pro"
                    elif "starter" in invoice.invoice_number.lower():
                        plan_name = "starter"
                    elif "enterprise" in invoice.invoice_number.lower():
                        plan_name = "enterprise"

                    # Create or update subscription
                    sub, created = Subscription.objects.get_or_create(
                        tenant=txn.tenant,
                        defaults={
                            'plan': plan_name,
                            'status': Subscription.StatusChoices.ACTIVE,
                            'current_period_start': timezone.now().date(),
                            'current_period_end': (timezone.now() + timezone.timedelta(days=30)).date()
                        }
                    )

                    if not created:
                        sub.plan = plan_name
                        sub.status = Subscription.StatusChoices.ACTIVE
                        sub.current_period_start = timezone.now().date()
                        # If existing active subscription, extend the end date
                        if sub.current_period_end >= timezone.now().date():
                            sub.current_period_end = sub.current_period_end + timezone.timedelta(days=30)
                        else:
                            sub.current_period_end = (timezone.now() + timezone.timedelta(days=30)).date()
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
        return Response({
            'txn_ref': txn.txn_ref,
            'amount': txn.amount,
            'status': txn.status,
            'vnp_transaction_no': txn.vnp_transaction_no,
            'updated_at': txn.updated_at.isoformat()
        }, status=status.HTTP_200_OK)`n