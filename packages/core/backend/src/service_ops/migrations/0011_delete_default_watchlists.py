"""Xoá Watchlist is_default=True cũ — thành viên nhóm thị trường giờ nằm trong CachedSymbolGroupMember."""

from django.db import migrations


def _delete_legacy_default_watchlists(apps, schema_editor):
    Watchlist = apps.get_model('user_workspace', 'Watchlist')
    db_alias = schema_editor.connection.alias
    Watchlist.objects.using(db_alias).filter(is_default=True).delete()


def _reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0010_cachedsymbolgroupmember'),
        ('user_workspace', '0013_screenerrule'),
    ]

    operations = [
        migrations.RunPython(_delete_legacy_default_watchlists, _reverse_noop),
    ]
