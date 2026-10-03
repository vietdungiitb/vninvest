"""Add group_type, color, display_order to CachedSymbolGroup — display metadata cho UI."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0008_add_cached_symbol_group'),
    ]

    operations = [
        migrations.AddField(
            model_name='cachedsymbolgroup',
            name='group_type',
            field=models.CharField(
                blank=True,
                default='',
                help_text='SECTOR, INDEX, EXCHANGE, ETF, CW, BOND, DERIVATIVE',
                max_length=20,
                verbose_name='Loại nhóm',
            ),
        ),
        migrations.AddField(
            model_name='cachedsymbolgroup',
            name='color',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Hex color code cho UI, VD: #3b82f6',
                max_length=20,
                verbose_name='Màu hiển thị',
            ),
        ),
        migrations.AddField(
            model_name='cachedsymbolgroup',
            name='display_order',
            field=models.PositiveIntegerField(
                default=999,
                help_text='Thứ tự sắp xếp trong sidebar',
                verbose_name='Thứ tự hiển thị',
            ),
        ),
        migrations.AlterModelOptions(
            name='cachedsymbolgroup',
            options={
                'ordering': ['display_order', 'group_name'],
                'verbose_name': 'Nhóm thị trường (cached)',
                'verbose_name_plural': 'Nhóm thị trường (cached)',
            },
        ),
    ]
