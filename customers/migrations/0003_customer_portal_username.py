from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0002_partyproductrate"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="portal_username",
            field=models.CharField(
                blank=True,
                help_text="Optional login username for customer portal (same style as shop owner).",
                max_length=150,
                null=True,
                unique=True,
            ),
        ),
    ]
