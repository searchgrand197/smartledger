from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

User = get_user_model()

MIN_PRODUCTS = 100

CATEGORIES = [
    "Pipes & Fittings",
    "Valves",
    "Sanitary",
    "Electrical",
    "Tools",
    "Paints",
    "Fasteners",
    "Plumbing",
    "Hardware",
    "General",
]

PIPE_SIZES = ["1/2 inch", "3/4 inch", "1 inch", "1.5 inch", "2 inch"]
PIPE_LENGTHS = ["1m", "3m", "6m"]
VALVE_TYPES = ["Ball Valve", "Gate Valve", "Non-Return Valve", "Foot Valve"]
FITTING_TYPES = ["Elbow", "Tee", "Reducer", "Coupler", "Union", "End Cap"]
SANITARY_ITEMS = [
    ("Wall Mixer", "Jaquar", "Pc", 850, 1200, 25),
    ("Basin Tap", "Parryware", "Pc", 320, 480, 40),
    ("Sink Tap", "Hindware", "Pc", 280, 420, 35),
    ("Flush Tank", "Parryware", "Pc", 650, 950, 20),
    ("WC Seat Cover", "Cera", "Pc", 420, 620, 30),
    ("Shower Head", "Jaquar", "Pc", 380, 550, 28),
    ("Health Faucet", "Hindware", "Pc", 220, 340, 45),
    ("Bathroom Set", "Cera", "Set", 1800, 2600, 8),
    ("Floor Trap", "Supreme", "Pc", 45, 75, 80),
    ("Bottle Trap", "Jaquar", "Pc", 180, 280, 35),
]
ELECTRICAL_ITEMS = [
    ("LED Bulb 7W", "Philips", "Pc", 55, 85, 120),
    ("LED Bulb 9W", "Philips", "Pc", 65, 95, 150),
    ("LED Bulb 12W", "Syska", "Pc", 75, 110, 100),
    ("LED Tube 20W", "Philips", "Pc", 120, 180, 60),
    ("Switch 6A", "Anchor", "Pc", 18, 32, 200),
    ("Switch 16A", "Anchor", "Pc", 28, 48, 150),
    ("MCB 16A", "Havells", "Pc", 85, 135, 80),
    ("MCB 32A", "Havells", "Pc", 110, 165, 60),
    ("Ceiling Fan 48 inch", "Crompton", "Pc", 1100, 1550, 15),
    ("Ceiling Fan 36 inch", "Orient", "Pc", 950, 1350, 18),
    ("Extension Board 4 Socket", "Havells", "Pc", 280, 420, 40),
    ("Wire 1.0 sq mm", "Polycab", "Coil", 850, 1200, 25),
    ("Wire 1.5 sq mm", "Polycab", "Coil", 1100, 1550, 20),
    ("Wire 2.5 sq mm", "Finolex", "Coil", 1650, 2300, 15),
]
TOOL_ITEMS = [
    ("Claw Hammer 500g", "Taparia", "Pc", 180, 280, 40),
    ("Claw Hammer 750g", "Taparia", "Pc", 240, 360, 30),
    ("Screwdriver Set", "Stanley", "Set", 220, 350, 35),
    ("Pliers 8 inch", "Taparia", "Pc", 160, 250, 45),
    ("Adjustable Wrench 10 inch", "Taparia", "Pc", 280, 420, 30),
    ("Measuring Tape 5m", "Stanley", "Pc", 120, 190, 55),
    ("Hacksaw Frame", "Taparia", "Pc", 85, 140, 50),
    ("Pipe Wrench 14 inch", "Taparia", "Pc", 420, 620, 20),
]
PAINT_ITEMS = [
    ("Enamel Paint White 1L", "Asian", "Can", 180, 280, 40),
    ("Enamel Paint Black 1L", "Asian", "Can", 180, 280, 35),
    ("Primer 1L", "Berger", "Can", 140, 220, 45),
    ("Wall Putty 1kg", "Birla", "Bag", 45, 75, 80),
    ("Distemper White 10L", "Asian", "Bucket", 420, 620, 15),
]
FASTENER_ITEMS = [
    ("Screw Set 1 inch", "Generic", "Pkt", 25, 45, 100),
    ("Screw Set 2 inch", "Generic", "Pkt", 35, 55, 90),
    ("Nail Box 1 inch", "Generic", "Box", 40, 65, 70),
    ("Bolt Nut Set M8", "Generic", "Pkt", 55, 85, 60),
    ("Wall Plug 8mm", "Generic", "Pkt", 18, 32, 150),
]
HARDWARE_ITEMS = [
    ("Steel Rod 8mm", "Tata", "Pc", 120, 180, 50),
    ("Steel Rod 10mm", "Tata", "Pc", 150, 220, 45),
    ("Steel Rod 12mm", "Tata", "Pc", 180, 240, 40),
    ("Aluminium Sheet 2ft", "Hindalco", "Feet", 220, 290, 30),
    ("Door Hinge 4 inch", "Generic", "Pc", 35, 58, 120),
    ("Door Lock", "Godrej", "Pc", 280, 420, 35),
    ("Padlock 50mm", "Godrej", "Pc", 120, 185, 50),
]


