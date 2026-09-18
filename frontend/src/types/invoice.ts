export interface InvoicePrintItem {
  sn: number;
  name: string;
  pack: string;
  hsn: string;
  batch: string;
  exp: string;
  mrp: string;
  disc_percent: string;
  rate: string;
  qty: string;
  amount: string;
}

export interface InvoicePrintData {
  id?: number;
  is_cancelled?: boolean;
  bill_number: string;
  date: string;
  payment_mode: string;
  amount_in_words: string;
  remark: string;
  shop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gst: string;
    bank_details: string;
  };
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  items: InvoicePrintItem[];
  summary: {
    total_qty: number;
    subtotal: string;
    discount: string | null;
    discount_percent: string | null;
    round_off: string | null;
    grand_total: string;
    paid: string;
    due: string;
    previous_balance: string | null;
    closing_balance: string | null;
    show_party_balances: boolean;
  };
  terms: string[];
}
