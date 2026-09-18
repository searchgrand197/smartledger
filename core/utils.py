import re
from decimal import Decimal


def next_sequence(prefix: str, model, field_name: str = "code", organization=None) -> str:
    """Generate next auto ID like CUS-0001, SUP-0001 (ignores special codes e.g. CUS-WALK)."""
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    max_num = 0
    manager = getattr(model, "all_objects", model.objects)
    qs = manager.filter(**{f"{field_name}__startswith": f"{prefix}-"})
    if organization is not None and hasattr(model, "organization_id"):
        qs = qs.filter(organization=organization)
    for obj in qs.only(field_name):
        code = getattr(obj, field_name)
        match = pattern.match(code)
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f"{prefix}-{max_num + 1:04d}"


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


STOCK_ALERT_RATIO = Decimal("0.20")


def stock_alert_level(stock: int) -> int:
    """Low-stock threshold: alert when stock falls to 20% of the last stocked level."""
    return max(1, int(Decimal(max(stock, 0)) * STOCK_ALERT_RATIO))


def update_product_stock(
    product,
    quantity_delta: int,
    *,
    movement_type: str | None = None,
    reference_id: int | None = None,
    reference_label: str = "",
    notes: str = "",
    user=None,
):
    product.current_stock = product.current_stock + quantity_delta
    update_fields = ["current_stock", "updated_at"]
    if quantity_delta > 0:
        if not product.minimum_stock:
            product.minimum_stock = stock_alert_level(product.current_stock)
            update_fields.append("minimum_stock")
    product.save(update_fields=update_fields)
    if movement_type:
        from products.models import StockMovement

        StockMovement.objects.create(
            product=product,
            quantity_delta=quantity_delta,
            quantity_after=product.current_stock,
            movement_type=movement_type,
            reference_id=reference_id,
            reference_label=reference_label,
            notes=notes,
            created_by=user,
        )
