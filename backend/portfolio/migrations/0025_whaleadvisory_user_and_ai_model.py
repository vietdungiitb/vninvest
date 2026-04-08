from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0024_userconfig_starter_portfolios'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='whaleadvisory',
            name='ai_model',
            field=models.CharField(blank=True, default='', max_length=100, verbose_name='AI model'),
        ),
        migrations.AddField(
            model_name='whaleadvisory',
            name='user',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='whale_advisories', to=settings.AUTH_USER_MODEL, verbose_name='Người dùng'),
        ),
        migrations.AddIndex(
            model_name='whaleadvisory',
            index=models.Index(fields=['user', 'symbol', 'created_at'], name='portfolio_w_user_id_4cfc3c_idx'),
        ),
    ]