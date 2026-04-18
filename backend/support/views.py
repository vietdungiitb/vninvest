from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from .models import SenderRole, SupportTicket, TicketAttachment, TicketAuditLog, TicketMessage, TicketStatus
from .permissions import IsStaffUser, IsTicketOwnerOrStaff
from .serializers import (
    CreateTicketSerializer,
    StaffTicketUpdateSerializer,
    SupportTicketListSerializer,
    TicketMessageSerializer,
    TicketReplySerializer,
)
from .services import queue_new_ticket_email, queue_ticket_reply_email


ALLOWED_ATTACHMENT_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf', 'txt', 'csv'}
ALLOWED_ATTACHMENT_MIME_PREFIXES = (
    'image/',
    'application/pdf',
    'text/plain',
    'text/csv',
)
MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024
MAX_ATTACHMENTS_PER_MESSAGE = 3


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _validate_and_create_attachments(message, files):
    files = files[:MAX_ATTACHMENTS_PER_MESSAGE]
    for file_obj in files:
        file_name = str(getattr(file_obj, 'name', ''))
        ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
        mime_type = str(getattr(file_obj, 'content_type', '') or '')
        size_bytes = int(getattr(file_obj, 'size', 0) or 0)

        if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
            continue
        if not mime_type.startswith(ALLOWED_ATTACHMENT_MIME_PREFIXES):
            continue
        if size_bytes <= 0 or size_bytes > MAX_ATTACHMENT_SIZE_BYTES:
            continue

        TicketAttachment.objects.create(
            message=message,
            file=file_obj,
            original_name=file_name,
            mime_type=mime_type,
            size_bytes=size_bytes,
            is_safe=True,
        )


def _ticket_query_for_user(user):
    if user.is_staff:
        return SupportTicket.objects.select_related('requester', 'assignee').all()
    return SupportTicket.objects.select_related('requester', 'assignee').filter(requester=user)


def _write_audit(ticket, actor, action, old_value=None, new_value=None):
    TicketAuditLog.objects.create(
        ticket=ticket,
        actor=actor,
        action=action,
        old_value=old_value or {},
        new_value=new_value or {},
    )


class TicketListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        queryset = _ticket_query_for_user(request.user)
        status_filter = request.query_params.get('status')
        category_filter = request.query_params.get('category')
        search_query = str(request.query_params.get('q', '')).strip()
        ordering = request.query_params.get('ordering', '-updated_at')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if category_filter:
            queryset = queryset.filter(category=category_filter)
        if search_query:
            queryset = queryset.filter(
                Q(ticket_code__icontains=search_query)
                | Q(subject__icontains=search_query)
            )

        allowed_ordering = {'updated_at', '-updated_at', 'created_at', '-created_at', 'priority', '-priority'}
        if ordering not in allowed_ordering:
            ordering = '-updated_at'
        queryset = queryset.order_by(ordering)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = SupportTicketListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        self.throttle_classes = [ScopedRateThrottle]
        self.throttle_scope = 'support_ticket_create'
        for throttle in self.get_throttles():
            if not throttle.allow_request(request, self):
                return self.throttled(request, throttle.wait())

        serializer = CreateTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ticket = SupportTicket.objects.create(
            requester=request.user,
            subject=data['subject'],
            category=data['category'],
            priority=data.get('priority') or 'MEDIUM',
            status=TicketStatus.OPEN,
            last_message_at=timezone.now(),
            last_message_by_staff=bool(request.user.is_staff),
        )

        message = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_role=SenderRole.STAFF if request.user.is_staff else SenderRole.USER,
            body=data['body'],
        )
        _validate_and_create_attachments(message, request.FILES.getlist('attachments'))

        _write_audit(ticket, request.user, 'CREATED', old_value={}, new_value={'status': ticket.status})
        queue_new_ticket_email(ticket)

        return Response(SupportTicketListSerializer(ticket).data, status=status.HTTP_201_CREATED)


class TicketDetailView(APIView):
    permission_classes = [IsAuthenticated, IsTicketOwnerOrStaff]

    def get(self, request, ticket_id):
        ticket = _ticket_query_for_user(request.user).filter(id=ticket_id).first()
        if not ticket:
            return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, ticket)

        message_queryset = ticket.messages.select_related('sender').prefetch_related('attachments').order_by('created_at')
        message_paginator = StandardResultsSetPagination()
        message_page = message_paginator.paginate_queryset(message_queryset, request)
        message_payload = message_paginator.get_paginated_response(TicketMessageSerializer(message_page, many=True).data).data

        payload = {
            'ticket': SupportTicketListSerializer(ticket).data,
            'messages': message_payload,
        }
        return Response(payload)


