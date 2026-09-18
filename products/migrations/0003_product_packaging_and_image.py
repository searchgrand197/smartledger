from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0002_product_retail_price"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="allow_length_sale",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="product",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="products/"),
        ),
        migrations.AddField(
            model_name="product",
            name="length_per_piece_m",
            field=models.DecimalField(decimal_places=3, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="product",
            name="packs_per_box",
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name="product",
            name="pieces_per_pack",
            field=models.PositiveIntegerField(default=1),
        ),
    ]
