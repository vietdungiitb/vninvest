import os
import sys

import django

os.chdir("/app")
sys.path.insert(0, "/app")
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
django.setup()

from django.contrib.auth.models import User

# The admin password used to be hardcoded here and echoed to stdout, which
# committed a superuser credential to git. It must be supplied by the operator.
password = os.environ.get("ADMIN_PASSWORD", "").strip()
if not password:
    sys.exit("ADMIN_PASSWORD is required (e.g. -e ADMIN_PASSWORD=... docker run ...)")

username = os.environ.get("ADMIN_USERNAME", "admin")
u = User.objects.get(username=username)
u.set_password(password)
u.is_superuser = True
u.is_staff = True
u.save()

from portfolio.models import UserConfig

uc, _ = UserConfig.objects.get_or_create(user=u)
uc.email_verified = True
uc.plan = "admin"
uc.save()

print(f"OK: {username} password=<set from ADMIN_PASSWORD> superuser=True email_verified=True plan=admin")