class TicketReplyView(APIView):
    permission_classes = [IsAuthenticated, IsTicketOwnerOrStaff]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, ticket_id):
        self.throttle_classes = [ScopedRateThrottle]
        self.throttle_scope = 'support_ticket_reply'
        for throttle in self.get_throttles():
            if not throttle.allow_request(request, self):
                return self.throttled(request, throttle.wait())

        ticket = _ticket_query_for_user(request.user).filter(id=ticket_id).first()
        if not ticket:
            return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, ticket)

        if ticket.status == TicketStatus.CLOSED and not request.user.is_staff:
            return Response({'detail': 'Closed ticket cannot receive new replies.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TicketReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_role=SenderRole.STAFF if request.user.is_staff else SenderRole.USER,
            body=serializer.validated_data['body'],
        )
        _validate_and_create_attachments(message, request.FILES.getlist('attachments'))

        old_status = ticket.status
        now = timezone.now()
        if request.user.is_staff:
            if not ticket.first_response_at:
                ticket.first_response_at = now
            if ticket.status in {TicketStatus.OPEN, TicketStatus.REOPENED}:
                ticket.status = TicketStatus.IN_PROGRESS
        else:
            if ticket.status == TicketStatus.RESOLVED:
                ticket.status = TicketStatus.REOPENED

        ticket.last_message_at = now
        ticket.last_message_by_staff = bool(request.user.is_staff)
        ticket.save(update_fields=['status', 'first_response_at', 'last_message_at', 'last_message_by_staff', 'updated_at'])

        if old_status != ticket.status:
            _write_audit(ticket, request.user, 'STATUS_CHANGED', old_value={'status': old_status}, new_value={'status': ticket.status})

        if request.user.is_staff:
            queue_ticket_reply_email(ticket, ticket.requester.email)

        return Response(TicketMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class TicketReopenView(APIView):
    permission_classes = [IsAuthenticated, IsTicketOwnerOrStaff]

    def post(self, request, ticket_id):
        ticket = _ticket_query_for_user(request.user).filter(id=ticket_id).first()
        if not ticket:
            return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, ticket)

        old_status = ticket.status
        if old_status not in {TicketStatus.RESOLVED, TicketStatus.CLOSED}:
            return Response({'detail': 'Only resolved or closed tickets can be reopened.'}, status=status.HTTP_400_BAD_REQUEST)

        if old_status == TicketStatus.CLOSED and not request.user.is_staff:
            return Response({'detail': 'Only staff can reopen closed tickets.'}, status=status.HTTP_403_FORBIDDEN)

        ticket.status = TicketStatus.REOPENED
        ticket.closed_at = None
        ticket.resolved_at = None
        ticket.save(update_fields=['status', 'closed_at', 'resolved_at', 'updated_at'])

        _write_audit(ticket, request.user, 'REOPENED', old_value={'status': old_status}, new_value={'status': ticket.status})
        return Response(SupportTicketListSerializer(ticket).data)


class StaffTicketListView(APIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request):
        queryset = SupportTicket.objects.select_related('requester', 'assignee').all()
        status_filter = request.query_params.get('status')
        priority_filter = request.query_params.get('priority')
        assignee_filter = request.query_params.get('assignee_id')
        search_query = str(request.query_params.get('q', '')).strip()

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)
        if assignee_filter:
            queryset = queryset.filter(assignee_id=assignee_filter)
        if search_query:
            queryset = queryset.filter(
                Q(ticket_code__icontains=search_query)
                | Q(subject__icontains=search_query)
                | Q(requester__username__icontains=search_query)
            )

        queryset = queryset.order_by('-updated_at')
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = SupportTicketListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class StaffTicketPatchView(APIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def patch(self, request, ticket_id):
        ticket = SupportTicket.objects.select_related('requester', 'assignee').filter(id=ticket_id).first()
        if not ticket:
            return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = StaffTicketUpdateSerializer(
            data=request.data,
            context={'ticket': ticket, 'actor_is_staff': True},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        old_status = ticket.status
        old_priority = ticket.priority
        old_assignee_id = ticket.assignee_id

        status_changed = False
        if 'status' in data:
            status_changed = data['status'] != ticket.status
            ticket.status = data['status']
            now = timezone.now()
            if ticket.status == TicketStatus.RESOLVED:
                ticket.resolved_at = now
                ticket.closed_at = None
            elif ticket.status == TicketStatus.CLOSED:
                ticket.closed_at = now
            elif ticket.status in {TicketStatus.REOPENED, TicketStatus.IN_PROGRESS, TicketStatus.OPEN}:
                ticket.closed_at = None
                if ticket.status != TicketStatus.RESOLVED:
                    ticket.resolved_at = None

        if 'priority' in data:
            ticket.priority = data['priority']

        if 'assignee_id' in data:
            if data['assignee_id'] is None:
                ticket.assignee = None
            else:
                assignee = User.objects.filter(id=data['assignee_id'], is_staff=True).first()
                if not assignee:
                    return Response({'detail': 'Invalid staff assignee.'}, status=status.HTTP_400_BAD_REQUEST)
                ticket.assignee = assignee

        ticket.save()

        if status_changed:
            _write_audit(ticket, request.user, 'STATUS_CHANGED', old_value={'status': old_status}, new_value={'status': ticket.status})
        if old_priority != ticket.priority:
            _write_audit(ticket, request.user, 'PRIORITY_CHANGED', old_value={'priority': old_priority}, new_value={'priority': ticket.priority})
        if old_assignee_id != ticket.assignee_id:
            _write_audit(ticket, request.user, 'ASSIGNEE_CHANGED', old_value={'assignee_id': old_assignee_id}, new_value={'assignee_id': ticket.assignee_id})

        return Response(SupportTicketListSerializer(ticket).data)


class StaffTicketReplyView(APIView):
    permission_classes = [IsAuthenticated, IsStaffUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, ticket_id):
        ticket = SupportTicket.objects.select_related('requester').filter(id=ticket_id).first()
        if not ticket:
            return Response({'detail': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = TicketReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_role=SenderRole.STAFF,
            body=serializer.validated_data['body'],
        )
        _validate_and_create_attachments(message, request.FILES.getlist('attachments'))

        now = timezone.now()
        if not ticket.first_response_at:
            ticket.first_response_at = now
        if ticket.status in {TicketStatus.OPEN, TicketStatus.REOPENED}:
            old_status = ticket.status
            ticket.status = TicketStatus.IN_PROGRESS
            _write_audit(ticket, request.user, 'STATUS_CHANGED', old_value={'status': old_status}, new_value={'status': ticket.status})

        ticket.last_message_at = now
        ticket.last_message_by_staff = True
        ticket.save(update_fields=['status', 'first_response_at', 'last_message_at', 'last_message_by_staff', 'updated_at'])

        queue_ticket_reply_email(ticket, ticket.requester.email)
        return Response(TicketMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class StaffSupportDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get(self, request):
        now = timezone.now()
        active_statuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED]
        queue_qs = SupportTicket.objects.all()
        active_qs = queue_qs.filter(status__in=active_statuses)

        total_active = active_qs.count()
        unassigned_active = active_qs.filter(assignee__isnull=True).count()
        urgent_active = active_qs.filter(priority='URGENT').count()
        reopened_active = active_qs.filter(status=TicketStatus.REOPENED).count()
        resolved_last_24h = queue_qs.filter(resolved_at__gte=now - timedelta(hours=24)).count()
        closed_last_24h = queue_qs.filter(closed_at__gte=now - timedelta(hours=24)).count()

        first_response_seconds = []
        first_response_breach_8h = 0
        urgent_first_response_breach_2h = 0
        resolution_seconds = []
        resolution_breach_72h = 0

        for ticket in queue_qs.only('created_at', 'first_response_at', 'resolved_at', 'priority'):
            if ticket.first_response_at:
                delta_seconds = max(0, int((ticket.first_response_at - ticket.created_at).total_seconds()))
                first_response_seconds.append(delta_seconds)
                if delta_seconds > 8 * 3600:
                    first_response_breach_8h += 1
                if ticket.priority == 'URGENT' and delta_seconds > 2 * 3600:
                    urgent_first_response_breach_2h += 1

            if ticket.resolved_at:
                resolve_seconds = max(0, int((ticket.resolved_at - ticket.created_at).total_seconds()))
                resolution_seconds.append(resolve_seconds)
                if resolve_seconds > 72 * 3600:
                    resolution_breach_72h += 1

        avg_first_response_seconds = int(sum(first_response_seconds) / len(first_response_seconds)) if first_response_seconds else None
        avg_resolution_seconds = int(sum(resolution_seconds) / len(resolution_seconds)) if resolution_seconds else None

        payload = {
            'generated_at': now.isoformat(),
            'queue': {
                'active_total': total_active,
                'unassigned_active': unassigned_active,
                'urgent_active': urgent_active,
                'reopened_active': reopened_active,
            },
            'throughput': {
                'resolved_last_24h': resolved_last_24h,
                'closed_last_24h': closed_last_24h,
            },
            'sla': {
                'avg_first_response_seconds': avg_first_response_seconds,
                'avg_resolution_seconds': avg_resolution_seconds,
                'first_response_breach_8h': first_response_breach_8h,
                'urgent_first_response_breach_2h': urgent_first_response_breach_2h,
                'resolution_breach_72h': resolution_breach_72h,
            },
        }
        return Response(payload)
