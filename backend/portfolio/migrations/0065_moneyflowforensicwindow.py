from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0064_delete_whaleservicejob'),
    ]

    operations = [
        migrations.CreateModel(
            name='MoneyFlowForensicWindow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(choices=[('whale', 'Whale Alerts'), ('dark_flow', 'Dark Flow')], db_index=True, max_length=20, verbose_name='Miền dữ liệu')),
                ('source_model', models.CharField(db_index=True, max_length=64, verbose_name='Mô hình nguồn')),
                ('source_id', models.CharField(db_index=True, max_length=255, verbose_name='Source ID')),
                ('symbol', models.CharField(db_index=True, max_length=10, verbose_name='Mã CK')),
                ('severity', models.CharField(db_index=True, max_length=10, verbose_name='Mức độ nghiêm trọng')),
                ('source_timestamp', models.DateTimeField(db_index=True, verbose_name='Thời điểm nguồn')),
                ('window_start', models.DateTimeField(db_index=True, verbose_name='Bắt đầu cửa sổ')),
                ('window_end', models.DateTimeField(db_index=True, verbose_name='Kết thúc cửa sổ')),
                ('expires_at', models.DateTimeField(db_index=True, verbose_name='Hết hạn')),
                ('storage_mode', models.CharField(default='physical_carve_out', max_length=32, verbose_name='Chế độ lưu trữ')),
                ('target_tier', models.CharField(default='L5', max_length=8, verbose_name='Tầng lưu trữ')),
                ('reason', models.CharField(max_length=255, verbose_name='Lý do')),
                ('source_payload_json', models.JSONField(blank=True, default=dict, verbose_name='Payload nguồn')),
                ('window_payload_json', models.JSONField(blank=True, default=dict, verbose_name='Payload cửa sổ')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Cập nhật cuối')),
            ],
            options={
                'verbose_name': 'Money Flow Forensic Window',
                'verbose_name_plural': 'Money Flow Forensic Windows',
                'ordering': ['-created_at', '-id'],
                'indexes': [
                    models.Index(fields=['domain', 'expires_at'], name='idx_mff_domain_exp'),
                    models.Index(fields=['symbol', 'created_at'], name='idx_mff_symbol_created'),
                ],
                'constraints': [
                    models.UniqueConstraint(fields=['domain', 'source_model', 'source_id'], name='uniq_mff_source'),
                ],
            },
        ),
    ]