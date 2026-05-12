# Generated manually for T10

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('portfolio', '0077_runtimevnbrokerconfig_source_config'),
    ]

    operations = [
        migrations.AddField(
            model_name='portfolio',
            name='tenant',
            field=models.ForeignKey(blank=True, help_text='SaaS tenant this portfolio belongs to', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='portfolios', to='identity_access.coretenant', verbose_name='Tenant'),
        ),
        migrations.AddField(
            model_name='watchlistgroup',
            name='tenant',
            field=models.ForeignKey(blank=True, help_text='SaaS tenant this watchlist group belongs to', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='watchlist_groups', to='identity_access.coretenant', verbose_name='Tenant'),
        ),
        migrations.AddField(
            model_name='pricealertrule',
            name='tenant',
            field=models.ForeignKey(blank=True, help_text='SaaS tenant this price alert rule belongs to', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='price_alert_rules', to='identity_access.coretenant', verbose_name='Tenant'),
        ),
    ]