def _build_product_specs():
    """Build at least MIN_PRODUCTS unique product definitions."""
    specs = []
    idx = 1

    def add(name, category, brand, unit, purchase, sale, stock):
        nonlocal idx
        specs.append(
            {
                "code": f"PRD-{idx:04d}",
                "name": name,
                "category": category,
                "brand": brand,
                "unit": unit,
                "purchase_price": Decimal(str(purchase)),
                "sale_price": Decimal(str(sale)),
                "current_stock": stock,
            }
        )
        idx += 1

    for size in PIPE_SIZES:
        for length in PIPE_LENGTHS:
            add(f"CPVC Pipe {size} ({length})", "Pipes & Fittings", "Supreme", "Pc", 45, 68, 80)
            add(f"PVC Pipe {size} ({length})", "Pipes & Fittings", "Finolex", "Pc", 38, 58, 90)

    for size in PIPE_SIZES:
        for fitting in FITTING_TYPES:
            add(f"{fitting} {size} CPVC", "Pipes & Fittings", "Supreme", "Pc", 12, 22, 120)

    for size in PIPE_SIZES:
        for vtype in VALVE_TYPES:
            base = {"Ball Valve": 85, "Gate Valve": 120, "Non-Return Valve": 95, "Foot Valve": 110}[vtype]
            add(f"{vtype} {size}", "Valves", "Leader", "Pc", base, int(base * 1.45), 35)

    for item in SANITARY_ITEMS:
        add(item[0], "Sanitary", item[1], item[2], item[3], item[4], item[5])

    for item in ELECTRICAL_ITEMS:
        add(item[0], "Electrical", item[1], item[2], item[3], item[4], item[5])

    for item in TOOL_ITEMS:
        add(item[0], "Tools", item[1], item[2], item[3], item[4], item[5])

    for item in PAINT_ITEMS:
        add(item[0], "Paints", item[1], item[2], item[3], item[4], item[5])

    for item in FASTENER_ITEMS:
        add(item[0], "Fasteners", item[1], item[2], item[3], item[4], item[5])

    for item in HARDWARE_ITEMS:
        add(item[0], "Hardware", item[1], item[2], item[3], item[4], item[5])

    # Pad with generic plumbing SKUs until we reach MIN_PRODUCTS
    pad_num = 1
    while len(specs) < MIN_PRODUCTS:
        add(
            f"Plumbing Item {pad_num:03d}",
            "Plumbing",
            "Generic",
            "Pc",
            20 + (pad_num % 40),
            35 + (pad_num % 55),
            20 + (pad_num % 80),
        )
        pad_num += 1

    return specs


