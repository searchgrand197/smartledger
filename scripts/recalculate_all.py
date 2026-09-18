import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("USE_SQLITE", "true")

import django
django.setup()

from django.db.models import Sum
from billing.models import Bill
from purchases.models import Purchase

print("Starting recalculation script...")

# 1. Recalculate all bills and fix paid_amount and payment_mode
bills = Bill.all_objects.all()
for b in bills:
    b.recalculate()
    # Fetch sum of payments associated with the bill
    total_paid = b.payments.all().aggregate(total=Sum("amount"))["total"] or Decimal("0")
    b.paid_amount = total_paid
    
    if b.bill_type == "simple":
        # Simple/Walk-in bills are always fully paid cash/UPI sales
        b.paid_amount = b.total
        # Correct the associated Payment record's amount if it was saved as 0 due to the bug
        payment = b.payments.all().first()
        if payment and payment.amount != b.total:
            payment.amount = b.total
            payment.save(update_fields=["amount"])
            print(f"Fixed Payment record amount to {b.total} for Simple Bill {b.bill_number}")
            
    # Standardize payment mode based on correct paid amount
    if b.paid_amount <= 0:
        b.payment_mode = "credit"
    elif b.paid_amount >= b.total:
        if b.payment_mode not in ("cash", "upi"):
            b.payment_mode = "cash"
    else:
        b.payment_mode = "partial"
        
    b.save(update_fields=["paid_amount", "payment_mode"])
    print(f"Recalculated Bill {b.bill_number}: Subtotal={b.subtotal}, Total={b.total}, Paid={b.paid_amount}")

print(f"Successfully processed {bills.count()} bills.")

# 2. Recalculate all purchases
purchases = Purchase.all_objects.all()
for p in purchases:
    p.recalculate()
    print(f"Recalculated Purchase PO-{p.id}: Subtotal={p.subtotal}, Total={p.total}")

print(f"Successfully processed {purchases.count()} purchases.")
print("Recalculation and database fix complete.")
