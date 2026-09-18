import { useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import toast from "react-hot-toast";
import { billingApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import BillCancelAction from "@/components/billing/BillCancelAction";
import BillViewDialog from "@/components/billing/BillViewDialog";
import PaymentViewDialog from "@/components/payments/PaymentViewDialog";
import PaymentEditDialog from "@/components/payments/PaymentEditDialog";
import ReturnViewDialog from "@/components/returns/ReturnViewDialog";
import ReturnWhatsAppAction from "@/components/returns/ReturnWhatsAppAction";
import { formatCurrency, formatDate } from "@/utils/format";
import { openPaymentPrintWindow, openReturnPrintWindow } from "@/utils/print";
import { loadPdfIntoWindow, openPdfPrintWindow } from "@/utils/pdf";

export interface LedgerEntry {
  seq?: number;
  date: string;
  description: string;
  bill_number?: string;
  bill_id?: number | null;
  payment_id?: number | null;
  return_id?: number | null;
  return_number?: string;
  entry_type?: string;
  payment_mode?: string;
  debit: number | string;
  credit: number | string;
  balance: number | string;
  is_opening?: boolean;
}

export interface LedgerSummary {
  opening_balance: number | string;
  total_debit: number | string;
  total_credit: number | string;
  closing_balance: number | string;
}

interface PartyInfo {
  name: string;
  code?: string;
  owner?: string;
  phone?: string;
  address?: string;
}

interface Props {
  party: PartyInfo;
  summary: LedgerSummary;
  entries: LedgerEntry[];
  compact?: boolean;
  showBillActions?: boolean;
  onRefresh?: () => void;
  portal?: boolean;
}

function num(v: number | string | undefined): number {
  return Number(v || 0);
}

function moneyCell(value: number | string, emphasize = false) {
  const n = num(value);
  if (!n) return <span className="ledger-muted">—</span>;
  return (
    <span className={emphasize ? "ledger-balance" : undefined}>
      {formatCurrency(n)}
    </span>
  );
}

export default function LedgerStatement({
  party,
  summary,
  entries,
  compact,
  showBillActions = true,
  onRefresh,
  portal = false,
}: Props) {
  const [viewBillId, setViewBillId] = useState<number | null>(null);
  const [viewPaymentId, setViewPaymentId] = useState<number | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);
  const [viewReturnId, setViewReturnId] = useState<number | null>(null);
  const [printingBillId, setPrintingBillId] = useState<number | null>(null);

  const colCount = (compact ? 6 : 7) + (showBillActions ? 1 : 0);

  const handlePrintBill = async (billId: number, billNumber?: string) => {
    setPrintingBillId(billId);
    const printWin = openPdfPrintWindow();
    try {
      const res = portal ? await portalApi.billPdf(billId) : await billingApi.pdf(billId);
      const result = await loadPdfIntoWindow(printWin, res, `${billNumber || "bill"}.pdf`);
      if (result === "downloaded") {
        toast.success("PDF downloaded — open the file to print.");
      }
    } catch (e) {
      if (printWin && !printWin.closed) printWin.close();
      toast.error(e instanceof Error ? e.message : "Print failed");
    } finally {
      setPrintingBillId(null);
    }
  };

  const renderActions = (row: LedgerEntry) => {
    if (row.is_opening) {
      return <span className="ledger-muted">—</span>;
    }

    const type = row.entry_type || "";
    const viewBtn = (label: string, onClick: () => void) => (
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          onClick={onClick}
          sx={{
            color: "var(--color-primary-dark)",
            bgcolor: "var(--color-chip-bg)",
            border: "1px solid var(--color-border)",
          }}
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
    const editBtn = (label: string, onClick: () => void) => (
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          onClick={onClick}
          sx={{
            color: "var(--color-info-dark, #0284c7)",
            bgcolor: "#e0f2fe",
            border: "1px solid #7dd3fc",
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
    const printBtn = (label: string, onClick: () => void, loading?: boolean) => (
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          disabled={loading}
          onClick={onClick}
          sx={{
            color: "#14532d",
            bgcolor: "#bbf7d0",
            border: "1px solid #86efac",
          }}
        >
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );

    if ((type === "return" || type === "refund") && row.return_id) {
      return (
        <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="nowrap">
          {viewBtn("View return", () => setViewReturnId(row.return_id!))}
          {printBtn("Print return", () => {
            const opened = openReturnPrintWindow(row.return_id!);
            if (!opened) toast.error("Allow pop-ups to print");
          })}
          <ReturnWhatsAppAction returnId={row.return_id!} portal={portal} />
        </Stack>
      );
    }

    if (type === "payment" && row.payment_id) {
      return (
        <Stack direction="row" spacing={0.5} justifyContent="center">
          {viewBtn("View receipt", () => setViewPaymentId(row.payment_id!))}
          {editBtn("Edit payment", () => setEditPaymentId(row.payment_id!))}
          {printBtn("Print receipt", () => {
            const opened = openPaymentPrintWindow(row.payment_id!);
            if (!opened) toast.error("Allow pop-ups to print");
          })}
          {row.bill_id && (
            <BillCancelAction
              billId={row.bill_id}
              billNumber={row.bill_number}
              portal={portal}
              onCancelled={onRefresh}
            />
          )}
        </Stack>
      );
    }

    if (type === "sale" && row.bill_id) {
      return (
        <Stack direction="row" spacing={0.5} justifyContent="center">
          {viewBtn("View bill", () => setViewBillId(row.bill_id!))}
          {printBtn("Print bill", () => void handlePrintBill(row.bill_id!, row.bill_number), printingBillId === row.bill_id)}
          <BillCancelAction billId={row.bill_id} billNumber={row.bill_number} portal={portal} onCancelled={onRefresh} />
        </Stack>
      );
    }

    if (row.bill_id) {
      return (
        <Stack direction="row" spacing={0.5} justifyContent="center">
          {viewBtn("View bill", () => setViewBillId(row.bill_id!))}
          {printBtn("Print bill", () => void handlePrintBill(row.bill_id!, row.bill_number), printingBillId === row.bill_id)}
          <BillCancelAction billId={row.bill_id} billNumber={row.bill_number} portal={portal} onCancelled={onRefresh} />
        </Stack>
      );
    }

    return <span className="ledger-muted">—</span>;
  };

  return (
    <Box className="ledger-statement">
      <Box className="ledger-statement-header">
        <Box>
          <Typography className="ledger-title">Bill Ledger</Typography>
          <Typography className="ledger-party-name">{party.name}</Typography>
          <Box className="ledger-party-meta">
            {party.code && <span>Account: {party.code}</span>}
            {party.owner && <span>{party.owner}</span>}
            {party.phone && <span>{party.phone}</span>}
            {party.address && <span>{party.address}</span>}
          </Box>
        </Box>
        <Box className="ledger-summary-grid">
          <Box className="ledger-summary-box">
            <Typography className="ledger-summary-label">Opening Balance</Typography>
            <Typography className="ledger-summary-value ledger-debit">
              {formatCurrency(summary.opening_balance)}
            </Typography>
          </Box>
          <Box className="ledger-summary-box">
            <Typography className="ledger-summary-label">Total Debit</Typography>
            <Typography className="ledger-summary-value ledger-debit">
              {formatCurrency(summary.total_debit)}
            </Typography>
          </Box>
          <Box className="ledger-summary-box">
            <Typography className="ledger-summary-label">Total Credit</Typography>
            <Typography className="ledger-summary-value ledger-credit">
              {formatCurrency(summary.total_credit)}
            </Typography>
          </Box>
          <Box className="ledger-summary-box ledger-summary-closing">
            <Typography className="ledger-summary-label">Closing Balance</Typography>
            <Typography className="ledger-summary-value">
              {formatCurrency(summary.closing_balance)}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Typography variant="caption" className="ledger-formula-hint">
        Balance = previous balance + debit − credit (calculated on server — not editable)
      </Typography>

      <Box className="ledger-table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Description</th>
              {!compact && <th>Bill No</th>}
              <th className="num">Debit</th>
              <th className="num">Credit</th>
              <th className="num">Balance</th>
              {showBillActions && <th className="ledger-actions-col">Action</th>}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="ledger-empty">
                  No transactions yet
                </td>
              </tr>
            ) : (
              entries.map((row, i) => (
                <tr
                  key={`${row.seq ?? i}-${row.date}-${row.description}`}
                  className={row.is_opening ? "ledger-row-opening" : ""}
                >
                  <td>{row.seq ?? i + 1}</td>
                  <td>{row.date ? formatDate(row.date) : "—"}</td>
                  <td>{row.description}</td>
                  {!compact && <td>{row.bill_number || row.return_number || "—"}</td>}
                  <td className="num">{moneyCell(row.debit)}</td>
                  <td className="num">{moneyCell(row.credit)}</td>
                  <td className="num">{moneyCell(row.balance, true)}</td>
                  {showBillActions && <td className="ledger-actions-col">{renderActions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Box>

      <BillViewDialog billId={viewBillId} open={viewBillId != null} onClose={() => setViewBillId(null)} portal={portal} />
      <PaymentViewDialog
        paymentId={viewPaymentId}
        open={viewPaymentId != null}
        onClose={() => setViewPaymentId(null)}
        onUpdated={onRefresh}
        portal={portal}
      />
      <PaymentEditDialog
        paymentId={editPaymentId}
        open={editPaymentId != null}
        onClose={() => setEditPaymentId(null)}
        onUpdated={onRefresh}
        portal={portal}
      />
      <ReturnViewDialog returnId={viewReturnId} open={viewReturnId != null} onClose={() => setViewReturnId(null)} portal={portal} />
    </Box>
  );
}
