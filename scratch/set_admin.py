import django, os, sys
os.chdir("/app")
sys.path.insert(0, "/app")
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
django.setup()
from django.contrib.auth.models import User
u = User.objects.get(username="admin")
u.set_password("test@123456")
u.is_superuser = True
u.is_staff = True
u.save()
from portfolio.models import UserConfig
uc, _ = UserConfig.objects.get_or_create(user=u)
uc.email_verified = True
uc.plan = "admin"
uc.save()
print("OK: admin password=test@123456 superuser=True email_verified=True plan=admin")
