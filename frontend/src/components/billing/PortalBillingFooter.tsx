import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import { PAYMENT_MODES } from "@/components/billing/PaymentModeToggle";
import { formatCurrency } from "@/utils/format";
import { integerNumberFieldProps, parseDecimalInput } from "@/utils/numberField";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.75,
        borderRadius: 1.5,
        bgcolor: "grey.100",
        border: 1,
        borderColor: "grey.300",
        minWidth: 80,
        textAlign: "center",
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
    </Box>
  );
}

function paymentModeLabel(mode: string) {
  return PAYMENT_MODES.find((m) => m.value === mode)?.label ?? mode.toUpperCase();
}

function paymentSummary(paymentMode: string, paidAmount: number, dueAmount: number) {
  if (dueAmount <= 0) return `Paid · ${paymentModeLabel(paymentMode)}`;
  if (paidAmount > 0) return `Partial · ${formatCurrency(paidAmount)} paid · ${formatCurrency(dueAmount)} due`;
  return `Credit · ${formatCurrency(dueAmount)} on balance`;
}

interface Props {
  paymentMode: string;
  paidAmount: number;
  dueAmount: number;
  discount: number;
  onDiscountChange: (v: number) => void;
  itemCount: number;
  subtotal: number;
  total: number;
  partyBalance?: number;
  hasItems: boolean;
  onOpenPayment: () => void;
  onSave: () => void;
  onSaveAndPrint: () => void;
  onClear: () => void;
  saving?: boolean;
}

export default function PortalBillingFooter({
  paymentMode,
  paidAmount,
  dueAmount,
  discount,
  onDiscountChange,
  itemCount,
  subtotal,
  total,
  partyBalance,
  hasItems,
  onOpenPayment,
  onSave,
  onSaveAndPrint,
  onClear,
  saving,
}: Props) {
  const theme = useTheme();
  const compactLabels = useMediaQuery(theme.breakpoints.down(480));

  const footerBtnSx = {
    whiteSpace: "nowrap",
    minWidth: 0,
    px: { xs: 1.25, sm: 2 },
    py: { xs: 1.15, sm: 0.875 },
    fontSize: { xs: "0.8125rem", sm: "0.875rem" },
    "& .MuiButton-startIcon": { mr: { xs: 0.5, sm: 1 } },
  } as const;

  return (
    <Box className="billing-footer-bar portal-billing-footer">
      <Stack spacing={1.25}>
        {partyBalance !== undefined && (
          <Typography variant="body2" fontWeight={800} sx={{ color: "var(--color-text)" }}>
            Party balance: {formatCurrency(partyBalance)}
          </Typography>
        )}

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={{ xs: 1.25, lg: 2 }}
          alignItems={{ xs: "stretch", lg: "center" }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              type="number"
              size="small"
              label="Discount (₹)"
              value={discount || ""}
              onChange={(e) => onDiscountChange(parseDecimalInput(e.target.value))}
              sx={{ width: 110, "& .MuiInputBase-input": { fontWeight: 700 } }}
              {...integerNumberFieldProps(0)}
            />
            <StatBox label="Items" value={itemCount} />
            <StatBox label="Subtotal" value={formatCurrency(subtotal)} />
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "#fff",
                minWidth: 110,
                textAlign: "center",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9 }}>
                TOTAL
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
                {formatCurrency(total)}
              </Typography>
            </Box>

            {hasItems && total > 0 && (
              <Box
                className="billing-footer-payment-chip"
                onClick={onOpenPayment}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpenPayment()}
                sx={{ cursor: "pointer" }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  Payment
                </Typography>
                <Typography variant="body2" fontWeight={800}>
                  {paymentSummary(paymentMode, paidAmount, dueAmount)}
                </Typography>
                <EditIcon sx={{ fontSize: 16, color: "primary.main", ml: 0.5 }} />
              </Box>
            )}
          </Stack>

          <Box className="billing-footer-actions" sx={{ ml: { lg: "auto" } }}>
            <Button
              variant="outlined"
              className="billing-footer-btn billing-footer-btn--save"
              startIcon={<SaveIcon />}
              onClick={onSave}
              disabled={saving || !hasItems}
              sx={{ ...footerBtnSx, fontWeight: 700 }}
            >
              {saving ? "Saving…" : compactLabels ? "Estimate" : "Estimate Bill"}
            </Button>
            <Button
              variant="contained"
              className="billing-footer-btn billing-footer-btn--print gradient-button"
              startIcon={<PrintIcon />}
              onClick={onSaveAndPrint}
              disabled={saving || !hasItems}
              sx={{ ...footerBtnSx, fontWeight: 800 }}
            >
              {saving ? "Saving…" : compactLabels ? "Save & Print" : "Save and Print"}
            </Button>
            <Button
              variant="outlined"
              className="billing-footer-btn billing-footer-btn--clear"
              onClick={onClear}
              disabled={saving}
              sx={{ ...footerBtnSx, fontWeight: 700 }}
            >
              Clear
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
