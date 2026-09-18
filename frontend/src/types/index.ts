export interface Customer {
  id: number;
  code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  gst?: string;
  address?: string;
  area?: string;
  notes?: string;
  opening_balance: number;
  credit_limit: number;
  current_due?: number;
  is_active?: boolean;
  is_wholesale?: boolean;
}

export type StockMovementType =
  | "opening"
  | "sale"
  | "return"
  | "return_cancel"
  | "cancel"
  | "purchase"
  | "adjustment";

export interface StockMovement {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  product_unit: string;
  quantity_delta: number;
  quantity_after: number;
  movement_type: StockMovementType;
  movement_label: string;
  reference_type: "bill" | "return" | "purchase" | null;
  reference_id: number | null;
  reference_label: string;
  party_name: string;
  notes: string;
  created_by_name: string;
  created_at: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  image?: string | null;
  category?: number;
  category_name?: string;
  brand: string;
  unit: string;
  pieces_per_pack?: number;
  packs_per_box?: number;
  allow_length_sale?: boolean;
  length_per_piece_m?: number;
  purchase_price: number;
  sale_price: number;
  retail_price?: number;
  current_stock: number;
  minimum_stock: number;
  stock_alert_at?: number | null;
  is_low_stock?: boolean;
  profit_margin?: number;
  expiry?: string;
}

export interface BillItem {
  product: number;
  product_name?: string;
  quantity: number;
  rate: number;
  amount?: number;
  profit?: number;
}

export interface BillLine extends BillItem {
  product_name: string;
  product_code: string;
  purchase_rate: number;
  pack?: string;
  pieces_per_pack?: number;
  allow_length_sale?: boolean;
  length_per_piece_m?: number;
  mrp?: number;
  loose_qty?: number;
  disc_percent?: number;
  current_stock?: number;
}

export type BillLineField =
  | "quantity"
  | "rate"
  | "pack"
  | "mrp"
  | "loose_qty"
  | "disc_percent";

export interface BillingContext {
  customer_id: number;
  customer_name: string;
  outstanding_balance: number;
  credit_limit: number;
  credit_available: number;
  last_bills: { bill_number: string; date: string; total: number; due: number }[];
  last_transactions: { type: string; date: string; amount: number }[];
  frequently_ordered: {
    product_id: number;
    product__name: string;
    product__code: string;
    product__sale_price: number;
    total_qty: number;
  }[];
  product_context?: ProductRateContext;
}

export interface ProductRateContext {
  product_id: number;
  product_name: string;
  global_rate: number;
  party_rate: number | null;
  last_sale_rate: number | null;
  suggested_rate: number;
  current_price: number;
  purchase_price: number;
  profit_margin: number;
  current_stock: number;
  last_rates_to_customer: { rate: number; date: string; bill_number: string }[];
  last_quantity?: { quantity: number; date: string };
}

export interface RateHint {
  product_id: number;
  product_name: string;
  product_code: string;
  global_rate: number;
  party_rate: number | null;
  last_sale_rate: number | null;
  suggested_rate: number;
}

export interface PartyProductRateRow {
  id: number;
  product: number;
  product_name: string;
  product_code: string;
  global_rate: number;
  rate: number;
}

export interface DashboardData {
  today_sale: number;
  today_collection: number;
  pending_dues: number;
  customer_count: number;
  supplier_count: number;
  monthly_sales: number;
  low_stock_count: number;
  recent_bills: { bill_number: string; customer: string; total: number; date: string }[];
  recent_payments: { customer: string; amount: number; mode: string; date: string }[];
  charts: {
    monthly_sales: { month: string; total: number }[];
    monthly_collections: { month: string; total: number }[];
    top_products: { name: string; quantity: number; revenue: number }[];
    top_customers: { name: string; total: number; bills: number }[];
  };
}

export interface Bill {
  id: number;
  bill_number: string;
  customer: number;
  customer_name: string;
  total: number;
  paid_amount: number;
  due_amount: number;
  payment_mode: string;
  is_cancelled: boolean;
  total_profit: number;
  bill_type: "party" | "simple";
  created_at: string;
}

