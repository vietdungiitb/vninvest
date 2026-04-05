from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0015_rename_portfolio_a_user_id_58b38f_idx_portfolio_a_user_id_782577_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='userconfig',
            name='language',
            field=models.CharField(
                choices=[('vi', 'Tiếng Việt'), ('en', 'English')],
                default='vi',
                max_length=5,
                verbose_name='Ngôn ngữ giao diện',
            ),
        ),
    ]