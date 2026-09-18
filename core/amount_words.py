"""Convert amount to words (Indian English) for invoices."""

from decimal import Decimal

_ONES = (
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
)
_TENS = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")


def _under_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return f"{_TENS[n // 10]} {_ONES[n % 10]}".strip()


def _under_thousand(n: int) -> str:
    if n < 100:
        return _under_hundred(n)
    return f"{_ONES[n // 100]} Hundred {_under_hundred(n % 100)}".strip()


def _int_to_words(n: int) -> str:
    if n == 0:
        return "Zero"
    parts = []
    if n >= 10000000:
        parts.append(f"{_int_to_words(n // 10000000)} Crore")
        n %= 10000000
    if n >= 100000:
        parts.append(f"{_under_thousand(n // 100000)} Lakh")
        n %= 100000
    if n >= 1000:
        parts.append(f"{_under_thousand(n // 1000)} Thousand")
        n %= 1000
    if n:
        parts.append(_under_thousand(n))
    return " ".join(p for p in parts if p).strip()


def amount_in_words(amount) -> str:
    value = Decimal(str(amount or 0)).quantize(Decimal("0.01"))
    rupees = int(value)
    paise = int((value - rupees) * 100)
    text = f"{_int_to_words(rupees)} Rupees"
    if paise:
        text += f" and {_int_to_words(paise)} Paise"
    return text + " only"
