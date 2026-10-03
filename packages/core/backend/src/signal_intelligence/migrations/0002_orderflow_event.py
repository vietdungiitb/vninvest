import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('signal_intelligence', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderFlowEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)),
                ('symbol', models.CharField(db_index=True, max_length=32)),
                ('session_date', models.DateField(db_index=True)),
                ('signal_type', models.CharField(
                    choices=[
                        ('whale_buy', 'Whale Buy'),
                        ('whale_sell', 'Whale Sell'),
                        ('dark_flow', 'Dark Flow'),
                        ('order_imbalance', 'Order Imbalance'),
                        ('cvd_divergence', 'CVD Divergence'),
                        ('other', 'Other'),
                    ],
                    db_index=True,
                    max_length=32,
                )),
                ('side', models.CharField(
                    choices=[('buy', 'Buy'), ('sell', 'Sell'), ('neutral', 'Neutral')],
                    db_index=True,
                    default='neutral',
                    max_length=8,
                )),
                ('strength', models.FloatField(default=0.0)),
                ('whale_intensity', models.FloatField(default=0.0)),
                ('cvd_at_signal', models.FloatField(blank=True, null=True)),
                ('price_at_signal', models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True)),
                ('volume_at_signal', models.BigIntegerField(blank=True, null=True)),
                ('source_ref', models.CharField(blank=True, db_index=True, default='', max_length=255)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('triggered_at', models.DateTimeField(db_index=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('unified_alert', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='order_flow_events',
                    to='signal_intelligence.unifiedalert',
                )),
            ],
            options={
                'verbose_name': 'Order Flow Event',
                'verbose_name_plural': 'Order Flow Events',
                'ordering': ['-triggered_at', '-pk'],
                'indexes': [
                    models.Index(fields=['symbol', 'session_date', 'signal_type'], name='sigint_ofe_sym_date_type_idx'),
                    models.Index(fields=['side', 'triggered_at'], name='sigint_ofe_side_at_idx'),
                ],
            },
        ),
    ]
