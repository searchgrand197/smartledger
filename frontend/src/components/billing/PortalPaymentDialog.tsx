import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PaymentsIcon from "@mui/icons-material/Payments";
import { formatCurrency } from "@/utils/format";

interface Props {
  open: boolean;
  onClose: () => void;
  total: number;
  roundOff: number;
  onRoundOffChange: (v: number) => void;
  walkInName?: string;
  initialMode?: string;
  printAfterSave: boolean;
  onPrintAfterSaveChange: (v: boolean) => void;
  onConfirm: (paymentMode: "cash" | "upi") => void;
  saving?: boolean;
}

export default function PortalPaymentDialog({
  open,
  onClose,
  total,
  roundOff,
  onRoundOffChange,
  walkInName,
  initialMode = "cash",
  printAfterSave,
  onPrintAfterSaveChange,
  onConfirm,
  saving,
}: Props) {
  const [mode, setMode] = useState<"cash" | "upi">("cash");

  useEffect(() => {
    if (open) setMode(initialMode === "upi" ? "upi" : "cash");
  }, [open, initialMode]);

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: "billing-payment-dialog portal-payment-dialog" }}
    >
      <Box className="billing-payment-dialog__header">
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 1, opacity: 0.9 }}>
              Quick sale
            </Typography>
            <Typography variant="h5" fontWeight={900}>
              Complete payment
            </Typography>
            {walkInName && (
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                Customer: {walkInName}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} disabled={saving} sx={{ color: "inherit" }} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Stack>
        <Typography variant="h4" fontWeight={900} sx={{ mt: 2 }}>
          {formatCurrency(total)}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.85 }}>
          Retail bill total {roundOff !== 0 ? `(round off ${formatCurrency(roundOff)})` : ""}
        </Typography>
      </Box>

      <DialogContent sx={{ pt: 2.5 }}>
        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.5 }}>
          Payment received via
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            fullWidth
            variant={mode === "cash" ? "contained" : "outlined"}
            onClick={() => setMode("cash")}
            sx={{
              py: 2,
              fontWeight: 800,
              fontSize: "1rem",
              borderRadius: 2,
              borderWidth: 2,
              ...(mode === "cash"
                ? { bgcolor: "#2e7d32", "&:hover": { bgcolor: "#1b5e20" } }
                : { borderColor: "#2e7d32", color: "#1b5e20" }),
            }}
          >
            CASH
          </Button>
          <Button
            fullWidth
            variant={mode === "upi" ? "contained" : "outlined"}
            onClick={() => setMode("upi")}
            sx={{
              py: 2,
              fontWeight: 800,
              fontSize: "1rem",
              borderRadius: 2,
              borderWidth: 2,
              ...(mode === "upi"
                ? { bgcolor: "#1565c0", "&:hover": { bgcolor: "#0d47a1" } }
                : { borderColor: "#1565c0", color: "#0d47a1" }),
            }}
          >
            UPI
          </Button>
        </Stack>

        <TextField
          type="number"
          label="Round off (optional)"
          className="app-outlined-field"
          variant="outlined"
          size="small"
          fullWidth
          sx={{ mt: 2 }}
          value={roundOff || ""}
          onChange={(e) => onRoundOffChange(Number(e.target.value) || 0)}
          inputProps={{ step: 1 }}
          slotProps={{ htmlInput: { step: 1, inputMode: "numeric" } }}
        />

        <FormControlLabel
          sx={{ mt: 1.5, mx: 0 }}
          control={
            <Checkbox
              checked={printAfterSave}
              onChange={(e) => onPrintAfterSaveChange(e.target.checked)}
            />
          }
          label={<Typography fontWeight={600}>Print bill after save</Typography>}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={saving} sx={{ fontWeight: 700 }}>
          Back
        </Button>
        <Button
          variant="contained"
          className="gradient-button"
          disabled={saving || total <= 0}
          onClick={() => onConfirm(mode)}
          startIcon={<PaymentsIcon />}
          sx={{ fontWeight: 800, flex: 1 }}
        >
          {saving ? "Saving…" : printAfterSave ? "Save & print" : "Confirm & save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
