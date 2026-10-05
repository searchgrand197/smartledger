import type { BillLine } from "@/types";
import { roundMoney } from "@/utils/money";

type StoredBillItem = {
  quantity: number;
  rate: number;
};

type ProductPackaging = {
  pieces_per_pack?: number;
  allow_length_sale?: boolean;
  length_per_piece_m?: number | string;
};

/** Reverse the save-time pack/length encoding so edit screens match the stored amount. */
export function billItemToEditFields(
  item: StoredBillItem,
  prod: ProductPackaging
): Pick<
  BillLine,
  | "quantity"
  | "rate"
  | "loose_qty"
  | "pieces_per_pack"
  | "allow_length_sale"
  | "length_per_piece_m"
> {
  const allowLength = Boolean(prod.allow_length_sale);
  const lengthM = Number(prod.length_per_piece_m || 0);
  const storedQty = Number(item.quantity) || 0;
  const storedRate = Number(item.rate);
  const ppp = prod.pieces_per_pack && prod.pieces_per_pack > 0 ? prod.pieces_per_pack : 1;

  if (allowLength && lengthM > 0) {
    const pieceLenFt = lengthM * 3.28084;
    const perFoot = pieceLenFt > 0 ? roundMoney(storedRate / pieceLenFt) : storedRate;
    return {
      quantity: storedQty,
      rate: perFoot,
      loose_qty: 0,
      pieces_per_pack: ppp,
      allow_length_sale: true,
      length_per_piece_m: lengthM,
    };
  }

  let qty = storedQty;
  let loose = 0;
  if (ppp > 1) {
    qty = Math.floor(storedQty / ppp);
    loose = storedQty % ppp;
  }
  return {
    quantity: qty,
    rate: storedRate,
    loose_qty: loose,
    pieces_per_pack: ppp,
    allow_length_sale: false,
    length_per_piece_m: lengthM,
  };
}
