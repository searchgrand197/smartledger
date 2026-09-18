import { useEffect, useRef } from "react";
import type { Customer } from "@/types";
import PartyCard from "./PartyCard";

interface Props {
  parties: Customer[];
  selectedId?: number | null;
  focusedIndex: number;
  onFocusedIndexChange: (index: number) => void;
  onSelect: (customer: Customer) => void;
  onDoubleSelect: (customer: Customer) => void;
}

export default function PartyGrid({
  parties,
  selectedId,
  focusedIndex,
  onFocusedIndexChange,
  onSelect,
  onDoubleSelect,
}: Props) {
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = cardRefs.current[focusedIndex];
    if (el && document.activeElement !== el) {
      el.focus();
    }
  }, [focusedIndex]);

  return (
    <div className="party-grid" role="listbox" aria-label="Customer parties">
      {parties.map((c, i) => (
        <PartyCard
          key={c.id}
          customer={c}
          selected={c.id === selectedId}
          focused={i === focusedIndex}
          onSelect={onSelect}
          onDoubleSelect={onDoubleSelect}
          tabIndex={i === focusedIndex ? 0 : -1}
          onFocus={() => onFocusedIndexChange(i)}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}
