import type { BillLine } from "@/types";
import { lineAmountWithDisc, lineStockQty, roundMoney } from "@/utils/money";

export type BillItemPayload = {
  product: number;
  quantity: number;
  rate: number;
};

/** Build API bill line — qty is stock pieces; rate bakes in pack/length/line discount. */
export function toBillPayloadItem(l: BillLine): BillItemPayload {
  const quantity = lineStockQty(l);
  const amount = lineAmountWithDisc(l);
  return { product: l.product, quantity, rate: roundMoney(amount / quantity) };
}

export function formatApiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data !== "object" || data === null) return fallback;

  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;

  const parts: string[] = [];
  const walk = (obj: Record<string, unknown>, prefix = "") => {
    for (const [key, val] of Object.entries(obj)) {
      const label = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(val) && val.length > 0) {
        parts.push(`${label}: ${String(val[0])}`);
      } else if (val && typeof val === "object" && !Array.isArray(val)) {
        walk(val as Record<string, unknown>, label);
      }
    }
  };
  walk(record);
  return parts[0] || fallback;
}
