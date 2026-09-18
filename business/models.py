from django.db import models
from django.utils import timezone

from accounts.models import Organization


class BusinessSettings(models.Model):
    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE, related_name="settings", null=True, blank=True
    )
    owner_name = models.CharField(max_length=200, blank=True, help_text="Owner / contact name")
    business_name = models.CharField(max_length=200, default="Smart Ledger Shop")
    logo = models.FileField(upload_to="business/", blank=True, null=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    factory_details = models.TextField(blank=True, help_text="Factory or extra business details")
    email = models.EmailField(blank=True)
    gst_number = models.CharField(max_length=20, blank=True)
    invoice_prefix = models.CharField(max_length=10, default="BILL")
    invoice_footer = models.TextField(blank=True, default="Thank you! All prices are inclusive of tax.")
    gst_enabled = models.BooleanField(default=False)
    default_gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    dark_mode = models.BooleanField(default=False)
    auto_backup = models.BooleanField(default=True)
    home_title = models.CharField(max_length=200, default="Smart Ledger")
    home_subtitle = models.CharField(max_length=300, default="Choose how you want to continue")
    wholesale_option_title = models.CharField(max_length=100, default="Wholesale / Parties")
    wholesale_option_desc = models.CharField(
        max_length=300, default="Parties with ledger, credit, stock & reports"
    )
    customer_option_title = models.CharField(max_length=100, default="Customer")
    customer_option_desc = models.CharField(
        max_length=300, default="Login with customer code and phone to view billing history"
    )
    setup_completed = models.BooleanField(
        default=False,
        help_text="Set when the shop has saved business details in Settings.",
    )
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Business Setting"
        verbose_name_plural = "Business Settings"

    @classmethod
    def load(cls, organization=None):
        from core.tenant import get_current_organization

        if organization is None:
            organization = get_current_organization()
        if organization is None:
            organization, _ = Organization.objects.get_or_create(
                slug="default",
                defaults={"name": "Default Shop"},
            )
        obj, created = cls.objects.get_or_create(
            organization=organization,
            defaults={"business_name": organization.name, "setup_completed": False},
        )
        return obj

    def __str__(self):
        return self.business_name
