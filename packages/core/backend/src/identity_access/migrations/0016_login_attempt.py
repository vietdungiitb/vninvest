"""Add LoginAttempt model for security dashboard."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('identity_access', '0015_add_scheduled_report_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='LoginAttempt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(db_index=True, max_length=150)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('ip_address', models.GenericIPAddressField(db_index=True)),
                ('user_agent', models.TextField(blank=True)),
                ('success', models.BooleanField(db_index=True)),
                ('failure_reason', models.CharField(blank=True, default='', max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('tenant', models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to='identity_access.coretenant', db_index=True)),
                ('user', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='auth.user')),
            ],
            options={
                'verbose_name': 'Login Attempt',
                'verbose_name_plural': 'Login Attempts',
                'db_table': 'core_login_attempt',
                'indexes': [
                    models.Index(fields=['tenant', 'created_at'], name='core_login_attempt_tenant_created_42aec0_idx'),
                    models.Index(fields=['tenant', 'success'], name='core_login_attempt_tenant_success_7a5683_idx'),
                ],
            },
        ),
    ]
