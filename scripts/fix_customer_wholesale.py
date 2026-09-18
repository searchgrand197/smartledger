import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("USE_SQLITE", "true")

import django
django.setup()

from customers.models import Customer
from billing.models import Bill

# 1. Update customers who have bills of type "simple" to is_wholesale=False
simple_customer_ids = Bill.all_objects.filter(bill_type="simple").values_list("customer_id", flat=True).distinct()
updated = Customer.all_objects.filter(id__in=simple_customer_ids).exclude(code="CUS-WALK").update(is_wholesale=False)
print(f"Updated {updated} legacy counter customers to is_wholesale=False.")

# 2. Make sure CUS-WALK is also updated
Customer.all_objects.filter(code="CUS-WALK").update(is_wholesale=False)
print("Updated CUS-WALK to is_wholesale=False.")
