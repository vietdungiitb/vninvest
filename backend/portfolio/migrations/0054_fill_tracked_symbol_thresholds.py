from django.db import migrations

def fill_thresholds(apps, schema_editor):
    TrackedSymbol = apps.get_model('portfolio', 'TrackedSymbol')
    UserConfig = apps.get_model('portfolio', 'UserConfig')
    
    # Batch update might be more efficient but we need to resolve per user
    # Fetch all symbols with null threshold
    null_symbols = TrackedSymbol.objects.filter(whale_alert_threshold_million__isnull=True)
    
    # Map user_id to their default threshold
    user_configs = {cfg.user_id: cfg.whale_alert_threshold for cfg in UserConfig.objects.all()}
    
    for ts in null_symbols:
        default_val = user_configs.get(ts.user_id, 500)
        ts.whale_alert_threshold_million = default_val
        ts.save(update_fields=['whale_alert_threshold_million'])

def reverse_fill(apps, schema_editor):
    # No need to do anything as we are just filling nulls
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('portfolio', '0053_add_is_stale_and_whale_service_job'),
    ]

    operations = [
        migrations.RunPython(fill_thresholds, reverse_fill),
    ]
