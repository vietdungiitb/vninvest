from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0023_legalpage'),
    ]

    operations = [
        migrations.AddField(
            model_name='userconfig',
            name='starter_portfolios_seeded',
            field=models.BooleanField(default=False, verbose_name='Da tao bo danh muc mac dinh'),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='starter_portfolios_seeded_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Thoi diem tao bo danh muc mac dinh'),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='starter_portfolios_template_version',
            field=models.CharField(default='v1', max_length=16, verbose_name='Phien ban template danh muc mac dinh'),
        ),
    ]
