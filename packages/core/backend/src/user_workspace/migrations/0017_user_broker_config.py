"""B1.1: UserBrokerConfig đa-broker + migrate dữ liệu từ 2 store DNSE cũ.

Forward: copy DNSECredential (workspace) và UserDNSECredential user-thường (identity_access)
→ UserBrokerConfig(provider='dnse', label='Mặc định'), đánh dấu prefs.migrated_from.
Reverse: xóa đúng các row đã migrate (theo marker), bảng cũ giữ nguyên.
"""
import django.db.models.deletion
from django.db import migrations, models

MIGRATED_MARKER = 'migrated_from'


def _migrate_forward(apps, schema_editor):
    import json

    from vninvest_core.utils.encryption import decrypt_string, encrypt_string

    UserBrokerConfig = apps.get_model('user_workspace', 'UserBrokerConfig')
    WorkspaceDNSE = apps.get_model('user_workspace', 'DNSECredential')
    IdentityDNSE = apps.get_model('identity_access', 'UserDNSECredential')

    def _get_or_create(user_id):
        obj, created = UserBrokerConfig.objects.get_or_create(
            user_id=user_id, provider='dnse', label='Mặc định',
            defaults={
                'secrets_cipher': '',
                'prefs': {},
                'status': 'never_connected',
            },
        )
        return obj, created

    # 1) user_workspace.DNSECredential (Fernet str, key từ SECRET_KEY)
    for cred in WorkspaceDNSE.objects.all().order_by('user_id'):
        try:
            client_id = decrypt_string(cred.client_id_cipher or '')
            client_secret = decrypt_string(cred.client_secret_cipher or '')
        except Exception:
            continue
        if not client_id or not client_secret:
            continue
        obj, _ = _get_or_create(cred.user_id)
        if obj.secrets_cipher:
            continue  # đã có (chạy lại idempotent, không ghi đè)
        obj.secrets_cipher = encrypt_string(json.dumps({
            'client_id': client_id,
            'client_secret': client_secret,
        }))
        prefs = dict(obj.prefs or {})
        prefs[MIGRATED_MARKER] = 'DNSECredential'
        prefs['sync_enabled'] = bool(cred.is_active)
        obj.prefs = prefs
        obj.save(update_fields=['secrets_cipher', 'prefs', 'updated_at'])

    # 2) identity_access.UserDNSECredential user-thường (Fernet bytes, key DNSE_CREDENTIAL_FERNET_KEY)
    try:
        from identity_access.models import _decrypt_credential
    except Exception:
        return  # thiếu key/lib → bỏ qua lane 2, không fail migration
    for cred in IdentityDNSE.objects.filter(is_system_provider=False).order_by('user_id'):
        try:
            api_key = _decrypt_credential(bytes(cred.api_key_encrypted or b''))
            api_secret = _decrypt_credential(bytes(cred.api_secret_encrypted or b''))
        except Exception:
            continue
        if not api_key or not api_secret:
            continue
        obj, _ = _get_or_create(cred.user_id)
        if obj.secrets_cipher:
            continue
        obj.secrets_cipher = encrypt_string(json.dumps({
            'client_id': api_key,
            'client_secret': api_secret,
        }))
        prefs = dict(obj.prefs or {})
        prefs[MIGRATED_MARKER] = 'UserDNSECredential'
        prefs['sync_enabled'] = True
        obj.prefs = prefs
        obj.save(update_fields=['secrets_cipher', 'prefs', 'updated_at'])


def _migrate_reverse(apps, schema_editor):
    UserBrokerConfig = apps.get_model('user_workspace', 'UserBrokerConfig')
    # Chỉ xóa row do migration tạo (có marker), không động tới row user tạo mới sau đó.
    for obj in UserBrokerConfig.objects.filter(provider='dnse', label='Mặc định'):
        prefs = obj.prefs or {}
        if isinstance(prefs, dict) and MIGRATED_MARKER in prefs:
            obj.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0016_screenerrule_is_public'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserBrokerConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('provider', models.CharField(choices=[('dnse', 'DNSE'), ('ssi', 'SSI'), ('tcbs', 'TCBS')], db_index=True, max_length=16, verbose_name='Nhà môi giới')),
                ('label', models.CharField(default='Mặc định', max_length=100, verbose_name='Tên gợi nhớ')),
                ('secrets_cipher', models.TextField(blank=True, default='', verbose_name='Secrets (Fernet-encrypted JSON)')),
                ('prefs', models.JSONField(blank=True, default=dict, verbose_name='Tùy chọn (tài khoản mặc định, sync, notify)')),
                ('status', models.CharField(choices=[('never_connected', 'Chưa kết nối'), ('connected', 'Đã kết nối'), ('expired', 'Hết hạn phiên'), ('error', 'Lỗi')], db_index=True, default='never_connected', max_length=20, verbose_name='Trạng thái kết nối')),
                ('last_verified_at', models.DateTimeField(blank=True, null=True, verbose_name='Xác minh lần cuối')),
                ('last_error', models.TextField(blank=True, default='', verbose_name='Lỗi gần nhất')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='broker_configs', to='auth.user', verbose_name='Người dùng')),
            ],
            options={
                'verbose_name': 'Cấu hình Broker người dùng',
                'verbose_name_plural': 'Cấu hình Broker người dùng',
                'unique_together': {('user', 'provider', 'label')},
            },
        ),
        migrations.RunPython(_migrate_forward, _migrate_reverse),
    ]
