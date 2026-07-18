import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0024_tenantcustomrole'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantinvite',
            name='custom_role',
            field=models.ForeignKey(
                blank=True,
                help_text='Optional custom role to assign on accept (overrides system role).',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='invites',
                to='identity_access.tenantcustomrole',
            ),
        ),
    ]
