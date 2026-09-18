import { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { formatCurrency } from "@/utils/format";
import { integerNumberFieldProps, parseDecimalInput } from "@/utils/numberField";
import { PAYMENT_MODES } from "@/components/billing/PaymentModeToggle";

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success" | "warning" | "default";
}) {
  const styles =
    accent === "success"
      ? { bgcolor: "success.50", borderColor: "success.200", color: "success.dark" }
      : accent === "warning"
        ? { bgcolor: "#fff7ed", borderColor: "#fdba74", color: "#c2410c" }
        : { bgcolor: "grey.100", borderColor: "grey.300", color: "text.primary" };

  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.75,
        borderRadius: 1.5,
        border: 1,
        minWidth: 88,
        textAlign: "center",
        ...styles,
      }}
    >
      <Typography
        variant="caption"
        sx={{ display: "block", fontWeight: 700, color: "text.secondary", letterSpacing: 0.4 }}
      >
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
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

const footerBtnSx = {
  whiteSpace: "nowrap",
  minWidth: 0,
  px: { xs: 1.25, sm: 2 },
  py: { xs: 1.15, sm: 0.875 },
  fontSize: { xs: "0.8125rem", sm: "0.875rem" },
  "& .MuiButton-startIcon": { mr: { xs: 0.5, sm: 1 } },
} as const;

interface Props {
  paymentMode: string;
  paidAmount: number;
  dueAmount: number;
  discount: number;
  onDiscountChange: (v: number) => void;
  itemCount: number;
  subtotal: number;
  profit: number;
  total: number;
  partyBalance?: number;
  hasCustomer?: boolean;
  onOpenPayment: () => void;
  onSave: () => void;
  onSaveAndPrint: () => void;
  onClear: () => void;
  saving?: boolean;
}

function linesEmpty(itemCount: number) {
  return itemCount <= 0;
}

function MobileBillingFooter({
  paymentMode,
  paidAmount,
  dueAmount,
  discount,
  onDiscountChange,
  itemCount,
  subtotal,
  profit,
  total,
  partyBalance,
  hasCustomer,
  onOpenPayment,
  onSave,
  onSaveAndPrint,
  onClear,
  saving,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const disabled = saving || !hasCustomer || linesEmpty(itemCount);

  return (
    <Box className="billing-footer-bar billing-footer-bar--mobile">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            TOTAL
          </Typography>
          <Typography variant="h6" fontWeight={900} lineHeight={1.1} color="primary.dark">
            {formatCurrency(total)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 999,
              bgcolor: "grey.100",
              border: "1px solid",
              borderColor: "grey.300",
            }}
          >
            <Typography variant="caption" fontWeight={800}>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </Typography>
          </Box>
          <IconButton
            size="small"
            aria-label={detailsOpen ? "Hide bill details" : "Show bill details"}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            {detailsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      </Stack>

      {hasCustomer && total > 0 && (
        <Button
          fullWidth
          variant="outlined"
          size="small"
          className="billing-footer-payment-chip billing-footer-payment-chip--mobile"
          onClick={onOpenPayment}
          startIcon={<EditIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: 1, justifyContent: "space-between", textTransform: "none", py: 1 }}
        >
          <Box textAlign="left">
            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
              Payment
            </Typography>
            <Typography variant="body2" fontWeight={800}>
              {paymentSummary(paymentMode, paidAmount, dueAmount)}
            </Typography>
          </Box>
        </Button>
      )}

      <Collapse in={detailsOpen}>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {hasCustomer && partyBalance !== undefined && (
            <Typography variant="body2" fontWeight={800} sx={{ color: "var(--color-text)" }}>
              Party balance: {formatCurrency(partyBalance)}
            </Typography>
          )}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              type="number"
              size="small"
              label="Disc (₹)"
              value={discount || ""}
              onChange={(e) => onDiscountChange(parseDecimalInput(e.target.value))}
              sx={{ width: 96, flex: "1 1 96px" }}
              {...integerNumberFieldProps(0)}
            />
            <StatBox label="Subtotal" value={formatCurrency(subtotal)} />
            <StatBox label="Profit" value={formatCurrency(profit)} accent="success" />
          </Stack>
        </Stack>
      </Collapse>

      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        <Button
          variant="outlined"
          className="billing-footer-btn billing-footer-btn--save"
          startIcon={<SaveIcon />}
          onClick={onSave}
          disabled={disabled}
          sx={{ ...footerBtnSx, flex: 1, fontWeight: 700 }}
        >
          {saving ? "Saving…" : "Estimate"}
        </Button>
        <Button
          variant="contained"
          className="billing-footer-btn billing-footer-btn--print gradient-button"
          startIcon={<PrintIcon />}
          onClick={onSaveAndPrint}
          disabled={disabled}
          sx={{ ...footerBtnSx, flex: 1, fontWeight: 800 }}
        >
          {saving ? "Saving…" : "Save & Print"}
        </Button>
      </Stack>
      <Button
        fullWidth
        size="small"
        color="inherit"
        onClick={onClear}
        disabled={saving}
        sx={{ mt: 0.75, fontWeight: 600 }}
      >
        Clear bill
      </Button>
    </Box>
  );
}

export default function BillingFooterBar(props: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const compactLabels = useMediaQuery(theme.breakpoints.down(480));

  if (isMobile) {
    return <MobileBillingFooter {...props} />;
  }

  const {
    paymentMode,
    paidAmount,
    dueAmount,
    discount,
    onDiscountChange,
    itemCount,
    subtotal,
    profit,
    total,
    partyBalance,
    hasCustomer,
    onOpenPayment,
    onSave,
    onSaveAndPrint,
    onClear,
    saving,
  } = props;

  return (
    <Box className="billing-footer-bar">
      <Stack spacing={1.25}>
        {hasCustomer && partyBalance !== undefined && (
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
              sx={{
                width: 110,
                "& .MuiInputBase-input": { fontWeight: 700, fontSize: "0.95rem" },
              }}
              {...integerNumberFieldProps(0)}
            />
            <StatBox label="Items" value={itemCount} />
            <StatBox label="Subtotal" value={formatCurrency(subtotal)} />
            <StatBox label="Profit" value={formatCurrency(profit)} accent="success" />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
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

            {hasCustomer && total > 0 && (
              <Box
                className="billing-footer-payment-chip"
                onClick={onOpenPayment}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpenPayment()}
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
              disabled={saving || !hasCustomer || linesEmpty(itemCount)}
              sx={{ ...footerBtnSx, fontWeight: 700 }}
            >
              {saving ? "Saving…" : compactLabels ? "Estimate" : "Estimate Bill"}
            </Button>
            <Button
              variant="contained"
              className="billing-footer-btn billing-footer-btn--print gradient-button"
              startIcon={<PrintIcon />}
              onClick={onSaveAndPrint}
              disabled={saving || !hasCustomer || linesEmpty(itemCount)}
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
