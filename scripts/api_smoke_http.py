"""HTTP smoke test via localhost:8000. Run while runserver is up."""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"


def req(method, path, body=None, token=None, accept=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if accept:
        headers["Accept"] = accept
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def main():
    failed = []
    ok = lambda s, m, p: print(f"OK  {s} {m} {p}") if s < 300 else failed.append((m, p, s)) or print(f"FAIL {s} {m} {p}")

    s, _ = req("GET", "/api/business/settings/public/")
    ok(s, "GET", "/api/business/settings/public/")

    s, body = req("POST", "/api/auth/login/", {"username": "owner", "password": "Wholesale@2026"})
    ok(s, "POST", "/api/auth/login/")
    if s != 200:
        print("Cannot continue without login")
        sys.exit(1)
    token = json.loads(body)["access"]

    for path in [
        "/api/business/settings/",
        "/api/customers/",
        "/api/suppliers/",
        "/api/products/",
        "/api/billing/",
        "/api/payments/",
        "/api/payments/dues/",
        "/api/dashboard/",
        "/api/billing/context/?customer_id=1",
        "/api/billing/rate-hint/?customer_id=1&product_id=1",
    ]:
        s, _ = req("GET", path, token=token)
        ok(s, "GET", path)

    s, body = req(
        "POST",
        "/api/customers/",
        {
            "shop_name": "Smoke Test Shop",
            "owner_name": "Tester",
            "phone": "8888800001",
            "area": "Test",
            "credit_limit": 1000,
        },
        token=token,
    )
    ok(s, "POST", "/api/customers/ (create)")

    s, body = req("GET", "/api/customers/5/ledger/pdf/", token=token, accept="application/pdf")
    pdf = body[:4] == b"%PDF" if s == 200 else False
    print(f"{'OK' if pdf else 'FAIL'} {s} GET /api/customers/5/ledger/pdf/ (pdf={pdf})")
    if not pdf:
        failed.append(("GET ledger pdf", s))

    print(f"\n{'All OK' if not failed else f'{len(failed)} failed'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