class Command(BaseCommand):
    help = "Seed owner account and sample shop data (100+ products)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Clear existing business data and re-seed (keeps user account)",
        )
        parser.add_argument(
            "--min-products",
            type=int,
            default=MIN_PRODUCTS,
            help=f"Minimum number of products to ensure (default {MIN_PRODUCTS})",
        )

    def _ensure_categories(self, ProductCategory):
        categories = {}
        for name in CATEGORIES:
            categories[name], _ = ProductCategory.objects.get_or_create(name=name)
        return categories

    def _seed_products(self, Product, ProductCategory, min_count, org, reset=False):
        if reset:
            Product.objects.all().delete()
            ProductCategory.objects.all().delete()

        existing = Product.objects.count()
        if existing >= min_count and not reset:
            self.stdout.write(f"Products OK ({existing} items).")
            return {p.name: p for p in Product.objects.all()}

        categories = self._ensure_categories(ProductCategory)
        specs = _build_product_specs()
        if not reset:
            specs = [s for s in specs if not Product.objects.filter(code=s["code"]).exists()]
            needed = min_count - existing
            specs = specs[: max(needed, 0)]

        products = {}
        for spec in specs:
            cat = categories[spec["category"]]
            p = Product.objects.create(
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
            products[p.name] = p

        total = Product.objects.count()
        self.stdout.write(self.style.SUCCESS(f"Products ready: {total} items."))
        return products

    def handle(self, *args, **options):
        from billing.models import Bill, BillItem
        from business.models import BusinessSettings
        from customers.models import Customer
        from payments.models import Payment
        from products.models import Product, ProductCategory
        from purchases.models import Purchase, PurchaseItem, SupplierPayment
        from suppliers.models import Supplier

        min_products = options["min_products"]

        from accounts.models import Organization, UserProfile
        from core.tenant import set_current_organization

        user, created = User.objects.get_or_create(
            username=settings.OWNER_USERNAME,
            defaults={"email": settings.OWNER_EMAIL, "is_staff": True, "is_superuser": True},
        )
        if created or not user.check_password(settings.OWNER_PASSWORD):
            user.set_password(settings.OWNER_PASSWORD)
            user.save()
            self.stdout.write(self.style.SUCCESS("Owner account ready."))

        org, _ = Organization.objects.get_or_create(
            slug="default",
            defaults={"name": "Garg Sanitary Hardware and Electronics Store"},
        )
        UserProfile.objects.get_or_create(
            user=user,
            defaults={"organization": org, "role": UserProfile.ROLE_OWNER},
        )
        set_current_organization(org)

        settings_obj = BusinessSettings.load(org)
        settings_obj.owner_name = "Rajesh Sharma"
        settings_obj.business_name = "Garg Sanitary Hardware and Electronics Store"
        settings_obj.address = "Shop 12, Hardware Market, Main Road"
        settings_obj.phone = "9876500100"
        settings_obj.factory_details = "Bank: SBI A/C 12345678901, IFSC SBIN0001234"
        settings_obj.invoice_footer = (
            "Thank you! Quality plumbing materials at best rates.\n"
            "Goods once sold will not be taken back.\n"
            "Subject to local jurisdiction only."
        )
        settings_obj.home_title = "Smart Ledger"
        settings_obj.home_subtitle = "Billing & ledger for any shop or business"
        settings_obj.wholesale_option_title = "Wholesale / Parties"
        settings_obj.wholesale_option_desc = "Full shop — sale, parties, inventory & settings"
        settings_obj.customer_option_title = "Customer"
        settings_obj.customer_option_desc = "Login with customer code and phone to view billing history"
        settings_obj.save()

        from billing.walkin import get_walkin_customer

        get_walkin_customer(org)

        if Customer.objects.exists() and not options["reset"]:
            self._seed_products(Product, ProductCategory, min_products, org, reset=False)
            self.stdout.write("Business data already seeded. Use --reset to reload all sample data.")
            return

        if options["reset"]:
            BillItem.objects.all().delete()
            Bill.objects.all().delete()
            Payment.objects.all().delete()
            PurchaseItem.objects.all().delete()
            SupplierPayment.objects.all().delete()
            Purchase.objects.all().delete()
            Product.objects.all().delete()
            ProductCategory.objects.all().delete()
            Customer.objects.all().delete()
            Supplier.objects.all().delete()
            self.stdout.write("Cleared existing sample data.")

        products = self._seed_products(Product, ProductCategory, min_products, org, reset=False)
        all_products = list(Product.objects.all())

        suppliers = []
        for i, (name, phone) in enumerate(
            [
                ("National Pipe Distributors", "9876500001"),
                ("Metro Sanitary Wholesale", "9876500002"),
            ],
            1,
        ):
            s = Supplier.objects.create(
                organization=org,
                code=f"SUP-{i:04d}",
                name=name,
                phone=phone,
                address=f"Industrial Estate, Sector {i}",
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
            for p in all_products[:30]:
                PurchaseItem.objects.create(
                    purchase=purchase,
                    product=p,
                    quantity=50,
                    unit_price=p.purchase_price,
                )

        customers_data = [
            ("Foji Electrical", "Foji Singh", "8395110043", "Bhiwani Road", 0),
            ("Ravi Traders", "Ravi Sharma", "9123400001", "Civil Lines", 0),
            ("City Wholesale", "Amit Verma", "9123400002", "Industrial Area", 1500),
            ("Metro Retail Shop", "Suresh Patel", "9123400003", "Station Road", -500),
        ]
        customers = []
        for i, (shop, owner, phone, area, opening) in enumerate(customers_data, 1):
            c = Customer.objects.create(
                organization=org,
                code=f"CUS-{i:04d}",
                shop_name=shop,
                owner_name=owner,
                phone=phone,
                area=area,
                address=f"{area}, City",
                opening_balance=Decimal(str(opening)),
                credit_limit=Decimal("100000"),
            )
            customers.append(c)

        ball_valve = Product.objects.filter(name__icontains="Ball Valve 1/2 inch").first()
        cpvc_elbow = Product.objects.filter(name__icontains="Elbow 1/2 inch CPVC").first()
        if not ball_valve:
            ball_valve = all_products[0]
        if not cpvc_elbow:
            cpvc_elbow = all_products[1] if len(all_products) > 1 else all_products[0]

        today = timezone.now()
        bill = Bill.objects.create(
            organization=org,
            bill_number="BILL-0001",
            customer=customers[0],
            subtotal=Decimal("1320"),
            discount_amount=Decimal("0"),
            gst_amount=Decimal("0"),
            round_off=Decimal("0"),
            total=Decimal("1320"),
            paid_amount=Decimal("800"),
            payment_mode="partial",
            notes="Sample opening bill",
        )
        BillItem.objects.create(
            bill=bill,
            product=ball_valve,
            quantity=10,
            rate=ball_valve.sale_price,
            amount=ball_valve.sale_price * 10,
        )
        BillItem.objects.create(
            bill=bill,
            product=cpvc_elbow,
            quantity=20,
            rate=cpvc_elbow.sale_price,
            amount=cpvc_elbow.sale_price * 20,
        )
        bill.created_at = today - timezone.timedelta(days=2)
        bill.save(update_fields=["created_at"])

        Payment.objects.create(
            organization=org,
            customer=customers[0],
            bill=bill,
            amount=Decimal("800"),
            mode="cash",
            notes="Partial payment on BILL-0001",
        )

        from django.contrib.auth import get_user_model
        from returns.services import create_sales_return

        admin_user = get_user_model().objects.filter(is_superuser=True).first()
        first_item = bill.items.first()
        if admin_user and first_item:
            create_sales_return(
                bill=bill,
                return_type="credit_note",
                refund_mode="ledger_credit",
                items=[{"bill_item_id": first_item.id, "quantity": 2, "reason": "Sample damaged goods"}],
                notes="Sample sales return for demo",
                user=admin_user,
            )

        self.stdout.write(self.style.SUCCESS("Sample shop seed data created successfully."))
