from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('signal_intelligence', '0003_unifiedalert_source_ref_nonempty_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='unifiedalert',
            name='confidence',
            field=models.FloatField(db_index=True, default=0.0),
        ),
        migrations.AddField(
            model_name='unifiedalert',
            name='evidence',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='unifiedalert',
            name='freshness_state',
            field=models.CharField(db_index=True, default='fresh', max_length=16),
        ),
    ]