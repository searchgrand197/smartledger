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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PaymentsIcon from "@mui/icons-material/Payments";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { formatCurrency } from "@/utils/format";
import { roundMoney } from "@/utils/money";

export type SettlementType = "full" | "partial" | "credit";

interface Props {
  open: boolean;
  onClose: () => void;
  total: number;
  roundOff: number;
  onRoundOffChange: (v: number) => void;
  customerName?: string;
  partyBalance?: number;
  initialPaid?: number;
  initialMode?: string;
  onConfirm: (paid: number, paymentMode: string) => void;
  saving?: boolean;
  /** When false, only updates payment on the bill (footer save does the actual save). */
  saveOnConfirm?: boolean;
}

function SettlementCard({
  active,
  title,
  subtitle,
  amount,
  icon,
  accent,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  amount: string;
  icon: React.ReactNode;
  accent: "green" | "orange" | "blue";
  onClick: () => void;
}) {
  const colors = {
    green: { border: "#2e7d32", bg: "#e8f5e9", icon: "#1b5e20" },
    orange: { border: "#e65100", bg: "#fff3e0", icon: "#bf360c" },
    blue: { border: "#1565c0", bg: "#e3f2fd", icon: "#0d47a1" },
  }[accent];

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      className={`billing-payment-card${active ? " billing-payment-card--active" : ""}`}
      sx={{
        border: `2px solid ${active ? colors.border : "var(--color-border)"}`,
        bgcolor: active ? colors.bg : "var(--color-bg-paper)",
        boxShadow: active ? `0 4px 14px ${colors.border}33` : "none",
      }}
    >
      <Box sx={{ color: colors.icon, mb: 0.5 }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={800}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
        {subtitle}
      </Typography>
      <Typography variant="h6" fontWeight={900} color={active ? colors.icon : "text.primary"}>
        {amount}
      </Typography>
    </Box>
  );
}

