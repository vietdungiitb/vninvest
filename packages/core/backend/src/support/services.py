from django.contrib.auth.models import User
from django.conf import settings

from .tasks import send_ticket_email


def get_staff_recipients():
    return list(
        User.objects.filter(is_staff=True, is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )


def build_ticket_deep_link(ticket_code):
    base_url = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:3000').rstrip('/')
    return f'{base_url}/support?ticket={ticket_code}'


def queue_new_ticket_email(ticket):
    recipients = get_staff_recipients()
    if not recipients:
        return

    subject = f'[Support] New Ticket Created: {ticket.ticket_code}'
    message = (
        f'Ticket: {ticket.ticket_code}\n'
        f'Subject: {ticket.subject}\n'
        f'Requester: {ticket.requester.username}\n'
        f'Priority: {ticket.priority}\n'
        f'Category: {ticket.category}\n'
        f'Open link: {build_ticket_deep_link(ticket.ticket_code)}\n'
    )
    send_ticket_email.delay(subject=subject, message=message, recipient_list=recipients)


def queue_ticket_reply_email(ticket, to_user_email):
    if not to_user_email:
        return

    subject = f'[VNInvest] Re: {ticket.subject} - Feedback from Support Team'
    message = (
        f'Ticket: {ticket.ticket_code}\n'
        f'Subject: {ticket.subject}\n'
        f'Open link: {build_ticket_deep_link(ticket.ticket_code)}\n'
    )
    send_ticket_email.delay(subject=subject, message=message, recipient_list=[to_user_email])
