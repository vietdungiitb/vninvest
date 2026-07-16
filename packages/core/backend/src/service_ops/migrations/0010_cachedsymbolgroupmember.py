"""Create CachedSymbolGroupMember — tách thành viên nhóm thị trường khỏi WatchlistItem của user."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0009_cachedsymbolgroup_group_type_color_display_order'),
    ]

    operations = [
        migrations.CreateModel(
            name='CachedSymbolGroupMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('symbol', models.CharField(db_index=True, max_length=32, verbose_name='Mã cổ phiếu')),
                ('display_order', models.PositiveIntegerField(default=0, verbose_name='Thứ tự hiển thị')),
                ('group', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='members',
                    to='service_ops.cachedsymbolgroup',
                    verbose_name='Nhóm thị trường',
                )),
            ],
            options={
                'ordering': ['display_order', 'symbol'],
                'unique_together': {('group', 'symbol')},
                'verbose_name': 'Mã trong nhóm thị trường (cached)',
                'verbose_name_plural': 'Mã trong nhóm thị trường (cached)',
            },
        ),
    ]