export default function BillingPaymentDialog({
  open,
  onClose,
  total,
  roundOff,
  onRoundOffChange,
  customerName,
  partyBalance,
  initialPaid = 0,
  initialMode = "credit",
  onConfirm,
  saving,
  saveOnConfirm = false,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [settlement, setSettlement] = useState<SettlementType>("credit");
  const [receiveMode, setReceiveMode] = useState<"cash" | "upi">("cash");
  const [partialPaid, setPartialPaid] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initialPaid <= 0) {
      setSettlement("credit");
      setPartialPaid("");
    } else if (initialPaid >= total) {
      setSettlement("full");
      setPartialPaid(String(total));
    } else {
      setSettlement("partial");
      setPartialPaid(String(initialPaid));
    }
    setReceiveMode(initialMode === "upi" ? "upi" : "cash");
  }, [open, initialPaid, initialMode, total]);

  const paidNow =
    settlement === "full"
      ? total
      : settlement === "credit"
        ? 0
        : roundMoney(Math.min(Number(partialPaid) || 0, total));

  const onBalance = roundMoney(Math.max(0, total - paidNow));

  const handleSettlement = (type: SettlementType) => {
    setSettlement(type);
    if (type === "full") setPartialPaid(String(total));
    if (type === "credit") setPartialPaid("");
    if (type === "partial" && !partialPaid) setPartialPaid(String(roundMoney(total / 2)));
  };

  const handleConfirm = () => {
    const mode =
      paidNow <= 0 ? "credit" : paidNow >= total ? receiveMode : receiveMode;
    onConfirm(paidNow, mode);
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ className: "billing-payment-dialog" }}
    >
      <Box className="billing-payment-dialog__header">
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 1, opacity: 0.9 }}>
              Payment
            </Typography>
            <Typography variant="h5" fontWeight={900}>
              Settle this bill
            </Typography>
            {customerName && (
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                {customerName}
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
          Bill total {roundOff !== 0 ? `(incl. round off ${formatCurrency(roundOff)})` : ""}
        </Typography>
        {partyBalance !== undefined && (
          <Typography variant="caption" display="block" sx={{ mt: 0.5, opacity: 0.85 }}>
            Party balance before this bill: {formatCurrency(partyBalance)}
          </Typography>
        )}
      </Box>

      <DialogContent sx={{ pt: 2.5, pb: 1 }}>
        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.5 }}>
          How is payment done?
        </Typography>

        <Box className="billing-payment-cards">
          <SettlementCard
            active={settlement === "full"}
            title="Full payment"
            subtitle="Entire amount received today"
            amount={formatCurrency(total)}
            icon={<PaymentsIcon />}
            accent="green"
            onClick={() => handleSettlement("full")}
          />
          <SettlementCard
            active={settlement === "partial"}
            title="Partial payment"
            subtitle="Some now, rest on party balance"
            amount={settlement === "partial" ? formatCurrency(paidNow) : "Custom"}
            icon={<AccountBalanceIcon />}
            accent="orange"
            onClick={() => handleSettlement("partial")}
          />
          <SettlementCard
            active={settlement === "credit"}
            title="All on credit"
            subtitle="Nothing received today"
            amount={formatCurrency(0)}
            icon={<CreditCardIcon />}
            accent="blue"
            onClick={() => handleSettlement("credit")}
          />
        </Box>

        {(settlement === "full" || settlement === "partial") && (
          <Box sx={{ mt: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
              {settlement === "full" ? "Received via" : "Partial amount received"}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              {settlement === "partial" && (
                <TextField
                  type="number"
                  label="Amount received now"
                  className="app-outlined-field"
                  variant="outlined"
                  size="small"
                  fullWidth
                  autoFocus
                  value={partialPaid}
                  onChange={(e) => setPartialPaid(e.target.value)}
                  inputProps={{ min: 0, max: total, step: 1 }}
                  slotProps={{ htmlInput: { min: 0, max: total, step: 1, inputMode: "numeric" } }}
                  sx={{ flex: 1 }}
                />
              )}
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                {(["cash", "upi"] as const).map((m) => (
                  <Button
                    key={m}
                    variant={receiveMode === m ? "contained" : "outlined"}
                    onClick={() => setReceiveMode(m)}
                    sx={{
                      fontWeight: 800,
                      minWidth: 88,
                      textTransform: "uppercase",
                      ...(receiveMode === m
                        ? m === "cash"
                          ? { bgcolor: "#2e7d32", "&:hover": { bgcolor: "#1b5e20" } }
                          : { bgcolor: "#1565c0", "&:hover": { bgcolor: "#0d47a1" } }
                        : {}),
                    }}
                  >
                    {m}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Box>
        )}

        <Box className="billing-payment-summary" sx={{ mt: 2.5 }}>
          <Box className="billing-payment-summary__cell">
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Paid now
            </Typography>
            <Typography variant="h6" fontWeight={900} color="success.dark">
              {formatCurrency(paidNow)}
            </Typography>
          </Box>
          <Box className="billing-payment-summary__cell billing-payment-summary__cell--warn">
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Add to balance
            </Typography>
            <Typography variant="h6" fontWeight={900} color="warning.dark">
              {formatCurrency(onBalance)}
            </Typography>
          </Box>
          <Box className="billing-payment-summary__cell billing-payment-summary__cell--party">
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Party owes after
            </Typography>
            <Typography variant="h6" fontWeight={900} color="primary.dark">
              {formatCurrency(roundMoney((partyBalance ?? 0) + onBalance))}
            </Typography>
          </Box>
        </Box>

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

      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={saving} sx={{ fontWeight: 700 }}>
          Back to bill
        </Button>
        <Button
          variant="contained"
          className="gradient-button"
          disabled={saving || (settlement === "partial" && paidNow <= 0)}
          onClick={handleConfirm}
          startIcon={<PaymentsIcon />}
          sx={{ fontWeight: 800, flex: 1 }}
        >
          {saving ? "Saving…" : saveOnConfirm ? "Confirm & save bill" : "Apply payment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
