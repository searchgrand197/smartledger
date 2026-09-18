from django.db import migrations

from core.utils import stock_alert_level


def backfill_minimum_stock(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    for product in Product.objects.all():
        if product.minimum_stock > 0:
            continue
        if product.current_stock <= 0:
            continue
        product.minimum_stock = stock_alert_level(product.current_stock)
        product.save(update_fields=["minimum_stock"])


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0003_product_packaging_and_image"),
    ]

    operations = [
        migrations.RunPython(backfill_minimum_stock, migrations.RunPython.noop),
    ]
