from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0030_phase1_advisory_autogen_and_refresh'),
    ]

    operations = [
        migrations.AddField(
            model_name='userconfig',
            name='advisory_max_auto_refreshes_per_day',
            field=models.PositiveIntegerField(
                default=24,
                help_text='Giới hạn số advisory do periodic job tự tạo/làm mới trong ngày',
                validators=[django.core.validators.MinValueValidator(1)],
                verbose_name='Số lần auto refresh advisory tối đa mỗi ngày',
            ),
        ),
    ]
