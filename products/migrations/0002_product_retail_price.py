from decimal import Decimal

from django.db import migrations, models


def copy_sale_to_retail(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    for p in Product.objects.all():
        if not p.retail_price or p.retail_price == 0:
            p.retail_price = p.sale_price
            p.save(update_fields=["retail_price"])


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="retail_price",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                help_text="Walk-in / quick sale price (inclusive). If 0, uses wholesale price.",
                max_digits=10,
            ),
        ),
        migrations.RunPython(copy_sale_to_retail, migrations.RunPython.noop),
    ]
