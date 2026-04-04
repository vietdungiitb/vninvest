from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0013_ai_advisory_components_and_summary'),
    ]

    operations = [
        migrations.AddField(
            model_name='systememailaccount',
            name='auth_type',
            field=models.CharField(
                choices=[('smtp_password', 'SMTP Password'), ('google_oauth2', 'Google OAuth2')],
                default='smtp_password',
                max_length=20,
                verbose_name='Kiểu xác thực gửi mail',
            ),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='oauth_provider',
            field=models.CharField(blank=True, default='', max_length=30, verbose_name='OAuth provider'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='google_client_id',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='Google Client ID'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='google_client_secret_ciphertext',
            field=models.TextField(blank=True, default='', verbose_name='Google Client Secret đã mã hóa'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='google_refresh_token_ciphertext',
            field=models.TextField(blank=True, default='', verbose_name='Google Refresh Token đã mã hóa'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='google_token_scope',
            field=models.TextField(blank=True, default='', verbose_name='Google token scope'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='google_account_email',
            field=models.EmailField(blank=True, default='', max_length=254, verbose_name='Google account email'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='oauth_connected_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Thời điểm kết nối OAuth'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='token_last_refreshed_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Lần refresh token gần nhất'),
        ),
        migrations.AddField(
            model_name='systememailaccount',
            name='token_last_error',
            field=models.TextField(blank=True, default='', verbose_name='Lỗi token gần nhất'),
        ),
    ]
