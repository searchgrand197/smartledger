import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import toast from "react-hot-toast";

interface Props {
  billId: number;
  billNumber?: string;
  portal?: boolean;
  onCancelled?: () => void;
  iconOnly?: boolean;
}

export default function BillCancelAction({
  billId,
  billNumber,
  portal = false,
  onCancelled,
  iconOnly = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (portal) {
        const { portalApi } = await import("@/api/portal");
        await portalApi.cancelBill(billId);
      } else {
        const { billingApi } = await import("@/api/services");
        await billingApi.cancel(billId);
      }
      toast.success(`Bill ${billNumber || billId} cancelled`);
      setOpen(false);
      onCancelled?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not cancel bill";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const trigger = iconOnly ? (
    <Tooltip title="Cancel bill">
      <IconButton
        size="small"
        color="error"
        aria-label="cancel bill"
        onClick={() => setOpen(true)}
        sx={{ bgcolor: "#fee2e2", border: "1px solid #fecaca", flexShrink: 0 }}
      >
        <CancelIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  ) : (
    <Button variant="outlined" color="error" onClick={() => setOpen(true)}>
      Cancel Bill
    </Button>
  );

  return (
    <>
      {trigger}
      <Dialog open={open} onClose={() => !loading && setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Cancel bill?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to cancel{billNumber ? ` bill ${billNumber}` : " this bill"}? Stock will be
            restored and this action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            No, keep bill
          </Button>
          <Button variant="contained" color="error" onClick={() => void handleConfirm()} disabled={loading}>
            {loading ? "Cancelling…" : "Yes, cancel bill"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
