from unittest.mock import patch
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from support.models import SenderRole, SupportTicket, TicketAuditLog, TicketMessage, TicketStatus


class SupportTicketApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='support-user',
            email='support-user@example.com',
            password='Test@123456',
        )
        self.other_user = User.objects.create_user(
            username='support-other',
            email='support-other@example.com',
            password='Test@123456',
        )
        self.staff_user = User.objects.create_user(
            username='support-staff',
            email='support-staff@example.com',
            password='Test@123456',
            is_staff=True,
        )

    @patch('support.services.send_ticket_email.delay', return_value=1)
    def test_create_and_list_own_ticket(self, _mock_send_email):
        self.client.force_authenticate(user=self.user)

        create_response = self.client.post(
            '/api/support/tickets/',
            {
                'subject': 'Khong tai duoc du lieu danh muc tren dashboard',
                'category': 'TECHNICAL',
                'priority': 'HIGH',
                'body': 'Toi gap loi khi mo dashboard va du lieu danh muc khong hien thi day du.',
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['status'], TicketStatus.OPEN)
        self.assertTrue(create_response.data['ticket_code'].startswith('VNST-'))

        list_response = self.client.get('/api/support/tickets/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['count'], 1)
        self.assertEqual(list_response.data['results'][0]['subject'], create_response.data['subject'])
        self.assertEqual(TicketMessage.objects.count(), 1)
        self.assertTrue(TicketAuditLog.objects.filter(action='CREATED').exists())

    def test_user_cannot_view_other_users_ticket(self):
        ticket = SupportTicket.objects.create(
            requester=self.other_user,
            subject='Private ticket for another user',
            category='ACCOUNT',
            priority='MEDIUM',
        )
        TicketMessage.objects.create(
            ticket=ticket,
            sender=self.other_user,
            sender_role=SenderRole.USER,
            body='This ticket should stay private to the owner.',
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/support/tickets/{ticket.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_reply_reopens_resolved_ticket(self):
        ticket = SupportTicket.objects.create(
            requester=self.user,
            subject='Resolved ticket can be reopened by requester',
            category='TECHNICAL',
            priority='MEDIUM',
            status=TicketStatus.RESOLVED,
        )
        TicketMessage.objects.create(
            ticket=ticket,
            sender=self.staff_user,
            sender_role=SenderRole.STAFF,
            body='Issue was resolved from staff perspective.',
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/support/tickets/{ticket.id}/reply/',
            {'body': 'Van con loi, vui long kiem tra lai ho toi.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, TicketStatus.REOPENED)
        self.assertFalse(ticket.last_message_by_staff)
        self.assertTrue(TicketAuditLog.objects.filter(ticket=ticket, action='STATUS_CHANGED').exists())

    @patch('support.services.send_ticket_email.delay', return_value=1)
    def test_staff_patch_and_reply_updates_ticket(self, _mock_send_email):
        ticket = SupportTicket.objects.create(
            requester=self.user,
            subject='Need staff assignment and first response',
            category='BILLING',
            priority='LOW',
            status=TicketStatus.OPEN,
        )
        TicketMessage.objects.create(
            ticket=ticket,
            sender=self.user,
            sender_role=SenderRole.USER,
            body='Please check this billing question for me.',
        )

        self.client.force_authenticate(user=self.staff_user)
        patch_response = self.client.patch(
            f'/api/support/staff/tickets/{ticket.id}/',
            {
                'status': 'IN_PROGRESS',
                'priority': 'URGENT',
                'assignee_id': self.staff_user.id,
            },
            format='json',
        )

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, TicketStatus.IN_PROGRESS)
        self.assertEqual(ticket.priority, 'URGENT')
        self.assertEqual(ticket.assignee_id, self.staff_user.id)

        reply_response = self.client.post(
            f'/api/support/staff/tickets/{ticket.id}/reply/',
            {'body': 'Support da tiep nhan va dang xu ly ticket cua ban.'},
            format='json',
        )

        self.assertEqual(reply_response.status_code, status.HTTP_201_CREATED)
        ticket.refresh_from_db()
        self.assertIsNotNone(ticket.first_response_at)
        self.assertTrue(ticket.last_message_by_staff)
        self.assertTrue(TicketAuditLog.objects.filter(ticket=ticket, action='PRIORITY_CHANGED').exists())
        self.assertTrue(TicketAuditLog.objects.filter(ticket=ticket, action='ASSIGNEE_CHANGED').exists())

    def test_staff_dashboard_requires_staff_permission(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/support/staff/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_dashboard_returns_queue_and_sla_metrics(self):
        now = timezone.now()
        ticket_open = SupportTicket.objects.create(
            requester=self.user,
            subject='Open urgent ticket',
            category='TECHNICAL',
            priority='URGENT',
            status=TicketStatus.OPEN,
        )
        ticket_open.created_at = now - timedelta(hours=3)
        ticket_open.save(update_fields=['created_at'])

        ticket_resolved = SupportTicket.objects.create(
            requester=self.other_user,
            subject='Resolved ticket with response',
            category='ACCOUNT',
            priority='MEDIUM',
            status=TicketStatus.RESOLVED,
            first_response_at=now - timedelta(hours=1),
            resolved_at=now - timedelta(minutes=20),
        )
        ticket_resolved.created_at = now - timedelta(hours=4)
        ticket_resolved.save(update_fields=['created_at'])

        ticket_closed = SupportTicket.objects.create(
            requester=self.other_user,
            subject='Closed ticket record',
            category='BILLING',
            priority='LOW',
            status=TicketStatus.CLOSED,
            first_response_at=now - timedelta(hours=10),
            closed_at=now - timedelta(minutes=30),
        )
        ticket_closed.created_at = now - timedelta(hours=12)
        ticket_closed.save(update_fields=['created_at'])

        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/api/support/staff/dashboard/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['queue']['active_total'], 1)
        self.assertEqual(response.data['queue']['urgent_active'], 1)
        self.assertEqual(response.data['throughput']['resolved_last_24h'], 1)
        self.assertEqual(response.data['throughput']['closed_last_24h'], 1)
        self.assertIsNotNone(response.data['sla']['avg_first_response_seconds'])
        self.assertIsNotNone(response.data['sla']['avg_resolution_seconds'])