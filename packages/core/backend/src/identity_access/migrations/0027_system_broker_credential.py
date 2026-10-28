"""B2.2: SystemBrokerCredential + copy system DNSE row cũ (nếu có)."""
from django.db import migrations, models


def _copy_system_dnse(apps, schema_editor):
    UserDNSECredential = apps.get_model('identity_access', 'UserDNSECredential')
    SystemBrokerCredential = apps.get_model('identity_access', 'SystemBrokerCredential')
    row = UserDNSECredential.objects.filter(is_system_provider=True).first()
    if row is None:
        return
    try:
        import json

        from identity_access.models import _decrypt_credential, _encrypt_credential
        api_key = _decrypt_credential(bytes(row.api_key_encrypted or b''))
        api_secret = _decrypt_credential(bytes(row.api_secret_encrypted or b''))
    except Exception:
        return  # thiếu key env → bỏ qua, không fail migration
    if not api_key or not api_secret:
        return
    obj, created = SystemBrokerCredential.objects.get_or_create(
        provider='dnse',
        defaults={
            'secrets_cipher': _encrypt_credential(json.dumps({
                'client_id': api_key, 'client_secret': api_secret})),
            'allowed_purposes': ['backfill'],
            'is_verified': bool(row.is_verified),
            'last_verified_at': row.last_verified_at,
        },
    )
    if not created and not obj.secrets_cipher:
        obj.secrets_cipher = _encrypt_credential(json.dumps({
            'client_id': api_key, 'client_secret': api_secret}))
        obj.save(update_fields=['secrets_cipher', 'updated_at'])


def _copy_reverse(apps, schema_editor):
    SystemBrokerCredential = apps.get_model('identity_access', 'SystemBrokerCredential')
    SystemBrokerCredential.objects.filter(provider='dnse').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0026_userprofile_avatar_url'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemBrokerCredential',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('dnse', 'DNSE'), ('ssi', 'SSI'), ('tcbs', 'TCBS')], db_index=True, max_length=16, unique=True, verbose_name='Broker provider')),
                ('secrets_cipher', models.BinaryField(verbose_name='Secrets JSON (Fernet-encrypted)')),
                ('allowed_purposes', models.JSONField(blank=True, default=list, verbose_name='Purpose được phép (backfill/snapshot/signal)')),
                ('is_verified', models.BooleanField(default=False, verbose_name='Đã xác minh kết nối')),
                ('last_verified_at', models.DateTimeField(blank=True, null=True, verbose_name='Xác minh lần cuối')),
                ('last_check', models.JSONField(blank=True, default=dict, verbose_name='Kết quả kiểm tra gần nhất {ok, latency_ms, at, error} (không chứa secret)')),
                ('updated_by', models.CharField(blank=True, default='', max_length=150, verbose_name='Staff cập nhật cuối')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'System Broker Credential',
                'verbose_name_plural': 'System Broker Credentials',
            },
        ),
        migrations.RunPython(_copy_system_dnse, _copy_reverse),
    ]
