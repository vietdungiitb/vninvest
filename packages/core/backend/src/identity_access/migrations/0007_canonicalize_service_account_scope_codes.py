from django.db import migrations

POLICY_TO_SCOPE_CODES = {
    'pol_market_read': ['market:read'],
    'pol_signals_read': ['signals:read'],
    'pol_ai_invoke': ['ai:invoke'],
    'pol_manage_pats': ['manage_pats'],
    'pol_manage_service_accounts': ['manage_service_accounts'],
    'pol_manage_tenant': ['manage_tenant'],
}
SCOPE_CODE_TO_POLICY = {
    'market:read': 'pol_market_read',
    'signals:read': 'pol_signals_read',
    'ai:invoke': 'pol_ai_invoke',
    'manage_pats': 'pol_manage_pats',
    'manage_service_accounts': 'pol_manage_service_accounts',
    'manage_tenant': 'pol_manage_tenant',
}


def _normalize_identifier_list(values):
    normalized = []
    seen = set()
    for raw_value in values or []:
        value = str(raw_value or '').strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _policy_ids_to_scope_codes(policy_ids):
    scope_codes = []
    seen = set()
    for policy_id in _normalize_identifier_list(policy_ids):
        mapped_scopes = POLICY_TO_SCOPE_CODES.get(policy_id, [policy_id])
        for scope_code in mapped_scopes:
            if scope_code in seen:
                continue
            seen.add(scope_code)
            scope_codes.append(scope_code)
    return scope_codes


def _scope_codes_to_policy_ids(scope_codes):
    policy_ids = []
    seen = set()
    for scope_code in _normalize_identifier_list(scope_codes):
        policy_id = SCOPE_CODE_TO_POLICY.get(scope_code, scope_code)
        if policy_id in seen:
            continue
        seen.add(policy_id)
        policy_ids.append(policy_id)
    return policy_ids


def canonicalize_policy_backed_scopes(apps, schema_editor):
    CoreServiceAccount = apps.get_model('identity_access', 'CoreServiceAccount')
    CorePATCredential = apps.get_model('identity_access', 'CorePATCredential')

    for service_account in CoreServiceAccount.objects.all().iterator():
        metadata = dict(service_account.metadata or {})
        policy_ids = _normalize_identifier_list(metadata.get('policy_ids') or service_account.scopes)
        canonical_scopes = _policy_ids_to_scope_codes(policy_ids or service_account.scopes)
        derived_policy_ids = policy_ids or _scope_codes_to_policy_ids(service_account.scopes)

        changed = False
        if service_account.scopes != canonical_scopes:
            service_account.scopes = canonical_scopes
            changed = True
        if metadata.get('policy_ids') != derived_policy_ids:
            metadata['policy_ids'] = derived_policy_ids
            service_account.metadata = metadata
            changed = True
        if changed:
            service_account.save(update_fields=['scopes', 'metadata', 'updated_at'])

    for credential in CorePATCredential.objects.all().iterator():
        canonical_scopes = _policy_ids_to_scope_codes(credential.scopes)
        if credential.scopes == canonical_scopes:
            continue
        credential.scopes = canonical_scopes
        credential.save(update_fields=['scopes', 'updated_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0006_corepatcredential_is_human_session'),
    ]

    operations = [
        migrations.RunPython(canonicalize_policy_backed_scopes, migrations.RunPython.noop),
    ]