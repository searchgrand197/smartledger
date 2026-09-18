export function portalReturnUrl(billId?: number | null, customerName?: string) {
  const params = new URLSearchParams();
  if (billId) params.set("bill", String(billId));
  if (customerName?.trim()) params.set("customer", customerName.trim());
  const q = params.toString();
  return q ? `/customer/return?${q}` : "/customer/return";
}

export function wholesaleReturnUrl(billId?: number | null, customerId?: number | null) {
  const params = new URLSearchParams();
  if (billId) params.set("bill", String(billId));
  if (customerId) params.set("customer", String(customerId));
  const q = params.toString();
  return q ? `/wholesale/return?${q}` : "/wholesale/return";
}
