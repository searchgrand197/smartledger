import { Button } from "@mui/material";
import { PARTY_FILTERS, type PartyFilter } from "./partyPickerUtils";

interface Props {
  value: PartyFilter;
  onChange: (filter: PartyFilter) => void;
}

export default function PartyFilters({ value, onChange }: Props) {
  return (
    <div className="party-filters" role="tablist" aria-label="Party filters">
      {PARTY_FILTERS.map((f) => (
        <Button
          key={f.id}
          size="small"
          className={`party-filter-pill${value === f.id ? " party-filter-pill--active" : ""}`}
          onClick={() => onChange(f.id)}
          role="tab"
          aria-selected={value === f.id}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}
