from rest_framework import serializers

from .models import (
    SenderRole,
    SupportTicket,
    TicketAttachment,
    TicketAuditLog,
    TicketMessage,
    TicketPriority,
    TicketStatus,
)


class TicketAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketAttachment
        fields = ['id', 'original_name', 'mime_type', 'size_bytes', 'created_at']


class TicketMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    attachments = TicketAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = TicketMessage
        fields = [
            'id',
            'sender',
            'sender_username',
            'sender_role',
            'body',
            'attachments',
            'created_at',
        ]
        read_only_fields = fields


class SupportTicketListSerializer(serializers.ModelSerializer):
    requester_username = serializers.CharField(source='requester.username', read_only=True)
    assignee_username = serializers.CharField(source='assignee.username', read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id',
            'ticket_code',
            'requester',
            'requester_username',
            'subject',
            'category',
            'priority',
            'status',
            'assignee',
            'assignee_username',
            'first_response_at',
            'resolved_at',
            'closed_at',
            'last_message_at',
            'last_message_by_staff',
            'created_at',
            'updated_at',
        ]


class CreateTicketSerializer(serializers.Serializer):
    subject = serializers.CharField(min_length=10, max_length=255)
    category = serializers.CharField(max_length=20)
    priority = serializers.ChoiceField(choices=TicketPriority.choices, default=TicketPriority.MEDIUM)
    body = serializers.CharField(min_length=20)

    def validate_category(self, value):
        valid = {choice[0] for choice in SupportTicket._meta.get_field('category').choices}
        if value not in valid:
            raise serializers.ValidationError('Unsupported category.')
        return value


class TicketReplySerializer(serializers.Serializer):
    body = serializers.CharField(min_length=2)


class StaffTicketUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=TicketStatus.choices, required=False)
    priority = serializers.ChoiceField(choices=TicketPriority.choices, required=False)
    assignee_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field is required.')

        ticket = self.context['ticket']
        actor_is_staff = bool(self.context.get('actor_is_staff'))
        next_status = attrs.get('status')
        if next_status and not ticket.can_transition(next_status, actor_is_staff=actor_is_staff):
            raise serializers.ValidationError({'status': 'Invalid state transition.'})
        return attrs


class TicketAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = TicketAuditLog
        fields = ['id', 'action', 'actor', 'actor_username', 'old_value', 'new_value', 'created_at']
