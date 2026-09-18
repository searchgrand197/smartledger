export interface ReturnPrintData {
  business_name: string;
  business_address: string;
  business_phone: string;
  business_gst: string;
  return_number: string;
  return_date: string;
  original_invoice_number: string;
  customer_name: string;
  customer_code: string;
  return_type: string;
  return_type_label: string;
  refund_mode: string;
  refund_mode_label: string;
  refund_detail: string;
  subtotal: number | string;
  total: number | string;
  refund_paid: number | string;
  exchange_bill_number: string;
  exchange_new_value: number | string;
  exchange_net_amount: number | string;
  notes: string;
  created_by: string;
  footer: string;
  is_cancelled: boolean;
  multi_bill?: boolean;
  items: {
    product_name: string;
    product_code: string;
    quantity: number;
    rate: number | string;
    amount: number | string;
    reason: string;
    source_bill_number?: string;
  }[];
}
