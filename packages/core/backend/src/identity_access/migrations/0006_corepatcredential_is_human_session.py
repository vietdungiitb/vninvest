from django.db import migrations, models
from django.utils import timezone


def revoke_legacy_human_marker_pats(apps, schema_editor):
    CorePATCredential = apps.get_model('identity_access', 'CorePATCredential')
    now = timezone.now()
    queryset = CorePATCredential.objects.filter(revoked=False).filter(
        models.Q(audit_reason='core login') | models.Q(label__startswith='login:')
    )
    queryset.update(
        revoked=True,
        revoked_at=now,
        status='revoked',
        is_human_session=False,
        updated_at=now,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0005_dnse_credential'),
    ]

    operations = [
        migrations.AddField(
            model_name='corepatcredential',
            name='is_human_session',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.RunPython(revoke_legacy_human_marker_pats, migrations.RunPython.noop),
    ]