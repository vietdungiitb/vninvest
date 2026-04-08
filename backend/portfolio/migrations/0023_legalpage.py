import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('portfolio', '0022_alter_onboardingplanpolicy_options_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='LegalPage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.CharField(
                    choices=[('about', 'Giới thiệu'), ('disclaimer', 'Tuyên bố trách nhiệm')],
                    db_index=True,
                    max_length=30,
                    verbose_name='Loại trang',
                )),
                ('locale', models.CharField(
                    choices=[('vi', 'Tiếng Việt'), ('en', 'English')],
                    db_index=True,
                    default='vi',
                    max_length=10,
                    verbose_name='Ngôn ngữ',
                )),
                ('title', models.CharField(max_length=255, verbose_name='Tiêu đề')),
                ('summary', models.TextField(blank=True, default='', verbose_name='Tóm tắt (hiển thị dưới form đăng nhập)')),
                ('content_markdown', models.TextField(verbose_name='Nội dung (Markdown)')),
                ('is_active', models.BooleanField(db_index=True, default=False, verbose_name='Đang hiển thị')),
                ('version', models.PositiveSmallIntegerField(default=1, verbose_name='Phiên bản')),
                ('published_at', models.DateTimeField(blank=True, null=True, verbose_name='Ngày công bố')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Ngày cập nhật')),
                ('updated_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='legal_pages_updated',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Người cập nhật',
                )),
            ],
            options={
                'verbose_name': 'Trang pháp lý',
                'verbose_name_plural': 'Trang pháp lý',
                'ordering': ['slug', 'locale', '-version'],
            },
        ),
        migrations.AddConstraint(
            model_name='legalpage',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True),
                fields=['slug', 'locale'],
                name='uniq_active_legal_page_slug_locale',
            ),
        ),
    ]
