from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('commercial', '0005_add_invoice_line_items'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymenttransaction',
            name='plan',
            field=models.CharField(blank=True, max_length=32, null=True, db_index=True),
        ),
    ]
