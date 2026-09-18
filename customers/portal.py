from django.core import signing

PORTAL_SALT = "customer-portal-v1"
PORTAL_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def make_portal_token(customer_id: int) -> str:
    signer = signing.TimestampSigner(salt=PORTAL_SALT)
    return signer.sign(str(customer_id))


def verify_portal_token(token: str) -> int | None:
    signer = signing.TimestampSigner(salt=PORTAL_SALT)
    try:
        value = signer.unsign(token, max_age=PORTAL_MAX_AGE)
        return int(value)
    except (signing.BadSignature, signing.SignatureExpired, ValueError):
        return None
