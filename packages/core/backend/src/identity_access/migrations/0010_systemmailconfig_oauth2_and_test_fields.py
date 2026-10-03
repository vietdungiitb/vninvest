"""
Migration 0010 — Add OAuth2 web-client fields + test-status fields to SystemMailConfig.

New fields:
  - name
  - from_name
  - reply_to_email
  - timeout_seconds
  - google_client_id
  - google_client_secret_encrypted
  - google_refresh_token_encrypted
  - google_account_email
  - google_token_scope
  - oauth_connected_at
  - token_last_refreshed_at
  - token_last_error
  - last_tested_at
  - last_test_status
  - last_test_message
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_access', '0009_emailverificationtoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemmailconfig',
            name='name',
            field=models.CharField(blank=True, default='', max_length=120, verbose_name='Tên cấu hình'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='from_name',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='Tên hiển thị người gửi'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='reply_to_email',
            field=models.EmailField(blank=True, default='', max_length=255, verbose_name='Email trả lời (Reply-To)'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='timeout_seconds',
            field=models.IntegerField(default=20, verbose_name='Timeout (giây)'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='google_client_id',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='Google Client ID'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='google_client_secret_encrypted',
            field=models.BinaryField(blank=True, null=True, verbose_name='Google Client Secret (mã hóa)'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='google_refresh_token_encrypted',
            field=models.BinaryField(blank=True, null=True, verbose_name='Google Refresh Token (mã hóa)'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='google_account_email',
            field=models.EmailField(blank=True, default='', max_length=255, verbose_name='Email tài khoản Google đã kết nối'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='google_token_scope',
            field=models.TextField(blank=True, default='', verbose_name='Google OAuth2 Scope'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='oauth_connected_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Thời điểm kết nối OAuth2'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='token_last_refreshed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Lần cuối làm mới token'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='token_last_error',
            field=models.TextField(blank=True, default='', verbose_name='Lỗi token gần nhất'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='last_tested_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Lần kiểm tra cuối'),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='last_test_status',
            field=models.CharField(
                choices=[('never', 'Chưa kiểm tra'), ('success', 'Thành công'), ('failed', 'Thất bại')],
                default='never',
                max_length=20,
                verbose_name='Kết quả kiểm tra gần nhất',
            ),
        ),
        migrations.AddField(
            model_name='systemmailconfig',
            name='last_test_message',
            field=models.TextField(blank=True, default='', verbose_name='Thông báo kiểm tra gần nhất'),
        ),
    ]
