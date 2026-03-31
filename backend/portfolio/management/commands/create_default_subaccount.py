from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from portfolio.models import SubAccount

class Command(BaseCommand):
    help = 'Create default SubAccount for existing users'

    def handle(self, *args, **options):
        users = User.objects.all()
        for user in users:
            if not SubAccount.objects.filter(user=user).exists():
                SubAccount.objects.create(
                    name='Default Cash',
                    type='1',
                    user=user,
                    margin_ratio=Decimal('1.000')
                )
                self.stdout.write(
                    self.style.SUCCESS(f'Created default SubAccount for {user.username}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'SubAccount already exists for {user.username}')
                )
