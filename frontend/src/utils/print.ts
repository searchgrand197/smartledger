/**
 * Legacy print helpers — prefer printInvoiceReliable() from @/utils/invoicePrint for save-and-print.
 */
export {
  openInvoicePrintPreview as openInvoicePrintWindow,
  prepareInvoicePrintWindow,
} from "@/utils/invoicePrint";

export function openReturnPrintWindow(returnId: number, options?: { autoprint?: boolean; portal?: boolean }): Window | null {
  const autoprint = options?.autoprint === true;
  const base = options?.portal ? `/customer/print/return/${returnId}` : `/print/return/${returnId}`;
  const url = autoprint ? `${window.location.origin}${base}?autoprint=1` : `${window.location.origin}${base}`;
  try {
    return window.open(url, "_blank");
  } catch {
    return null;
  }
}

export function openPaymentPrintWindow(paymentId: number, options?: { autoprint?: boolean }): Window | null {
  const autoprint = options?.autoprint === true;
  const base = `/print/payment/${paymentId}`;
  const url = autoprint ? `${window.location.origin}${base}?autoprint=1` : `${window.location.origin}${base}`;
  try {
    return window.open(url, "_blank");
  } catch {
    return null;
  }
}
