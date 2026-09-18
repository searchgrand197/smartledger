from django.db import migrations


def relabel_opening_movements(apps, schema_editor):
    StockMovement = apps.get_model("products", "StockMovement")
    StockMovement.objects.filter(movement_type="adjustment", notes="Opening stock").update(
        movement_type="opening",
        reference_label="Item added",
        notes="Opening stock when item was first added",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0007_remove_barcode"),
    ]

    operations = [
        migrations.RunPython(relabel_opening_movements, migrations.RunPython.noop),
    ]
