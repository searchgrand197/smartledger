from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0003_customer_portal_labels"),
    ]

    operations = [
        migrations.AddField(
            model_name="businesssettings",
            name="owner_name",
            field=models.CharField(blank=True, help_text="Owner / contact name", max_length=200),
        ),
        migrations.AddField(
            model_name="businesssettings",
            name="factory_details",
            field=models.TextField(blank=True, help_text="Factory or extra business details"),
        ),
    ]
