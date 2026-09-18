import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import EditIcon from "@mui/icons-material/Edit";
import { useNavigate } from "react-router-dom";
import BillCancelAction from "@/components/billing/BillCancelAction";
import { billingApi, returnsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { AppDialog, LoadingState } from "@/components/ui";
import PaymentViewDialog from "@/components/payments/PaymentViewDialog";
import { portalReturnUrl, wholesaleReturnUrl } from "@/utils/returnNavigation";
import type { InvoicePrintData } from "@/types/invoice";
import { formatCurrency, formatDate } from "@/utils/format";
import { openInvoicePrintWindow, openPaymentPrintWindow } from "@/utils/print";
import toast from "react-hot-toast";

type BillPayment = {
  id: number;
  amount: number | string;
  mode: string;
  created_at: string;
};

type BillDetail = {
  id: number;
  bill_number: string;
  customer?: number;
  customer_name?: string;
  created_at: string;
  payment_mode: string;
  subtotal: number | string;
  discount_amount?: number | string;
  round_off?: number | string;
  total: number | string;
  paid_amount?: number | string;
  due_amount?: number | string;
  is_cancelled?: boolean;
  notes?: string;
  payments?: BillPayment[];
  items?: {
    id?: number;
    product_name?: string;
    quantity: number;
    rate: number | string;
    amount?: number | string;
  }[];
};

type EligibilityItem = {
  bill_item_id: number;
  product_name: string;
  sold_quantity: number;
  returned_quantity: number;
  returnable_quantity: number;
};

function num(v: number | string | undefined): number {
  // Strip commas from backend-formatted strings like "4,200.00"
  const cleaned = typeof v === "string" ? v.replace(/,/g, "") : v;
  return Number(cleaned || 0);
}

function paymentModeLabel(mode: string): string {
  const m = (mode || "").toLowerCase();
  if (m === "upi") return "UPI";
  if (m === "cash") return "Cash";
  return mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : "—";
}

function billDetailFromPrint(id: number, print: InvoicePrintData): BillDetail {
  return {
    id,
    bill_number: print.bill_number,
    customer_name: print.customer.name,
    created_at: print.date,
    payment_mode: print.payment_mode,
    subtotal: print.summary.subtotal,
    discount_amount: print.summary.discount ?? 0,
    round_off: print.summary.round_off ?? 0,
    total: print.summary.grand_total,
    paid_amount: print.summary.paid,
    notes: print.remark,
    is_cancelled: print.is_cancelled,
    items: print.items.map((item) => ({
      product_name: item.name,
      quantity: Number(item.qty) || 0,
      rate: item.rate,
      amount: item.amount,
    })),
  };
}

interface Props {
  billId: number | null;
  open: boolean;
  onClose: () => void;
  portal?: boolean;
}

export default function BillViewDialog({ billId, open, onClose, portal = false }: Props) {
  const navigate = useNavigate();
  const [viewPaymentId, setViewPaymentId] = useState<number | null>(null);
  const qc = useQueryClient();

  const handleEditBill = () => {
    onClose();
    if (portal) {
      navigate(`/customer?edit=${billId}`);
    } else {
      navigate(`/wholesale/sale?edit=${billId}`);
    }
  };

  const refreshAfterCancel = async () => {
    await qc.invalidateQueries({ queryKey: ["bill", billId] });
    await qc.invalidateQueries({ queryKey: ["bill-finder"] });
    await qc.invalidateQueries({ queryKey: ["customer-portal-products"] });
    await qc.invalidateQueries({ queryKey: ["products"] });
    onClose();
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["bill", billId, portal ? "portal" : "wholesale"],
    queryFn: async () => {
      if (portal) {
        const r = await portalApi.billPrintData(billId!);
        return billDetailFromPrint(billId!, r.data as InvoicePrintData);
      }
      const r = await billingApi.get(billId!);
      return r.data as BillDetail;
    },
    enabled: open && !!billId,
  });

  const { data: eligibility } = useQuery({
    queryKey: ["bill-return-eligibility", billId, portal ? "portal" : "wholesale"],
    queryFn: () => {
      if (portal) {
        return portalApi.billReturnEligibility(billId!).then((r) => r.data as { items: EligibilityItem[]; is_cancelled?: boolean });
      }
      return returnsApi.eligibility(billId!).then((r) => r.data as { items: EligibilityItem[]; is_cancelled?: boolean });
    },
    enabled: open && !!billId,
  });

  const total = num(data?.total);
  const paid = num(data?.paid_amount);
  const due = data?.due_amount != null ? num(data.due_amount) : Math.max(0, total - paid);
  const isFullyPaid = total > 0 && due <= 0.01;
  const hasReturnable = (eligibility?.items || []).some((i) => i.returnable_quantity > 0);
  const allFullyReturned =
    (eligibility?.items || []).length > 0 &&
    (eligibility?.items || []).every((i) => i.returnable_quantity <= 0);
  const returnByItemId = new Map(
    (eligibility?.items || []).map((i) => [i.bill_item_id, i])
  );
  const returnByProductName = new Map(
    (eligibility?.items || []).map((i) => [i.product_name.toLowerCase(), i])
  );
  const showCreateReturn = !!data && !data.is_cancelled && !eligibility?.is_cancelled && hasReturnable;
  const payments = portal ? [] : data?.payments || [];
  const primaryPayment = payments[0];

  const handlePrintBill = () => {
    if (!billId) return;
    const opened = openInvoicePrintWindow(billId, portal ? { portal: true } : undefined);
    if (!opened) toast.error("Allow pop-ups to print the bill");
  };

  const handlePrintReceipt = (paymentId: number) => {
    const opened = openPaymentPrintWindow(paymentId);
    if (!opened) toast.error("Allow pop-ups to print the receipt");
  };

  const handleCreateReturn = () => {
    if (!billId) return;
    onClose();
    if (portal) {
      navigate(portalReturnUrl(billId, data?.customer_name));
      return;
    }
    navigate(wholesaleReturnUrl(billId, data?.customer));
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={data ? `Bill ${data.bill_number}` : "Bill details"}
      maxWidth="md"
      actions={
        <>
          <Button onClick={onClose}>Close</Button>
          {primaryPayment ? (
            <>
              <Button
                variant="outlined"
                startIcon={<VisibilityIcon />}
                onClick={() => setViewPaymentId(primaryPayment.id)}
              >
                View receipt
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => handlePrintReceipt(primaryPayment.id)}
              >
                Print receipt
              </Button>
            </>
          ) : null}
          {showCreateReturn ? (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<AssignmentReturnIcon />}
              onClick={handleCreateReturn}
            >
              Create Return
            </Button>
          ) : null}
          {data && !data.is_cancelled && billId ? (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<EditIcon />}
              onClick={handleEditBill}
            >
              Edit Bill
            </Button>
          ) : null}
          {data && !data.is_cancelled && billId ? (
            <BillCancelAction
              billId={billId}
              billNumber={data.bill_number}
              portal={portal}
              iconOnly={false}
              onCancelled={() => void refreshAfterCancel()}
            />
          ) : null}
          <Button
            variant="contained"
            className="gradient-button"
            startIcon={<PrintIcon />}
            disabled={!data}
            onClick={handlePrintBill}
          >
            Print bill
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading bill…" />
      ) : error || !data ? (
        <Typography color="error">Could not load bill</Typography>
      ) : (
        <Stack spacing={2}>
          {data.is_cancelled ? (
            <Chip
              size="small"
              color="error"
              label="Cancelled"
              sx={{ alignSelf: "flex-start", fontWeight: 600 }}
            />
          ) : isFullyPaid ? (
            <Chip
              size="small"
              color="success"
              label={`Payment received in full · ${paymentModeLabel(data.payment_mode)} · ${formatCurrency(paid)}`}
              sx={{ alignSelf: "flex-start", fontWeight: 600 }}
            />
          ) : due > 0 ? (
            <Chip
              size="small"
              color="warning"
              label={`Due ${formatCurrency(due)} · Paid ${formatCurrency(paid)}`}
              sx={{ alignSelf: "flex-start", fontWeight: 600 }}
            />
          ) : null}
          {allFullyReturned && !data.is_cancelled ? (
            <Chip
              size="small"
              color="default"
              label="All items on this bill have been returned"
              sx={{ alignSelf: "flex-start", fontWeight: 600 }}
            />
          ) : null}

          <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={1}>
            <Typography variant="body2">
              <strong>Customer:</strong> {data.customer_name || "—"}
            </Typography>
            <Typography variant="body2">
              <strong>Date:</strong> {portal ? data.created_at : formatDate(data.created_at)}
            </Typography>
            <Typography variant="body2">
              <strong>Payment:</strong> {paymentModeLabel(data.payment_mode)}
            </Typography>
            <Typography variant="body2">
              <strong>Paid:</strong> {formatCurrency(data.paid_amount)}
            </Typography>
          </Box>

          {payments.length > 1 ? (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                Payment receipts
              </Typography>
              {payments.map((p) => (
                <Stack key={p.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2">
                    {formatCurrency(p.amount)} · {paymentModeLabel(p.mode)} · {formatDate(p.created_at)}
                  </Typography>
                  <Button size="small" onClick={() => setViewPaymentId(p.id)}>
                    View
                  </Button>
                  <Button size="small" onClick={() => handlePrintReceipt(p.id)}>
                    Print
                  </Button>
                </Stack>
              ))}
            </Stack>
          ) : null}

          {data.notes ? (
            <Typography variant="body2" color="text.secondary">
              {data.notes}
            </Typography>
          ) : null}
          <TableContainer className="app-table" sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Sold</TableCell>
                  <TableCell align="right">Returned</TableCell>
                  <TableCell align="right">Net Qty</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.items || []).map((item, i) => {
                  const ret =
                    (item.id != null ? returnByItemId.get(item.id) : undefined) ||
                    (item.product_name
                      ? returnByProductName.get(item.product_name.toLowerCase())
                      : undefined);
                  const returned = ret?.returned_quantity ?? 0;
                  const netQty = Math.max(0, item.quantity - returned);
                  const fullyReturned = netQty <= 0 && returned > 0;
                  return (
                  <TableRow
                    key={i}
                    sx={fullyReturned ? { opacity: 0.55, bgcolor: "action.hover" } : undefined}
                  >
                    <TableCell>
                      {item.product_name}
                      {fullyReturned ? (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          (fully returned)
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">{returned > 0 ? returned : "—"}</TableCell>
                    <TableCell align="right">{netQty}</TableCell>
                    <TableCell align="right">{formatCurrency(item.rate)}</TableCell>
                    <TableCell align="right">{formatCurrency(item.amount ?? Number(item.rate) * item.quantity)}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack alignItems="flex-end" spacing={0.5}>
            <Typography variant="body2">Subtotal: {formatCurrency(data.subtotal)}</Typography>
            {Number(data.discount_amount) > 0 && (
              <Typography variant="body2" color="error.main">
                Discount: −{formatCurrency(data.discount_amount)}
              </Typography>
            )}
            {Number(data.round_off) !== 0 && (
              <Typography variant="body2">Round off: {formatCurrency(data.round_off)}</Typography>
            )}
            <Typography variant="h6" fontWeight={800}>
              Total: {formatCurrency(data.total)}
            </Typography>
          </Stack>
        </Stack>
      )}
      <PaymentViewDialog
        paymentId={viewPaymentId}
        open={viewPaymentId != null}
        onClose={() => setViewPaymentId(null)}
      />
    </AppDialog>
  );
}
