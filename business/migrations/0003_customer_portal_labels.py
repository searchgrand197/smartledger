from django.db import migrations


def update_labels(apps, schema_editor):
    BusinessSettings = apps.get_model("business", "BusinessSettings")
    for s in BusinessSettings.objects.all():
        if "Simple" in (s.customer_option_title or ""):
            s.customer_option_title = "Customer"
        if "walk-in" in (s.customer_option_desc or "").lower() or "quick cash" in (s.customer_option_desc or "").lower():
            s.customer_option_desc = "Login with customer code and phone to view billing history"
        s.save()


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0002_businesssettings_customer_option_desc_and_more"),
    ]

    operations = [
        migrations.RunPython(update_labels, migrations.RunPython.noop),
    ]
