import { forwardRef } from "react";
import CheckIcon from "@mui/icons-material/Check";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import { formatCurrency } from "@/utils/format";
import type { Customer } from "@/types";

interface Props {
  customer: Customer;
  selected?: boolean;
  focused?: boolean;
  onSelect: (customer: Customer) => void;
  onDoubleSelect: (customer: Customer) => void;
  tabIndex?: number;
  onFocus?: () => void;
}

const PartyCard = forwardRef<HTMLButtonElement, Props>(function PartyCard(
  { customer, selected, focused, onSelect, onDoubleSelect, tabIndex = 0, onFocus },
  ref
) {
  const due = Number(customer.current_due ?? 0);
  const hasDue = due > 0;

  return (
    <button
      ref={ref}
      type="button"
      className={[
        "party-card",
        selected ? "party-card--selected" : "",
        focused ? "party-card--focused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(customer)}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleSelect(customer);
      }}
      onFocus={onFocus}
      tabIndex={tabIndex}
      aria-label={`Select ${customer.shop_name}, ${customer.code}${hasDue ? `, due ${formatCurrency(due)}` : ", paid"}`}
      aria-pressed={selected}
    >
      {selected ? (
        <span className="party-card__check" aria-hidden>
          <CheckIcon sx={{ fontSize: 14 }} />
        </span>
      ) : (
        <span className={`party-card__badge ${hasDue ? "party-card__badge--due" : "party-card__badge--paid"}`}>
          {hasDue ? "DUE" : "PAID"}
        </span>
      )}

      <div className="party-card__body">
        <div className="party-card__name" title={customer.shop_name}>
          {customer.shop_name}
        </div>
        <div className="party-card__code">{customer.code}</div>
        <div className="party-card__phone">
          <PhoneOutlinedIcon sx={{ fontSize: 14 }} />
          {customer.phone || "—"}
        </div>
      </div>

      <div className={`party-card__due-block${hasDue ? "" : " party-card__due-block--zero"}`}>
        <div className="party-card__due-label">Outstanding Balance</div>
        <div
          className={`party-card__due-amount ${hasDue ? "party-card__due-amount--due" : "party-card__due-amount--paid"}`}
        >
          {hasDue ? formatCurrency(due) : "₹0.00"}
        </div>
      </div>
    </button>
  );
});

export default PartyCard;
