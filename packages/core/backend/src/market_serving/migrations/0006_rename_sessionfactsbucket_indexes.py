from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('market_serving', '0005_session_facts_bucket_table'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='sessionfactsbucket',
            old_name='market_serv_symbol_d5f4df_idx',
            new_name='market_serv_symbol_7d2ec1_idx',
        ),
        migrations.RenameIndex(
            model_name='sessionfactsbucket',
            old_name='market_serv_session_6b4f6d_idx',
            new_name='market_serv_session_8a5b74_idx',
        ),
    ]
