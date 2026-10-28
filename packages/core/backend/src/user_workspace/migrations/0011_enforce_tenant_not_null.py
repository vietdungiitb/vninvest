# Generated manually to enforce tenant NOT NULL constraints and add QuarantinedRecord

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0004_tenantmember_tenantinvite'),
        ('user_workspace', '0010_remove_subaccount_user_ws_subaccount_tenant_user_idx_and_more'),
    ]

    operations = [
        # Create QuarantinedRecord model
        migrations.CreateModel(
            name='QuarantinedRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('model_name', models.CharField(db_index=True, max_length=100, verbose_name='Tên Model')),
                ('original_id', models.IntegerField(db_index=True, verbose_name='ID gốc')),
                ('data', models.JSONField(verbose_name='Dữ liệu bản ghi thô')),
                ('reason', models.TextField(verbose_name='Lý do cô lập')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Ngày cô lập')),
            ],
            options={
                'verbose_name': 'Bản ghi cô lập',
                'verbose_name_plural': 'Bản ghi cô lập',
                'ordering': ['-created_at'],
            },
        ),
    ]
