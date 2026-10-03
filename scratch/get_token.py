import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
u = User.objects.get(username="admin")
t = RefreshToken.for_user(u)
print(str(t.access_token))
