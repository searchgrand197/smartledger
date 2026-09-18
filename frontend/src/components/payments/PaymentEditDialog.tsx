import { useState, useEffect } from "react";
import {
  Button,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Box,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import toast from "react-hot-toast";
import { paymentsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { AppDialog, LoadingState } from "@/components/ui";

interface Props {
  paymentId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  portal?: boolean;
}

export default function PaymentEditDialog({
  paymentId,
  open,
  onClose,
  onUpdated,
  portal = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [amount, setAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [mode, setMode] = useState<string>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    if (open && paymentId) {
      setLoading(true);
      const load = async () => {
        try {
          const res = await paymentsApi.get(paymentId);
          const p = res.data;
          setAmount(String(p.amount ?? ""));
          setDiscountAmount(String(p.discount_amount ?? "0"));
          setMode(p.mode || "cash");
          setReference(p.reference || "");
          setNotes(p.notes || "");
          setCustomerName(p.customer_name || "");

          if (p.created_at) {
            const dt = new Date(p.created_at);
            const YYYY = dt.getFullYear();
            const MM = String(dt.getMonth() + 1).padStart(2, "0");
            const DD = String(dt.getDate()).padStart(2, "0");
            const hh = String(dt.getHours()).padStart(2, "0");
            const mm = String(dt.getMinutes()).padStart(2, "0");
            setPaymentDate(`${YYYY}-${MM}-${DD}`);
            setPaymentTime(`${hh}:${mm}`);
          }
        } catch {
          toast.error("Could not load payment details");
          onClose();
        } finally {
          setLoading(false);
        }
      };
      void load();
    }
  }, [open, paymentId]);

  const handleSave = async () => {
    if (!paymentId) return;
    const numAmount = Number(amount);
    const numDisc = Number(discountAmount) || 0;
    if (isNaN(numAmount) || numAmount < 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setSaving(true);
    try {
      let created_at: string | undefined = undefined;
      if (paymentDate && paymentTime) {
        created_at = new Date(`${paymentDate}T${paymentTime}:00`).toISOString();
      } else if (paymentDate) {
        created_at = new Date(`${paymentDate}T00:00:00`).toISOString();
      }

      const payload = {
        amount: numAmount,
        discount_amount: numDisc,
        mode,
        reference: reference.trim(),
        notes: notes.trim(),
        ...(created_at ? { created_at } : {}),
      };

      if (portal) {
        await portalApi.updateCustomerPayment(paymentId, payload);
      } else {
        await paymentsApi.update(paymentId, payload);
      }

      toast.success("Payment updated successfully");
      onClose();
      if (onUpdated) onUpdated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Could not update payment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!paymentId) return;
    if (!window.confirm("Are you sure you want to delete this payment record?")) return;

    setDeleting(true);
    try {
      if (portal) {
        await portalApi.deleteCustomerPayment(paymentId);
      } else {
        await paymentsApi.delete(paymentId);
      }
      toast.success("Payment deleted");
      onClose();
      if (onUpdated) onUpdated();
    } catch {
      toast.error("Could not delete payment");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={paymentId ? `Edit Payment #${paymentId}` : "Edit Payment"}
      maxWidth="sm"
      actions={
        <Box sx={{ display: "flex", width: "100%", justifyContent: "space-between" }}>
          <Button
            color="error"
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            disabled={deleting || saving}
            onClick={handleDelete}
          >
            Delete
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              className="gradient-button"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <EditIcon />}
              disabled={saving || loading}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </Stack>
        </Box>
      }
    >
      {loading ? (
        <LoadingState message="Loading payment details…" />
      ) : (
        <Stack spacing={2} sx={{ pt: 1 }}>
          {customerName && (
            <Typography variant="body2" color="text.secondary">
              <strong>Customer:</strong> {customerName}
            </Typography>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              type="number"
              label="Amount Received (₹)"
              fullWidth
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ min: 0, step: "1" }}
            />
            <TextField
              type="number"
              label="Discount Amount (₹)"
              fullWidth
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              inputProps={{ min: 0, step: "1" }}
            />
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.5, display: "block" }}>
              Payment Mode
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_, v) => v && setMode(v)}
              fullWidth
            >
              <ToggleButton value="cash" sx={{ fontWeight: 700 }}>
                Cash
              </ToggleButton>
              <ToggleButton value="upi" sx={{ fontWeight: 700 }}>
                UPI
              </ToggleButton>
              <ToggleButton value="bank" sx={{ fontWeight: 700 }}>
                Bank
              </ToggleButton>
              <ToggleButton value="cheque" sx={{ fontWeight: 700 }}>
                Cheque
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              type="date"
              label="Payment Date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
            <TextField
              type="time"
              label="Payment Time"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={paymentTime}
              onChange={(e) => setPaymentTime(e.target.value)}
            />
          </Stack>

          <TextField
            label="Reference / Transaction ID"
            fullWidth
            placeholder="e.g. UPI Ref, Cheque No, Bank Ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />

          <TextField
            label="Notes"
            fullWidth
            multiline
            rows={2}
            placeholder="Optional remarks"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>
      )}
    </AppDialog>
  );
}
