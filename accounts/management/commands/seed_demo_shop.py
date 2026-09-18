"""Seed inventory, parties, and sample billing for a demo ledger (default: demo_b)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.management.commands.seed_data import CATEGORIES, _build_product_specs
from accounts.models import Organization, UserProfile
from core.tenant import set_current_organization

User = get_user_model()

DEMO_PRODUCT_COUNT = 45


class Command(BaseCommand):
    help = "Seed demo shop inventory, suppliers, customers, and a sample bill (default user: demo_b)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default="demo_b",
            help="Ledger login whose organization will be seeded (default: demo_b)",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Clear this organization's business data and re-seed",
        )
        parser.add_argument(
            "--products",
            type=int,
            default=DEMO_PRODUCT_COUNT,
            help=f"Number of products to create (default {DEMO_PRODUCT_COUNT})",
        )

    def _ensure_categories(self, ProductCategory):
        categories = {}
        for name in CATEGORIES:
            categories[name], _ = ProductCategory.objects.get_or_create(name=name)
        return categories

    def _clear_org_data(self, org):
        from billing.models import Bill, BillItem
        from customers.models import Customer
        from payments.models import Payment
        from products.models import Product
        from purchases.models import Purchase, PurchaseItem, SupplierPayment
        from returns.models import SalesReturn
        from suppliers.models import Supplier

        SalesReturn.objects.filter(organization=org).delete()
        BillItem.objects.filter(bill__organization=org).delete()
        Bill.objects.filter(organization=org).delete()
        Payment.objects.filter(organization=org).delete()
        PurchaseItem.objects.filter(purchase__organization=org).delete()
        SupplierPayment.objects.filter(purchase__organization=org).delete()
        Purchase.objects.filter(organization=org).delete()
        Product.objects.filter(organization=org).delete()
        Customer.objects.filter(organization=org).delete()
        Supplier.objects.filter(organization=org).delete()
        self.stdout.write(f"Cleared business data for {org.name}.")

    def _seed_products(self, Product, ProductCategory, org, count):
        categories = self._ensure_categories(ProductCategory)
        specs = _build_product_specs()[:count]

        created = 0
        for spec in specs:
            if Product.objects.filter(organization=org, code=spec["code"]).exists():
                continue
            cat = categories[spec["category"]]
            Product.objects.create(
                organization=org,
                code=spec["code"],
                name=spec["name"],
                category=cat,
                brand=spec["brand"],
                unit=spec["unit"],
                purchase_price=spec["purchase_price"],
                sale_price=spec["sale_price"],
                retail_price=spec["sale_price"],
                current_stock=spec["current_stock"],
            )
            created += 1

        total = Product.objects.filter(organization=org).count()
        self.stdout.write(self.style.SUCCESS(f"Products: {total} items ({created} added)."))
        return list(Product.objects.filter(organization=org))

    def handle(self, *args, **options):
        from billing.models import Bill, BillItem
        from billing.walkin import get_walkin_customer
        from business.models import BusinessSettings
        from customers.models import Customer
        from payments.models import Payment
        from products.models import Product, ProductCategory
        from purchases.models import Purchase, PurchaseItem
        from suppliers.models import Supplier

        username = options["username"].strip()
        product_count = max(10, options["products"])

        try:
            profile = UserProfile.objects.select_related("organization", "user").get(user__username=username)
        except UserProfile.DoesNotExist as exc:
            raise CommandError(
                f"No ledger user '{username}'. Create one with: "
                f'python manage.py create_ledger_user "Shop Name" --username {username} --password "..."'
            ) from exc

        org: Organization = profile.organization
        set_current_organization(org)

        has_data = (
            Product.objects.filter(organization=org).exists()
            or Customer.objects.filter(organization=org).exclude(code="CUS-WALK").exists()
        )
        if has_data and not options["reset"]:
            self.stdout.write(
                f"{org.name} already has data ({Product.objects.filter(organization=org).count()} products). "
                "Use --reset to reload."
            )
            return

        if options["reset"] or has_data:
            self._clear_org_data(org)

        get_walkin_customer(org)

        all_products = self._seed_products(Product, ProductCategory, org, product_count)

        suppliers = []
        for name, phone in [
            ("Demo Pipe Suppliers", "9988001101"),
            ("City Sanitary Wholesale", "9988001102"),
        ]:
            s = Supplier.objects.create(
                organization=org,
                name=name,
                phone=phone,
                address="Wholesale Market, Demo City",
                gst="",
            )
            suppliers.append(s)

        for s in suppliers:
            purchase = Purchase.objects.create(
                organization=org,
                supplier=s,
                invoice_number=f"PINV-{s.code}",
                notes="Opening stock",
            )
            for p in all_products[: min(20, len(all_products))]:
                PurchaseItem.objects.create(
                    purchase=purchase,
                    product=p,
                    quantity=40,
                    unit_price=p.purchase_price,
                )

        customers_data = [
            ("Sharma Electricals", "Vikram Sharma", "9876100001", "Main Bazaar", Decimal("0")),
            ("Gupta Hardware", "Rakesh Gupta", "9876100002", "Station Road", Decimal("1200")),
            ("Singh Traders", "Harpreet Singh", "9876100003", "Industrial Area", Decimal("-800")),
            ("Metro Retail Point", "Anita Devi", "9876100004", "Civil Lines", Decimal("500")),
        ]
        customers = []
        for shop, owner, phone, area, opening in customers_data:
            c = Customer.objects.create(
                organization=org,
                shop_name=shop,
                owner_name=owner,
                phone=phone,
                area=area,
                address=f"{area}, Demo City",
                opening_balance=opening,
                credit_limit=Decimal("50000"),
            )
            customers.append(c)

        ball_valve = Product.objects.filter(organization=org, name__icontains="Ball Valve 1/2 inch").first()
        cpvc_pipe = Product.objects.filter(organization=org, name__icontains="CPVC Pipe 1/2 inch").first()
        if not ball_valve:
            ball_valve = all_products[0]
        if not cpvc_pipe:
            cpvc_pipe = all_products[1] if len(all_products) > 1 else all_products[0]

        qty1, qty2 = 8, 15
        line1 = ball_valve.sale_price * qty1
        line2 = cpvc_pipe.sale_price * qty2
        subtotal = line1 + line2
        paid = (subtotal * Decimal("0.6")).quantize(Decimal("0.01"))

        bill = Bill.objects.create(
            organization=org,
            customer=customers[0],
            subtotal=subtotal,
            discount_amount=Decimal("0"),
            gst_amount=Decimal("0"),
            round_off=Decimal("0"),
            total=subtotal,
            paid_amount=paid,
            payment_mode="partial",
            notes="Sample demo bill — partial payment",
        )
        BillItem.objects.create(
            bill=bill,
            product=ball_valve,
            quantity=qty1,
            rate=ball_valve.sale_price,
            amount=line1,
        )
        BillItem.objects.create(
            bill=bill,
            product=cpvc_pipe,
            quantity=qty2,
            rate=cpvc_pipe.sale_price,
            amount=line2,
        )
        bill.created_at = timezone.now() - timezone.timedelta(days=1)
        bill.save(update_fields=["created_at"])

        Payment.objects.create(
            organization=org,
            customer=customers[0],
            bill=bill,
            amount=paid,
            mode="cash",
            notes=f"Partial payment on {bill.bill_number}",
        )

        settings = BusinessSettings.load(org)
        settings.business_name = org.name
        settings.owner_name = "Demo Owner B"
        settings.address = "Shop 5, Demo Market, Demo City"
        settings.phone = "9876500200"
        settings.factory_details = "Demo Bank A/C 9876543210"
        settings.invoice_footer = "Thank you for your business!\nDemo shop — for training only."
        settings.home_subtitle = "Demo ledger — sample inventory & parties loaded"
        settings.setup_completed = True
        settings.save()

        self.stdout.write(self.style.SUCCESS(f"Demo seed complete for {org.name} (login: {username})."))
        self.stdout.write(f"  Products:   {Product.objects.filter(organization=org).count()}")
        self.stdout.write(f"  Customers:  {Customer.objects.filter(organization=org).exclude(code='CUS-WALK').count()}")
        self.stdout.write(f"  Suppliers:  {Supplier.objects.filter(organization=org).count()}")
        self.stdout.write(f"  Sample bill: {bill.bill_number} (partial paid)")
