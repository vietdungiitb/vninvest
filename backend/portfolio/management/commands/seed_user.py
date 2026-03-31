from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Create test superuser testuser/Test@123456'

    def handle(self, *args, **options):
        if User.objects.filter(username='testuser').exists():
            self.stdout.write(self.style.SUCCESS('testuser already exists'))
            return

        user = User.objects.create_superuser(
            username='testuser',
            email='test@vninvest.vn',
            password='Test@123456'
        )
        self.stdout.write(self.style.SUCCESS(f'Created superuser {user.username}'))

