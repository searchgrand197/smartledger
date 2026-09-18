from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from accounts.models import Organization, UserProfile
from billing.models import Bill, BillItem
from customers.models import Customer
from products.models import Product, ProductCategory
from returns.models import SalesReturn, StoreCreditBalance
from returns.services import (
    ReturnValidationError,
    cancel_sales_return,
    create_sales_return,
    get_returnable_items,
)

User = get_user_model()


class SalesReturnTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Test Org", slug="test-org")
        from core.tenant import set_current_organization
        set_current_organization(self.org)
        self.user = User.objects.create_user(username="returntest", password="test")
        UserProfile.objects.create(user=self.user, organization=self.org, role=UserProfile.ROLE_OWNER)
        self.customer = Customer.objects.create(
            organization=self.org,
            shop_name="Test Party",
            owner_name="Owner",
            phone="9999999999",
        )
        cat = ProductCategory.objects.create(name="General")
        self.product = Product.objects.create(
            organization=self.org,
            name="Test Product",
            category=cat,
            sale_price=Decimal("100"),
            purchase_price=Decimal("60"),
            current_stock=50,
        )
        self.bill = Bill.objects.create(
            organization=self.org,
            customer=self.customer,
            bill_type="party",
            payment_mode="credit",
        )
        BillItem.objects.create(
            bill=self.bill,
            product=self.product,
            quantity=10,
            rate=Decimal("100"),
        )
        self.bill.refresh_from_db()
        self.product.refresh_from_db()
        self.stock_after_sale = self.product.current_stock

    def tearDown(self):
        from core.tenant import set_current_organization
        set_current_organization(None)

    def test_partial_return_restores_stock(self):
        sr = create_sales_return(
            bill=self.bill,
            return_type="credit_note",
            refund_mode="ledger_credit",
            items=[{"bill_item_id": self.bill.items.first().id, "quantity": 2, "reason": "Damaged"}],
            user=self.user,
        )
        self.product.refresh_from_db()
        self.assertEqual(sr.total, Decimal("200.00"))
        self.assertEqual(self.product.current_stock, self.stock_after_sale + 2)
        self.assertEqual(get_returnable_items(self.bill)[0]["returnable_quantity"], 8)

    def test_combined_return_tracks_secondary_bill(self):
        from returns.services import create_combined_sales_return

        bill2 = Bill.objects.create(
            organization=self.org,
            customer=self.customer,
            bill_type="party",
            payment_mode="credit",
        )
        item2 = BillItem.objects.create(
            bill=bill2,
            product=self.product,
            quantity=5,
            rate=Decimal("100"),
        )
        create_combined_sales_return(
            bill_entries=[
                {
                    "bill_id": self.bill.id,
                    "items": [{"bill_item_id": self.bill.items.first().id, "quantity": 1}],
                },
                {
                    "bill_id": bill2.id,
                    "items": [{"bill_item_id": item2.id, "quantity": 3}],
                },
            ],
            return_type="credit_note",
            refund_mode="ledger_credit",
            user=self.user,
        )
        secondary = get_returnable_items(bill2)[0]
        self.assertEqual(secondary["returned_quantity"], 3)
        self.assertEqual(secondary["returnable_quantity"], 2)

    def test_cannot_exceed_returnable_qty(self):
        create_sales_return(
            bill=self.bill,
            return_type="credit_note",
            refund_mode="ledger_credit",
            items=[{"bill_item_id": self.bill.items.first().id, "quantity": 2}],
            user=self.user,
        )
        with self.assertRaises(ReturnValidationError):
            create_sales_return(
                bill=self.bill,
                return_type="credit_note",
                refund_mode="ledger_credit",
                items=[{"bill_item_id": self.bill.items.first().id, "quantity": 9}],
                user=self.user,
            )

    def test_cancel_return_reverses_stock(self):
        sr = create_sales_return(
            bill=self.bill,
            return_type="refund",
            refund_mode="ledger_credit",
            items=[{"bill_item_id": self.bill.items.first().id, "quantity": 3}],
            user=self.user,
        )
        self.product.refresh_from_db()
        after_return = self.product.current_stock
        cancel_sales_return(sr, user=self.user)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock, after_return - 3)
        sr.refresh_from_db()
        self.assertTrue(sr.is_cancelled)

    def test_store_credit_for_walkin_style(self):
        from billing.walkin import get_walkin_customer

        walkin = get_walkin_customer(self.org)
        simple_bill = Bill.objects.create(
            organization=self.org,
            customer=walkin,
            bill_type="simple",
            payment_mode="cash",
        )
        BillItem.objects.create(
            bill=simple_bill,
            product=self.product,
            quantity=5,
            rate=Decimal("100"),
        )
        sr = create_sales_return(
            bill=simple_bill,
            return_type="refund",
            refund_mode="store_credit",
            items=[{"bill_item_id": simple_bill.items.first().id, "quantity": 1}],
            user=self.user,
        )
        bal = StoreCreditBalance.objects.get(customer=walkin)
        self.assertEqual(bal.balance, Decimal("100.00"))
        self.assertEqual(sr.refund_mode, "store_credit")

    def test_ledger_includes_return_credit(self):
        from ledger.services import get_ledger_entries

        create_sales_return(
            bill=self.bill,
            return_type="credit_note",
            refund_mode="ledger_credit",
            items=[{"bill_item_id": self.bill.items.first().id, "quantity": 2}],
            user=self.user,
        )
        entries = get_ledger_entries(self.customer)
        credits = [e for e in entries if "Sales Return" in e.get("description", "")]
        self.assertEqual(len(credits), 1)
        self.assertEqual(Decimal(str(credits[0]["credit"])), Decimal("200.00"))

    def test_organization_isolation(self):
        from core.tenant import set_current_organization
        
        # Create a second organization and its isolated records
        org2 = Organization.objects.create(name="Second Org", slug="second-org")
        
        # Temporarily switch context to create records in org2
        set_current_organization(org2)
        customer2 = Customer.objects.create(
            organization=org2,
            shop_name="Org 2 Customer",
            owner_name="Owner 2",
            phone="8888888888",
        )
        cat2 = ProductCategory.objects.create(name="General 2")
        product2 = Product.objects.create(
            organization=org2,
            name="Org 2 Product",
            category=cat2,
            sale_price=Decimal("150"),
            purchase_price=Decimal("80"),
            current_stock=10,
        )
        
        # Switch context back to org1 (self.org)
        set_current_organization(self.org)
        
        # 1. Under self.org, customer2 and product2 should NOT be accessible
        self.assertFalse(Customer.objects.filter(pk=customer2.pk).exists())
        self.assertFalse(Product.objects.filter(pk=product2.pk).exists())
        
        # 2. Under self.org, self.customer and self.product SHOULD be accessible
        self.assertTrue(Customer.objects.filter(pk=self.customer.pk).exists())
        self.assertTrue(Product.objects.filter(pk=self.product.pk).exists())
        
        # 3. Switch context to org2
        set_current_organization(org2)
        
        # Under org2, self.customer and self.product should NOT be accessible
        self.assertFalse(Customer.objects.filter(pk=self.customer.pk).exists())
        self.assertFalse(Product.objects.filter(pk=self.product.pk).exists())
        
        # Under org2, customer2 and product2 SHOULD be accessible
        self.assertTrue(Customer.objects.filter(pk=customer2.pk).exists())
        self.assertTrue(Product.objects.filter(pk=product2.pk).exists())

    def test_whatsapp_pdf_generation_and_simulation(self):
        from core.whatsapp import send_bill_pdf_to_whatsapp
        import os
        from django.conf import settings
        from unittest.mock import patch, MagicMock

        # Clear any existing environment variables to force simulation mode
        old_token = os.environ.pop("WHATSAPP_API_TOKEN", None)
        old_id = os.environ.pop("WHATSAPP_PHONE_NUMBER_ID", None)

        try:
            # Set a valid phone number on customer
            self.customer.phone = "9876543210"
            self.customer.save()

            # Mock requests.post to simulate successful local gateway delivery
            with patch("requests.post") as mock_post:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_post.return_value = mock_response

                # Execute sending PDF to WhatsApp
                res = send_bill_pdf_to_whatsapp(self.bill)

                # Assertions
                self.assertEqual(res["status"], "success")
                self.assertEqual(res["phone"], "919876543210")
                self.assertEqual(res["bill_number"], self.bill.bill_number)
                self.assertEqual(res["sent_via"], "local-gateway")
                self.assertNotIn("\\", res["pdf_url"])

            # Check that the file was generated and saved locally
            expected_filename = f"{self.bill.bill_number.replace('/', '_')}.pdf"
            file_path = os.path.join(settings.MEDIA_ROOT, "whatsapp_invoices", expected_filename)
            self.assertTrue(os.path.exists(file_path))

            # Clean up the test file
            if os.path.exists(file_path):
                os.remove(file_path)

        finally:
            # Restore environment variables
            if old_token is not None:
                os.environ["WHATSAPP_API_TOKEN"] = old_token
            if old_id is not None:
                os.environ["WHATSAPP_PHONE_NUMBER_ID"] = old_id
