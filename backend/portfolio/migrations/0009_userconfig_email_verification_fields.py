from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0008_systememailaccount'),
    ]

    operations = [
        migrations.AddField(
            model_name='userconfig',
            name='email_verification_sent_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Lan gui email xac thuc gan nhat'),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='email_verified',
            field=models.BooleanField(default=False, verbose_name='Email da xac thuc'),
        ),
        migrations.AddField(
            model_name='userconfig',
            name='email_verified_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Thoi diem xac thuc email'),
        ),
    ]
