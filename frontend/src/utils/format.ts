export const formatCurrency = (n: number | string | undefined | null) => {
  // Strip commas from backend-formatted strings like "4,200.00" before parsing
  const cleaned = typeof n === "string" ? n.replace(/,/g, "") : n;
  let val = Number(cleaned);
  if (Number.isNaN(val) || cleaned == null) {
    val = 0;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatDate = (d: string) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (d: string) => {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Compact date for printed bills / returns — e.g. 31-05-26 */
export const formatPrintDate = (d: string) => {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};
