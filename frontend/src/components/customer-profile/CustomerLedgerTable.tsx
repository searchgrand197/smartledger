import { useMemo, useState } from "react";
import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import SearchIcon from "@mui/icons-material/Search";
import toast from "react-hot-toast";
import { billingApi } from "@/api/services";
import BillCancelAction from "@/components/billing/BillCancelAction";
import BillViewDialog from "@/components/billing/BillViewDialog";
import PaymentViewDialog from "@/components/payments/PaymentViewDialog";
import ReturnViewDialog from "@/components/returns/ReturnViewDialog";
import ReturnWhatsAppAction from "@/components/returns/ReturnWhatsAppAction";
import { formatCurrency, formatDate } from "@/utils/format";
import { openPaymentPrintWindow, openReturnPrintWindow } from "@/utils/print";
import { loadPdfIntoWindow, openPdfPrintWindow } from "@/utils/pdf";
import type { LedgerEntry } from "@/components/ledger/LedgerStatement";

const PAGE_SIZE = 25;

interface Props {
  entries: LedgerEntry[];
  onRefresh?: () => void;
}

function num(v: number | string | undefined): number {
  return Number(v || 0);
}

function entryTypeLabel(row: LedgerEntry): string {
  if (row.is_opening) return "Opening";
  const t = row.entry_type || "";
  if (t === "sale") return "Sale";
  if (t === "payment") return "Payment";
  if (t === "return") return "Return";
  if (t === "refund") return "Refund";
  return t || "—";
}

function paymentModeFromRow(row: LedgerEntry): string {
  if (row.is_opening) return "—";
  const desc = row.description || "";
  const m = desc.match(/\(([^)]+)\)/);
  if (row.entry_type === "payment" && m) return m[1];
  if (row.entry_type === "sale") {
    return row.payment_mode ? row.payment_mode.charAt(0).toUpperCase() + row.payment_mode.slice(1) : "Credit";
  }
  if (row.entry_type === "return") return "Return";
  return "—";
}

function typeBadgeClass(row: LedgerEntry): string {
  const t = row.entry_type || "";
  if (t === "sale") return "ledger-type-badge ledger-type-badge--sale";
  if (t === "payment") return "ledger-type-badge ledger-type-badge--payment";
  if (t === "return" || t === "refund") return "ledger-type-badge ledger-type-badge--return";
  return "ledger-type-badge";
}

function moneyCell(value: number | string, emphasize = false) {
  const n = num(value);
  if (!n) return <span className="ledger-muted">—</span>;
  return <span className={emphasize ? "ledger-balance" : undefined}>{formatCurrency(n)}</span>;
}

