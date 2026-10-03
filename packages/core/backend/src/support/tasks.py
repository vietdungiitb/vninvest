from celery import shared_task

from identity_access.mail_service import send_system_email


@shared_task(bind=True, name='support.tasks.send_ticket_email', max_retries=2)
def send_ticket_email(self, subject, message, recipient_list):
    if not recipient_list:
        return 0
    try:
        return send_system_email(
            subject=subject,
            message=message,
            recipient_list=recipient_list,
            fail_silently=False,
        )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=20)
