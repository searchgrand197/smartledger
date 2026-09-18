/** Paise-safe money helpers — always round to 2 decimal places. */

export function roundMoney(n: number): number {
  let v = Number(n);
  if (Number.isNaN(v)) {
    v = 0;
  }
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function lineAmount(qty: number, rate: number): number {
  return roundMoney((Number(qty) || 0) * (Number(rate) || 0));
}

export function lineAmountWithDisc(line: {
  quantity: number;
  rate: number;
  pieces_per_pack?: number;
  allow_length_sale?: boolean;
  length_per_piece_m?: number;
  loose_qty?: number;
  disc_percent?: number;
}): number {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;
  const loose = Number(line.loose_qty) || 0;
  const pieceLenFt = Number(line.length_per_piece_m || 0) * 3.28084;
  const ppp = line.pieces_per_pack && line.pieces_per_pack > 0 ? line.pieces_per_pack : 1;
  const effectiveQty =
    line.allow_length_sale && pieceLenFt > 0 ? qty * pieceLenFt + loose : qty * ppp + loose;
  const base = effectiveQty * rate;
  const pct = Number(line.disc_percent) || 0;
  if (pct > 0) return roundMoney(base * (1 - pct / 100));
  return roundMoney(base);
}

export function sumLineAmounts(
  lines: { quantity: number; rate: number; disc_percent?: number }[]
): number {
  return roundMoney(lines.reduce((s, l) => s + lineAmountWithDisc(l), 0));
}

/** Match backend Bill.recalculate: percent wins when > 0, else flat discount. */
export function afterDiscount(
  subtotal: number,
  discountAmount: number,
  discountPercent = 0
): number {
  if (discountPercent > 0) {
    return roundMoney(subtotal * (1 - discountPercent / 100));
  }
  return roundMoney(Math.max(0, subtotal - discountAmount));
}

export function billTotal(
  subtotal: number,
  discountAmount: number,
  discountPercent: number,
  roundOff: number
): number {
  return roundMoney(afterDiscount(subtotal, discountAmount, discountPercent) + roundOff);
}

export function discountFromPercent(subtotal: number, percent: number): number {
  return roundMoney(subtotal * (percent / 100));
}

export function percentFromDiscount(subtotal: number, discount: number): number {
  if (subtotal <= 0) return 0;
  return roundMoney((discount / subtotal) * 100);
}

export function billDue(total: number, paid: number): number {
  return roundMoney(Math.max(0, total - paid));
}