export default function CustomerLedgerTable({ entries, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [viewBillId, setViewBillId] = useState<number | null>(null);
  const [viewPaymentId, setViewPaymentId] = useState<number | null>(null);
  const [viewReturnId, setViewReturnId] = useState<number | null>(null);
  const [printingBillId, setPrintingBillId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((row) => {
      if (dateFrom && row.date && row.date < dateFrom) return false;
      if (dateTo && row.date && row.date > dateTo) return false;
      if (!q) return true;
      return (
        (row.description || "").toLowerCase().includes(q) ||
        (row.bill_number || "").toLowerCase().includes(q) ||
        (row.return_number || "").toLowerCase().includes(q)
      );
    });
  }, [entries, search, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handlePrintBill = async (billId: number, billNumber?: string) => {
    setPrintingBillId(billId);
    const printWin = openPdfPrintWindow();
    try {
      const res = await billingApi.pdf(billId);
      const result = await loadPdfIntoWindow(printWin, res, `${billNumber || "bill"}.pdf`);
      if (result === "downloaded") toast.success("PDF downloaded — open to print.");
    } catch (e) {
      if (printWin && !printWin.closed) printWin.close();
      toast.error(e instanceof Error ? e.message : "Print failed");
    } finally {
      setPrintingBillId(null);
    }
  };

  const renderActions = (row: LedgerEntry) => {
    if (row.is_opening) return <span className="ledger-muted">—</span>;
    const type = row.entry_type || "";
    const viewBtn = (label: string, onClick: () => void) => (
      <Tooltip title={label}>
        <IconButton size="small" aria-label={label} onClick={onClick} sx={{ width: 28, height: 28 }}>
          <VisibilityIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    );
    const printBtn = (label: string, onClick: () => void, loading?: boolean) => (
      <Tooltip title={label}>
        <IconButton size="small" aria-label={label} disabled={loading} onClick={onClick} sx={{ width: 28, height: 28 }}>
          <PrintIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    );

    if ((type === "return" || type === "refund") && row.return_id) {
      return (
        <Stack direction="row" spacing={0.25} justifyContent="center" flexWrap="nowrap">
          {viewBtn("View return", () => setViewReturnId(row.return_id!))}
          {printBtn("Print return", () => {
            const opened = openReturnPrintWindow(row.return_id!);
            if (!opened) toast.error("Allow pop-ups to print");
          })}
          <ReturnWhatsAppAction returnId={row.return_id!} />
        </Stack>
      );
    }
    if (type === "payment" && row.payment_id) {
      return (
        <Stack direction="row" spacing={0.25} justifyContent="center">
          {viewBtn("View receipt", () => setViewPaymentId(row.payment_id!))}
          {printBtn("Print receipt", () => {
            const opened = openPaymentPrintWindow(row.payment_id!);
            if (!opened) toast.error("Allow pop-ups to print");
          })}
          {row.bill_id && (
            <BillCancelAction
              billId={row.bill_id}
              billNumber={row.bill_number}
              onCancelled={onRefresh}
            />
          )}
        </Stack>
      );
    }
    if (row.bill_id) {
      return (
        <Stack direction="row" spacing={0.25} justifyContent="center">
          {viewBtn("View bill", () => setViewBillId(row.bill_id!))}
          {printBtn(
            "Print bill",
            () => void handlePrintBill(row.bill_id!, row.bill_number),
            printingBillId === row.bill_id
          )}
          <BillCancelAction billId={row.bill_id} billNumber={row.bill_number} onCancelled={onRefresh} />
        </Stack>
      );
    }
    return <span className="ledger-muted">—</span>;
  };

  return (
    <Box>
      <Box className="cp-ledger-toolbar">
        <TextField
          size="small"
          placeholder="Search bill, description…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 18, color: "text.secondary", mr: 0.5 }} />,
          }}
          sx={{ flex: 1, minWidth: 160 }}
        />
        <TextField
          size="small"
          type="date"
          label="From"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(0);
          }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="To"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(0);
          }}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      <Box className="cp-ledger-table-wrap ledger-statement">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bill No.</th>
              <th>Type</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th className="num">Balance</th>
              <th>Payment Mode</th>
              <th className="ledger-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="cp-empty">
                  No ledger entries match your filters
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={`${row.seq ?? i}-${row.date}-${row.description}`} className={row.is_opening ? "ledger-row-opening" : ""}>
                  <td>{row.date ? formatDate(row.date) : "—"}</td>
                  <td>{row.bill_number || row.return_number || "—"}</td>
                  <td>
                    <span className={typeBadgeClass(row)}>{entryTypeLabel(row)}</span>
                  </td>
                  <td className="num">{moneyCell(row.debit)}</td>
                  <td className="num">{moneyCell(row.credit)}</td>
                  <td className="num">{moneyCell(row.balance, true)}</td>
                  <td>{paymentModeFromRow(row)}</td>
                  <td className="ledger-actions-col">{renderActions(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Box>

      {filtered.length > PAGE_SIZE && (
        <Box className="cp-ledger-pagination">
          <Typography variant="caption" fontWeight={700}>
            {filtered.length} entries · Page {safePage + 1} of {pageCount}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </Stack>
        </Box>
      )}

      <BillViewDialog billId={viewBillId} open={viewBillId != null} onClose={() => setViewBillId(null)} />
      <PaymentViewDialog paymentId={viewPaymentId} open={viewPaymentId != null} onClose={() => setViewPaymentId(null)} />
      <ReturnViewDialog returnId={viewReturnId} open={viewReturnId != null} onClose={() => setViewReturnId(null)} />
    </Box>
  );
}
