import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0017_trackedsymbol_whale_alert_threshold_million'),
    ]

    operations = [
        migrations.AddField(
            model_name='trackedsymbol',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
