"""
Smoke-test frontend API paths. Run: python scripts/api_smoke_test.py
Requires: backend venv, USE_SQLITE=true, owner user exists.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("USE_SQLITE", "true")
os.environ["ALLOWED_HOSTS"] = "localhost,127.0.0.1,testserver"

import django

django.setup()

from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
user = User.objects.filter(is_superuser=True).first() or User.objects.first()
if not user:
    print("FAIL: No user in database. Run: python manage.py seed_data")
    sys.exit(1)

refresh = RefreshToken.for_user(user)
token = str(refresh.access_token)
client = Client()
auth = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

tests = [
    ("GET", "/api/business/settings/public/", False, None),
    ("POST", "/api/auth/login/", False, {"username": "owner", "password": "Wholesale@2026"}),
    ("GET", "/api/business/settings/", True, None),
    ("GET", "/api/customers/", True, None),
    ("GET", "/api/suppliers/", True, None),
    ("GET", "/api/products/", True, None),
    ("GET", "/api/billing/", True, None),
    ("GET", "/api/payments/", True, None),
    ("GET", "/api/payments/dues/", True, None),
    ("GET", "/api/dashboard/", True, None),
]

print(f"Testing as user: {user.username}\n")
failed = []
for method, path, needs_auth, body in tests:
    kwargs = auth if needs_auth else {}
    if method == "GET":
        r = client.get(path, **kwargs)
    else:
        r = client.post(path, data=json.dumps(body or {}), content_type="application/json", **kwargs)
    ok = 200 <= r.status_code < 300
    status = "OK" if ok else "FAIL"
    print(f"{status} {r.status_code} {method} {path}")
    if not ok:
        failed.append((path, r.status_code, r.content[:200]))

# Customer create (remove test party after verify)
create_body = {
    "shop_name": "API Test",
    "owner_name": "Test",
    "phone": "9999900001",
    "area": "X",
    "credit_limit": 1000,
}
r = client.post(
    "/api/customers/",
    data=json.dumps(create_body),
    content_type="application/json",
    **auth,
)
create_ok = r.status_code == 201
print(f"{'OK' if create_ok else 'FAIL'} {r.status_code} POST /api/customers/ (create)")
if not create_ok:
    failed.append(("POST /api/customers/", r.status_code, r.content[:300]))
elif create_ok:
    test_customer_id = r.json().get("id")
    if test_customer_id:
        del_r = client.delete(f"/api/customers/{test_customer_id}/", **auth)
        del_ok = del_r.status_code in (200, 204)
        print(
            f"{'OK' if del_ok else 'FAIL'} {del_r.status_code} DELETE /api/customers/{test_customer_id}/ (cleanup)"
        )
        if not del_ok:
            failed.append(
                (f"DELETE /api/customers/{test_customer_id}/", del_r.status_code, del_r.content[:300])
            )

# Ledger PDF
cid = 1
from customers.models import Customer

c = Customer.objects.filter(is_active=True).exclude(code="CUS-WALK").first()
if c:
    r = client.get(f"/api/customers/{c.id}/ledger/pdf/", HTTP_ACCEPT="application/pdf", **auth)
    pdf_ok = r.status_code == 200 and r.content[:4] == b"%PDF"
    print(f"{'OK' if pdf_ok else 'FAIL'} {r.status_code} GET /api/customers/{c.id}/ledger/pdf/")
    if not pdf_ok:
        failed.append(("ledger pdf", r.status_code, r.content[:100]))

print("\n" + ("All checks passed." if not failed else f"{len(failed)} check(s) failed."))
for item in failed:
    print(" ", item)
