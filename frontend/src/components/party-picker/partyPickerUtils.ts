export type PartyFilter = "all" | "outstanding" | "paid" | "recent" | "wholesale";

export const PARTY_FILTERS: { id: PartyFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "outstanding", label: "Outstanding" },
  { id: "paid", label: "Paid" },
  { id: "recent", label: "Recent" },
  { id: "wholesale", label: "Wholesale" },
];

export const PARTY_PAGE_SIZE = 15;

export const WALK_IN_CUSTOMER_CODE = "CUS-WALK";

export function isWalkInCustomer(code: string, name: string): boolean {
  return code.toUpperCase() === WALK_IN_CUSTOMER_CODE || name.toLowerCase().includes("walk-in");
}

/** Walk-in is for the customer portal only — hide from wholesale party pickers. */
export function excludeWalkInCustomer<T extends { code: string }>(parties: T[]): T[] {
  return parties.filter((p) => p.code !== WALK_IN_CUSTOMER_CODE);
}

export function filterParties<T extends { shop_name: string; code: string; current_due?: number; id: number }>(
  parties: T[],
  filter: PartyFilter
): T[] {
  switch (filter) {
    case "outstanding":
      return parties.filter((p) => Number(p.current_due ?? 0) > 0);
    case "paid":
      return parties.filter((p) => Number(p.current_due ?? 0) <= 0);
    case "recent":
      return [...parties].sort((a, b) => b.id - a.id);
    case "wholesale":
      return parties.filter((p) => !isWalkInCustomer(p.code, p.shop_name));
    default:
      return parties;
  }
}

export function searchParties<
  T extends {
    shop_name: string;
    code: string;
    phone: string;
    owner_name?: string;
    area?: string;
  },
>(parties: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return parties;
  return parties.filter(
    (c) =>
      c.shop_name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.owner_name || "").toLowerCase().includes(q) ||
      (c.area || "").toLowerCase().includes(q)
  );
}
