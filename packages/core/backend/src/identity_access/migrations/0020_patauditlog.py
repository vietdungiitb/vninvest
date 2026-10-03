# Generated for PAT usage analytics — PATAuditLog model.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0019_coretenant_max_active_pats'),
    ]

    operations = [
        migrations.CreateModel(
            name='PATAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='Client IP')),
                ('endpoint', models.CharField(max_length=256, verbose_name='Endpoint path')),
                ('method', models.CharField(max_length=8, verbose_name='HTTP method')),
                ('status_code', models.SmallIntegerField(verbose_name='HTTP status code')),
                ('user_agent', models.TextField(blank=True, default='', verbose_name='User agent')),
                ('duration_ms', models.IntegerField(default=0, verbose_name='Request duration (ms)')),
                ('auth_source', models.CharField(choices=[('pat', 'PAT'), ('session', 'Session')], default='pat', max_length=16, verbose_name='Auth source')),
                ('occurred_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('pat', models.ForeignKey(on_delete=models.CASCADE, related_name='audit_logs', to='identity_access.corepatcredential', verbose_name='PAT credential')),
                ('tenant', models.ForeignKey(on_delete=models.CASCADE, related_name='pat_audit_logs', to='identity_access.coretenant', verbose_name='Tenant')),
            ],
            options={
                'verbose_name': 'PAT Audit Log',
                'verbose_name_plural': 'PAT Audit Logs',
                'db_table': 'identity_access_pat_audit_log',
                'ordering': ['-occurred_at', '-pk'],
                'indexes': [
                    models.Index(fields=['pat', 'occurred_at'], name='idx_pataudit_pat_occurred'),
                    models.Index(fields=['tenant', 'occurred_at'], name='idx_pataudit_tenant_occ'),
                    models.Index(fields=['ip_address'], name='idx_pataudit_ip'),
                ],
            },
        ),
    ]
