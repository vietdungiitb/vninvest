from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0007_add_plan_to_userconfig_and_whale_advisory'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemEmailAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, unique=True, verbose_name='Tên cấu hình')),
                ('host', models.CharField(max_length=255, verbose_name='SMTP host')),
                ('port', models.PositiveIntegerField(default=587, verbose_name='SMTP port')),
                ('username', models.CharField(blank=True, default='', max_length=255, verbose_name='Tên đăng nhập SMTP')),
                ('password_ciphertext', models.TextField(blank=True, default='', verbose_name='Mật khẩu SMTP đã mã hóa')),
                ('use_tls', models.BooleanField(default=True, verbose_name='Dùng TLS')),
                ('use_ssl', models.BooleanField(default=False, verbose_name='Dùng SSL')),
                ('timeout_seconds', models.PositiveIntegerField(default=20, verbose_name='Timeout kết nối (giây)')),
                ('from_email', models.EmailField(max_length=254, verbose_name='Email người gửi mặc định')),
                ('from_name', models.CharField(blank=True, default='', max_length=255, verbose_name='Tên người gửi')),
                ('reply_to_email', models.EmailField(blank=True, default='', max_length=254, verbose_name='Reply-to email')),
                ('is_active', models.BooleanField(default=True, verbose_name='Đang kích hoạt')),
                ('is_default', models.BooleanField(default=False, verbose_name='Là cấu hình mặc định')),
                ('notes', models.TextField(blank=True, default='', verbose_name='Ghi chú vận hành')),
                ('last_tested_at', models.DateTimeField(blank=True, null=True, verbose_name='Lần kiểm tra gần nhất')),
                ('last_test_status', models.CharField(choices=[('never', 'Chưa kiểm tra'), ('success', 'Kiểm tra thành công'), ('failed', 'Kiểm tra thất bại')], default='never', max_length=20, verbose_name='Trạng thái kiểm tra')),
                ('last_test_message', models.TextField(blank=True, default='', verbose_name='Kết quả kiểm tra gần nhất')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Tài khoản gửi mail',
                'verbose_name_plural': 'Tài khoản gửi mail',
                'ordering': ['-is_default', 'name'],
            },
        ),
    ]
