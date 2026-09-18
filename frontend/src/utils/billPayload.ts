import type { BillLine } from "@/types";
import { roundMoney } from "@/utils/money";

export type BillItemPayload = {
  product: number;
  quantity: number;
  rate: number;
};

/** Build API bill line — rates/qty normalized so backend validation never fails. */
export function toBillPayloadItem(l: BillLine): BillItemPayload {
  if (l.allow_length_sale && Number(l.length_per_piece_m || 0) > 0) {
    const pieceLenFt = Number(l.length_per_piece_m) * 3.28084;
    const totalFt = l.quantity * pieceLenFt + (l.loose_qty || 0);
    const stockQty = Math.max(1, Math.ceil(totalFt / pieceLenFt));
    const amount = roundMoney(totalFt * l.rate);
    const payloadRate = roundMoney(amount / stockQty);
    return { product: l.product, quantity: stockQty, rate: payloadRate };
  }
  return {
    product: l.product,
    quantity: Math.max(1, Math.round(l.quantity * (l.pieces_per_pack || 1) + (l.loose_qty || 0))),
    rate: roundMoney(l.rate),
  };
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
