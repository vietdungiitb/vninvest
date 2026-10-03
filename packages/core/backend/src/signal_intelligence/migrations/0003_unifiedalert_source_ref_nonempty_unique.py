from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('signal_intelligence', '0002_orderflow_event'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='unifiedalert',
            constraint=models.UniqueConstraint(
                fields=['source_ref'],
                condition=~models.Q(source_ref=''),
                name='uq_unified_alert_source_ref_nonempty',
            ),
        ),
    ]