from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('service_ops', '0002_add_scrape_matrix_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomSymbolGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Tên nhóm')),
                ('slug', models.SlugField(
                    max_length=60,
                    unique=True,
                    verbose_name='Slug (group_id)',
                    help_text='Dùng làm group_id khi chạy cycle. Tự động tạo từ tên, có thể chỉnh.',
                )),
                ('description', models.TextField(blank=True, verbose_name='Mô tả')),
                ('symbols', models.JSONField(
                    default=list,
                    verbose_name='Danh sách mã',
                    help_text='Danh sách mã theo dạng ["VCB", "BID", "CTG"]',
                )),
                ('is_active', models.BooleanField(default=True, verbose_name='Đang hoạt động')),
                ('created_by', models.CharField(blank=True, max_length=120)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Nhóm mã tuỳ chỉnh',
                'verbose_name_plural': 'Nhóm mã tuỳ chỉnh',
                'ordering': ['name'],
            },
        ),
    ]
