import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE","vninvest_core.settings")
django.setup()
from identity_access.models import SystemMailConfig
c = SystemMailConfig.objects.first()
if not c:
    print("NO CONFIG FOUND")
else:
    print("PROVIDER:", c.provider)
    print("EMAIL:", c.email_address)
    sa = c.get_google_service_account_json()
    print("SA_JSON:", sa[:600] if sa else "EMPTY/NULL")
