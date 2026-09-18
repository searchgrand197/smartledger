import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Stack, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import { paymentsApi } from "@/api/services";
import { AppDialog, LoadingState } from "@/components/ui";
import PaymentEditDialog from "@/components/payments/PaymentEditDialog";
import { formatCurrency, formatDate } from "@/utils/format";
import { openPaymentPrintWindow } from "@/utils/print";
import toast from "react-hot-toast";

type PaymentDetail = {
  id: number;
  customer_name: string;
  bill_number?: string | null;
  amount: number | string;
  mode: string;
  reference?: string;
  notes?: string;
  created_at: string;
};

interface Props {
  paymentId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  portal?: boolean;
}

export default function PaymentViewDialog({ paymentId, open, onClose, onUpdated, portal = false }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["payment", paymentId],
    queryFn: () => paymentsApi.get(paymentId!).then((r) => r.data as PaymentDetail),
    enabled: open && !!paymentId,
  });

  const handlePrint = () => {
    if (!paymentId) return;
    const opened = openPaymentPrintWindow(paymentId);
    if (!opened) toast.error("Allow pop-ups to print the receipt");
  };

  const handlePaymentUpdated = () => {
    qc.invalidateQueries({ queryKey: ["payment", paymentId] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["customer-portal-profile"] });
    qc.invalidateQueries({ queryKey: ["customer-portal-customers"] });
    qc.invalidateQueries({ queryKey: ["ledger"] });
    if (onUpdated) onUpdated();
  };

  return (
    <>
      <AppDialog
        open={open}
        onClose={onClose}
        title={data ? `Payment ${data.id}` : "Payment details"}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={onClose}>Close</Button>
            <Button
              variant="outlined"
              color="info"
              startIcon={<EditIcon />}
              disabled={!data}
              onClick={() => setEditOpen(true)}
            >
              Edit Payment
            </Button>
            <Button
              variant="contained"
              className="gradient-button"
              startIcon={<PrintIcon />}
              disabled={!data}
              onClick={handlePrint}
            >
              Print receipt
            </Button>
          </>
        }
      >
        {isLoading ? (
          <LoadingState message="Loading payment…" />
        ) : error || !data ? (
          <Typography color="error">Could not load payment</Typography>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="body2">
              <strong>Customer:</strong> {data.customer_name}
            </Typography>
            <Typography variant="body2">
              <strong>Date:</strong> {formatDate(data.created_at)}
            </Typography>
            <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
              <strong>Mode:</strong> {data.mode}
            </Typography>
            <Typography variant="h6" fontWeight={800} color="success.main">
              Amount: {formatCurrency(data.amount)}
            </Typography>
            {data.bill_number ? (
              <Typography variant="body2">
                <strong>Against bill:</strong> {data.bill_number}
              </Typography>
            ) : null}
            {data.reference ? (
              <Typography variant="body2">
                <strong>Reference:</strong> {data.reference}
              </Typography>
            ) : null}
            {data.notes ? (
              <Typography variant="body2" color="text.secondary">
                {data.notes}
              </Typography>
            ) : null}
          </Stack>
        )}
      </AppDialog>

      <PaymentEditDialog
        paymentId={paymentId}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={handlePaymentUpdated}
        portal={portal}
      />
    </>
  );
}
