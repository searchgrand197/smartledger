export interface PaymentPrintData {
  business_name: string;
  business_address: string;
  business_phone: string;
  receipt_number: string;
  payment_date: string;
  customer_name: string;
  customer_code: string;
  amount: number | string;
  mode: string;
  mode_label: string;
  reference: string;
  notes: string;
  bill_number: string;
  footer: string;
}
