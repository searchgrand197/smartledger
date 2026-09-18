import { billingApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import type { InvoicePrintData } from "@/types/invoice";

function absoluteInvoicePrintUrl(billId: number, options?: { portal?: boolean; autoprint?: boolean }) {
  const portal = options?.portal ?? false;
  const autoprint = options?.autoprint === true;
  const base = portal ? `/customer/print/bill/${billId}` : `/print/bill/${billId}`;
  const path = autoprint ? `${base}?autoprint=1` : base;
  return `${window.location.origin}${path}`;
}

/** Load bill print JSON for preview dialog or print page. */
export async function loadInvoicePrintData(
  billId: number,
  options?: { portal?: boolean }
): Promise<InvoicePrintData | null> {
  try {
    const load = options?.portal ? portalApi.billPrintData(billId) : billingApi.printData(billId);
    const { data } = await load;
    return data as InvoicePrintData;
  } catch {
    return null;
  }
}

/** Open print preview in a new tab (Find bill, view dialog, etc.). */
export function openInvoicePrintPreview(
  billId: number,
  options?: { portal?: boolean; autoprint?: boolean }
): boolean {
  const url = absoluteInvoicePrintUrl(billId, options);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch {
    try {
      return window.open(url, "_blank", "noopener,noreferrer") !== null;
    } catch {
      return false;
    }
  }
}

export function prepareInvoicePrintWindow(): Window | null {
  try {
    const win = window.open("about:blank", "_blank");
    if (win) {
      win.document.title = "Preparing bill…";
      win.document.body.innerHTML =
        '<p style="font-family:system-ui,sans-serif;padding:24px;color:#334155">Preparing bill for print…</p>';
    }
    return win;
  } catch {
    return null;
  }
}
