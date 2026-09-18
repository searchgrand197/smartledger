import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import ClearIcon from "@mui/icons-material/Clear";
import { formatCurrency } from "@/utils/format";
import PaymentModeToggle from "@/components/billing/PaymentModeToggle";

interface Props {
  itemCount: number;
  subtotal: number;
  discount: number;
  onDiscountChange: (v: number) => void;
  total: number;
  profit?: number;
  paymentMode: string;
  onPaymentModeChange: (mode: string) => void;
  printAfterSave: boolean;
  onPrintAfterSaveChange: (value: boolean) => void;
  onSave: () => void;
  onClear: () => void;
  saving?: boolean;
}

export default function BillingSummaryPanel({
  itemCount,
  subtotal,
  discount,
  onDiscountChange,
  total,
  profit,
  paymentMode,
  onPaymentModeChange,
  printAfterSave,
  onPrintAfterSaveChange,
  onSave,
  onClear,
  saving,
}: Props) {
  return (
    <Box className="billing-summary-panel animate-slide-in-right">
      <Box className="billing-summary-panel__scroll">
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
          All rates are inclusive (no extra tax line)
        </Typography>
        <Typography variant="overline" color="text.secondary" fontWeight={700}>
          Payment
        </Typography>
        <Box sx={{ mt: 0.75, mb: 1.5 }}>
          <PaymentModeToggle
            fullWidth
            value={paymentMode}
            onChange={onPaymentModeChange}
          />
        </Box>

        <Stack spacing={0.75} sx={{ mb: 1.5 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Items
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {itemCount}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Subtotal
            </Typography>
            <Typography variant="body2">{formatCurrency(subtotal)}</Typography>
          </Stack>
          {discount > 0 && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Discount
              </Typography>
              <Typography variant="body2" color="error.main">
                −{formatCurrency(discount)}
              </Typography>
            </Stack>
          )}
          {profit !== undefined && (
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Profit
              </Typography>
              <Typography variant="body2" color="success.main">
                {formatCurrency(profit)}
              </Typography>
            </Stack>
          )}
        </Stack>

        <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={1}>
          DISCOUNT (₹)
        </Typography>
        <TextField
          type="number"
          size="small"
          fullWidth
          value={discount || ""}
          onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
          sx={{ mt: 0.5, mb: 1.5 }}
          inputProps={{ min: 0, style: { fontSize: "1.1rem", fontWeight: 600 } }}
        />

        <Box
          sx={{
            bgcolor: "var(--color-table-header)",
            borderRadius: 2,
            p: 1.5,
            mb: 1.5,
            textAlign: "center",
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            TOTAL
          </Typography>
          <Typography variant="h5" fontWeight={800} color="primary.dark" sx={{ lineHeight: 1.2 }}>
            {formatCurrency(total)}
          </Typography>
        </Box>

        <FormControlLabel
          sx={{ mb: 0, mx: 0 }}
          control={
            <Checkbox
              checked={printAfterSave}
              onChange={(e) => onPrintAfterSaveChange(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="body2" fontWeight={600}>
              Print bill after save
            </Typography>
          }
        />
      </Box>

      <Stack spacing={1} className="billing-summary-panel__actions">
        <Button
          fullWidth
          size="large"
          className={printAfterSave ? undefined : "gradient-button"}
          variant="contained"
          color={printAfterSave ? "success" : "primary"}
          startIcon={printAfterSave ? <PrintIcon /> : <SaveIcon />}
          onClick={onSave}
          disabled={saving}
          sx={{ fontWeight: 700 }}
        >
          {saving ? "Saving…" : printAfterSave ? "Save & Print" : "Save Bill"}
        </Button>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<ClearIcon />}
          onClick={onClear}
          disabled={saving}
        >
          Clear
        </Button>
      </Stack>
    </Box>
  );
}
