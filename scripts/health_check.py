#!/usr/bin/env python3
"""Comprehensive smoke-test for wholesale + customer portal APIs."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"
WHOLESALE_USER = "owner"
WHOLESALE_PASS = "Wholesale@2026"

results: list[tuple[str, str, str]] = []


def req(method: str, path: str, *, token: str | None = None, portal: str | None = None, body: dict | None = None, accept: str = "application/json"):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": accept}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if portal:
        headers["X-Customer-Token"] = portal
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            raw = resp.read()
            if accept == "application/pdf":
                return resp.status, {"bytes": len(raw)}
            text = raw.decode()
            return resp.status, json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw) if raw else {"detail": str(e)}
        except json.JSONDecodeError:
            payload = {"detail": raw or str(e)}
        return e.code, payload


def record(area: str, name: str, status: int, expect=(200, 201)):
    good = status in expect
    results.append((area, name, "PASS" if good else f"FAIL ({status})"))
    return good


def main() -> int:
    status, data = req("POST", "/auth/login/", body={"username": WHOLESALE_USER, "password": WHOLESALE_PASS})
    if not record("Auth", "Wholesale login", status):
        print(json.dumps(data))
        return 1
    jwt = data["access"]
    record("Auth", "JWT issued", 200)

    status, pdata = req("POST", "/auth/portal-token/", token=jwt)
    if not record("Auth", "Portal token", status):
        return 1
    portal_token = pdata["token"]
    record("Auth", "Portal token value", 200)

    wholesale = [
        ("GET", "/auth/me/"),
        ("GET", "/customers/?page_size=5"),
        ("GET", "/suppliers/?page_size=5"),
        ("GET", "/products/?page_size=5"),
        ("GET", "/products/categories/"),
        ("GET", "/products/stock-movements/?page_size=5"),
        ("GET", "/billing/?page_size=5"),
        ("GET", "/returns/?page_size=5"),
        ("GET", "/payments/?page_size=5"),
        ("GET", "/business/settings/"),
        ("GET", "/billing/whatsapp/status/"),
        ("GET", "/dashboard/"),
        ("GET", "/messaging/queue/stats/"),
    ]
    for method, path in wholesale:
        record("Wholesale", path, req(method, path, token=jwt)[0])

    portal = [
        ("GET", "/customers/portal/dashboard/"),
        ("GET", "/customers/portal/customers/"),
        ("GET", "/customers/portal/products/?all=true"),
        ("GET", "/customers/portal/products/categories/"),
        ("GET", "/customers/portal/quick-sales/"),
        ("GET", "/customers/portal/returns/?page_size=5"),
        ("GET", "/customers/portal/ledger/pdf/", "application/pdf"),
    ]
    for item in portal:
        method, path = item[0], item[1]
        accept = item[2] if len(item) > 2 else "application/json"
        record("Customer portal", path, req(method, path, portal=portal_token, accept=accept)[0])

    # Deep checks with real IDs
    _, bills = req("GET", "/billing/?page_size=3", token=jwt)
    bill_rows = bills.get("results", bills) if isinstance(bills, dict) else bills
    bill_id = bill_rows[0]["id"] if bill_rows else None

    _, portal_bills = req("GET", "/customers/portal/quick-sales/", portal=portal_token)
    pb_rows = portal_bills if isinstance(portal_bills, list) else portal_bills.get("results", [])
    portal_bill_id = pb_rows[0]["id"] if pb_rows else None

    _, customers = req("GET", "/customers/?page_size=3", token=jwt)
    cust_rows = customers.get("results", customers) if isinstance(customers, dict) else customers
    cust_id = next((c["id"] for c in cust_rows if c.get("code") != "CUS-WALK"), None)

    _, portal_customers = req("GET", "/customers/portal/customers/", portal=portal_token)
    pc_rows = portal_customers if isinstance(portal_customers, list) else portal_customers.get("results", [])
    portal_cust_id = pc_rows[0]["id"] if pc_rows else None

    _, products = req("GET", "/products/?page_size=1", token=jwt)
    prod_rows = products.get("results", products) if isinstance(products, dict) else products
    prod_id = prod_rows[0]["id"] if prod_rows else None

    _, returns = req("GET", "/returns/?page_size=1", token=jwt)
    ret_rows = returns.get("results", returns) if isinstance(returns, dict) else returns
    return_id = ret_rows[0]["id"] if ret_rows else None

    _, portal_returns = req("GET", "/customers/portal/returns/?page_size=1", portal=portal_token)
    pr_rows = portal_returns.get("results", portal_returns) if isinstance(portal_returns, dict) else portal_returns
    portal_return_id = pr_rows[0]["id"] if pr_rows else None

    if bill_id:
        record("Wholesale", f"Bill detail #{bill_id}", req("GET", f"/billing/{bill_id}/", token=jwt)[0])
        record("Wholesale", f"Bill print-data #{bill_id}", req("GET", f"/billing/{bill_id}/print-data/", token=jwt)[0])
        record("Wholesale", f"Bill PDF #{bill_id}", req("GET", f"/billing/{bill_id}/pdf/", token=jwt, accept="application/pdf")[0])
        record("Wholesale", f"Return eligibility #{bill_id}", req("GET", f"/returns/bill/{bill_id}/eligibility/", token=jwt)[0])
    else:
        results.append(("Wholesale", "Bill deep checks", "SKIP (no bills)"))

    if portal_bill_id:
        record("Customer portal", f"Bill edit load #{portal_bill_id}", req("GET", f"/customers/portal/billing/{portal_bill_id}/update/", portal=portal_token)[0])
        record("Customer portal", f"Bill print-data #{portal_bill_id}", req("GET", f"/customers/portal/billing/{portal_bill_id}/print-data/", portal=portal_token)[0])
        record("Customer portal", f"Bill PDF #{portal_bill_id}", req("GET", f"/customers/portal/billing/{portal_bill_id}/pdf/", portal=portal_token, accept="application/pdf")[0])
        record("Customer portal", f"Return eligibility #{portal_bill_id}", req("GET", f"/customers/portal/billing/{portal_bill_id}/return-eligibility/", portal=portal_token)[0])
        estatus, edata = req("GET", f"/customers/portal/billing/{portal_bill_id}/update/", portal=portal_token)
        if estatus == 200 and edata.get("customer"):
            cid = edata["customer"]
            cstatus, cdata = req("GET", f"/customers/portal/customers/{cid}/", portal=portal_token)
            record("Customer portal", f"Customer detail #{cid}", cstatus)
            if cstatus == 200 and isinstance(cdata, dict) and cdata.get("customer"):
                results.append(("Customer portal", "Bill-edit customer detail shape", "PASS"))
            else:
                results.append(("Customer portal", "Bill-edit customer detail shape", "FAIL (expected nested customer)"))
    else:
        results.append(("Customer portal", "Bill deep checks", "SKIP (no bills)"))

    if cust_id:
        record("Wholesale", f"Customer ledger #{cust_id}", req("GET", f"/ledger/customer/{cust_id}/", token=jwt)[0])
        record("Wholesale", f"Customer profile #{cust_id}", req("GET", f"/customers/{cust_id}/profile/", token=jwt)[0])
        record("Wholesale", f"Customer ledger PDF #{cust_id}", req("GET", f"/customers/{cust_id}/ledger/pdf/", token=jwt, accept="application/pdf")[0])
    if portal_cust_id:
        record("Customer portal", f"Customer profile #{portal_cust_id}", req("GET", f"/customers/portal/customers/{portal_cust_id}/", portal=portal_token)[0])
        record("Customer portal", f"Customer ledger PDF #{portal_cust_id}", req("GET", f"/customers/portal/customers/{portal_cust_id}/ledger/pdf/", portal=portal_token, accept="application/pdf")[0])

    if prod_id and cust_id:
        record("Wholesale", "Billing rate-hint", req("GET", f"/billing/rate-hint/?customer_id={cust_id}&product_id={prod_id}", token=jwt)[0])
        record("Wholesale", "Billing context", req("GET", f"/billing/context/?customer_id={cust_id}&product_id={prod_id}", token=jwt)[0])

    if return_id:
        record("Wholesale", f"Return detail #{return_id}", req("GET", f"/returns/{return_id}/", token=jwt)[0])
        record("Wholesale", f"Return print-data #{return_id}", req("GET", f"/returns/{return_id}/print-data/", token=jwt)[0])
    if portal_return_id:
        record("Customer portal", f"Return detail #{portal_return_id}", req("GET", f"/customers/portal/returns/{portal_return_id}/", portal=portal_token)[0])
        record("Customer portal", f"Return print-data #{portal_return_id}", req("GET", f"/customers/portal/returns/{portal_return_id}/print-data/", portal=portal_token)[0])

    print("\n=== SmartLedger Full Health Check ===\n")
    current = None
    pass_n = fail_n = skip_n = 0
    failures: list[str] = []
    for area, name, stat in results:
        if area != current:
            current = area
            print(f"\n[{area}]")
        icon = "[OK]" if stat == "PASS" else ("[--]" if stat.startswith("SKIP") else "[!!]")
        print(f"  {icon} {name}: {stat}")
        if stat == "PASS":
            pass_n += 1
        elif stat.startswith("SKIP"):
            skip_n += 1
        else:
            fail_n += 1
            failures.append(f"{area}: {name} -> {stat}")

    print(f"\nSummary: {pass_n} passed, {fail_n} failed, {skip_n} skipped")
    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"  - {f}")
    return 1 if fail_n else 0


if __name__ == "__main__":
    sys.exit(main())
