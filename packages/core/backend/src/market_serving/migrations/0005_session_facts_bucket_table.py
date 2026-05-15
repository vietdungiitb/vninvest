from datetime import datetime

from django.db import migrations, models


def backfill_session_facts_buckets(apps, schema_editor):
    SessionFacts = apps.get_model('market_serving', 'SessionFacts')
    SessionFactsBucket = apps.get_model('market_serving', 'SessionFactsBucket')

    bucket_rows = []
    for facts in SessionFacts.objects.all().iterator():
        series_by_window = getattr(facts, 'series_by_window', None) or {}
        for window, window_payload in series_by_window.items():
            bucket_minutes = int(window_payload.get('bucket_minutes') or 0)
            for bucket in window_payload.get('cvd_series', []):
                bucket_ts_raw = bucket.get('bucket_ts')
                if not bucket_ts_raw:
                    continue
                try:
                    bucket_ts = datetime.fromisoformat(str(bucket_ts_raw))
                except ValueError:
                    continue
                bucket_rows.append(SessionFactsBucket(
                    session_facts_id=facts.id,
                    symbol=facts.symbol,
                    session_date=facts.session_date,
                    window=str(window),
                    bucket_minutes=bucket_minutes,
                    bucket_ts=bucket_ts,
                    cumulative_cvd=float(bucket.get('cumulative_cvd') or 0.0),
                    buy_volume=int(bucket.get('buy_volume') or 0),
                    sell_volume=int(bucket.get('sell_volume') or 0),
                ))

    if bucket_rows:
        SessionFactsBucket.objects.bulk_create(bucket_rows, batch_size=1000)


class Migration(migrations.Migration):

    dependencies = [
        ('market_serving', '0004_add_session_facts_series_by_window'),
    ]

    operations = [
        migrations.CreateModel(
            name='SessionFactsBucket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32)),
                ('session_date', models.DateField(db_index=True)),
                ('window', models.CharField(db_index=True, max_length=8)),
                ('bucket_minutes', models.PositiveIntegerField()),
                ('bucket_ts', models.DateTimeField(db_index=True)),
                ('cumulative_cvd', models.FloatField(default=0.0)),
                ('buy_volume', models.BigIntegerField(default=0)),
                ('sell_volume', models.BigIntegerField(default=0)),
                ('session_facts', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='buckets', to='market_serving.sessionfacts')),
            ],
            options={
                'verbose_name': 'Session Facts Bucket',
                'verbose_name_plural': 'Session Facts Buckets',
                'ordering': ['session_date', 'window', 'bucket_ts', 'pk'],
                'unique_together': {('session_facts', 'window', 'bucket_ts')},
                'indexes': [
                    models.Index(fields=['symbol', 'session_date', 'window', 'bucket_ts'], name='market_serv_symbol_d5f4df_idx'),
                    models.Index(fields=['session_facts', 'window', 'bucket_ts'], name='market_serv_session_6b4f6d_idx'),
                ],
            },
        ),
        migrations.RunPython(backfill_session_facts_buckets, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='sessionfacts',
            name='series_by_window',
        ),
    ]
