"""
Data migration: migrate existing AI config from UserProfile.preferences
to the new UserAICredential model (BYOK SSOT).

Reads `preferences.api_key` and `preferences.ai_provider` (or metadata from
SystemAISettings) and creates a UserAICredential record for each user that
has a UserProfile with AI configuration.
"""
from django.db import migrations

LEGACY_PROVIDER_MAP = {
    'openai': 'openai',
    'gemini': 'gemini',
    'claude': 'claude',
    'openclaw': 'openclaw',
    'copilot': 'copilot',
}


def forwards(apps, schema_editor):
    UserAICredential = apps.get_model('advisory', 'UserAICredential')
    UserProfile = apps.get_model('identity_access', 'UserProfile')
    SystemAISettingsModel = apps.get_model('advisory', 'SystemAISettings')

    for profile in UserProfile.objects.select_related('user').iterator():
        prefs = profile.preferences
        if not prefs or not isinstance(prefs, dict):
            continue

        api_key = prefs.get('api_key', '')
        ai_provider = str(prefs.get('ai_provider', '') or 'openai').strip().lower()
        ai_provider = LEGACY_PROVIDER_MAP.get(ai_provider, 'openai')
        ai_model = str(prefs.get('ai_model', '') or 'gpt-4o-mini').strip()

        # Skip if no API key and provider is not openclaw
        if not api_key and ai_provider not in ('openclaw', 'local'):
            continue

        # Check if UserAICredential already exists
        if UserAICredential.objects.filter(user=profile.user).exists():
            continue

        UserAICredential.objects.create(
            user=profile.user,
            ai_provider=ai_provider,
            ai_model=ai_model,
            encrypted_api_key=api_key,
            custom_endpoint='',
            is_active=True,
        )

    # Also migrate system-level encrypted key if no UserAICredential exists
    # for users who have only used the system default (openclaw).
    # This ensures every user with a profile gets a baseline credential.
    sys_settings = SystemAISettingsModel.objects.filter(is_active=True).order_by('-updated_at').first()
    if sys_settings and sys_settings.metadata:
        sys_encrypted_key = sys_settings.metadata.get('encrypted_api_key', '')
        for profile in UserProfile.objects.select_related('user').iterator():
            if UserAICredential.objects.filter(user=profile.user).exists():
                continue
            UserAICredential.objects.create(
                user=profile.user,
                ai_provider='openclaw',
                ai_model=sys_settings.ai_model or 'gpt-4o-mini',
                encrypted_api_key=sys_encrypted_key,
                custom_endpoint='',
                is_active=True,
            )


def backwards(apps, schema_editor):
    UserAICredential = apps.get_model('advisory', 'UserAICredential')
    UserAICredential.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('advisory', '0003_useraicredential'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
