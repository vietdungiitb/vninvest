"""B3.2: thêm status 'unverified' cho UserBrokerConfig (TCBS chờ OTP)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0017_user_broker_config'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userbrokerconfig',
            name='status',
            field=models.CharField(choices=[('never_connected', 'Chưa kết nối'), ('connected', 'Đã kết nối'), ('unverified', 'Chờ xác minh (thiếu OTP)'), ('expired', 'Hết hạn phiên'), ('error', 'Lỗi')], db_index=True, default='never_connected', max_length=20, verbose_name='Trạng thái kết nối'),
        ),
    ]
