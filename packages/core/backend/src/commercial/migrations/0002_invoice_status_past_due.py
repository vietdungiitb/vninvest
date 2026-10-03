from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commercial', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='invoice',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('open', 'Open'),
                    ('past_due', 'Past Due'),
                    ('paid', 'Paid'),
                    ('void', 'Void'),
                    ('uncollectible', 'Uncollectible'),
                ],
                db_index=True,
                default='draft',
                max_length=16,
            ),
        ),
    ]