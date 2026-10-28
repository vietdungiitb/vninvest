from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal

from django.db import migrations, models


def _hose_tick_size(price: Decimal) -> Decimal:
    if price < Decimal('10000'):
        return Decimal('10')
    if price < Decimal('50000'):
        return Decimal('50')
    return Decimal('100')


def _round_ceiling_price(raw: Decimal) -> Decimal:
    tick = _hose_tick_size(raw)
    return (raw / tick).to_integral_value(rounding=ROUND_FLOOR) * tick


def _round_floor_price(raw: Decimal) -> Decimal:
    tick = _hose_tick_size(raw)
    return (raw / tick).to_integral_value(rounding=ROUND_CEILING) * tick


def backfill_snapshot_quote_columns(apps, schema_editor):
    SymbolSnapshot = apps.get_model('market_serving', 'SymbolSnapshot')
    DailyPrice = apps.get_model('market_data', 'DailyPrice')

    for snapshot in SymbolSnapshot.objects.all().iterator():
        reference_price = snapshot.reference_price
        if reference_price is None:
            previous_daily = (
                DailyPrice.objects.filter(symbol=snapshot.symbol, date__lt=snapshot.session_date)
                .order_by('-date')
                .first()
            )
            if previous_daily is not None:
                reference_price = previous_daily.close
            elif snapshot.price is not None and snapshot.price_change is not None:
                reference_price = snapshot.price - snapshot.price_change
            else:
                reference_price = snapshot.price

        if reference_price is None:
            continue

        reference_price = Decimal(str(reference_price))
        ceiling = _round_ceiling_price(reference_price * Decimal('1.07'))
        floor = _round_floor_price(reference_price * Decimal('0.93'))

        update_fields = []
        if snapshot.reference_price != reference_price:
            snapshot.reference_price = reference_price
            update_fields.append('reference_price')
        if snapshot.ceiling != ceiling:
            snapshot.ceiling = ceiling
            update_fields.append('ceiling')
        if snapshot.floor != floor:
            snapshot.floor = floor
            update_fields.append('floor')

        if update_fields:
            snapshot.save(update_fields=update_fields)


def add_snapshot_quote_columns_if_missing(apps, schema_editor):
    SymbolSnapshot = apps.get_model('market_serving', 'SymbolSnapshot')
    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor,
                SymbolSnapshot._meta.db_table,
            )
        }

    quote_fields = [
        ('reference_price', models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True, help_text='Previous close price (nền giá)')),
        ('ceiling', models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True, help_text='Price ceiling (trần = reference * 1.07)')),
        ('floor', models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True, help_text='Price floor (sàn = reference * 0.93)')),
    ]

    for field_name, field in quote_fields:
        if field_name in existing_columns:
            continue
        field.set_attributes_from_name(field_name)
        schema_editor.add_field(SymbolSnapshot, field)


class Migration(migrations.Migration):

    dependencies = [
        ('market_serving', '0002_add_high_low_open_to_symbol_snapshot'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_snapshot_quote_columns_if_missing, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='symbolsnapshot',
                    name='reference_price',
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=18,
                        null=True,
                        help_text='Previous close price (nền giá)',
                    ),
                ),
                migrations.AddField(
                    model_name='symbolsnapshot',
                    name='ceiling',
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=18,
                        null=True,
                        help_text='Price ceiling (trần = reference * 1.07)',
                    ),
                ),
                migrations.AddField(
                    model_name='symbolsnapshot',
                    name='floor',
                    field=models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=18,
                        null=True,
                        help_text='Price floor (sàn = reference * 0.93)',
                    ),
                ),
            ],
        ),
        migrations.RunPython(backfill_snapshot_quote_columns, migrations.RunPython.noop),
    ]
