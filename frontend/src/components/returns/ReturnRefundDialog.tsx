import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Stack,
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
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { formatCurrency } from "@/utils/format";

export type ReturnKind = "credit_note" | "refund";
export type RefundSettlementType = "credit" | "cash" | "upi" | "store_credit";

interface Props {
  open: boolean;
  onClose: () => void;
  total: number;
  customerName?: string;
  partyBalance?: number;
  isPartyBill?: boolean;
  portal?: boolean;
  returnType: string;
  refundMode: string;
  onConfirm: (returnType: string, refundMode: string) => void;
  saving?: boolean;
}

function ChoiceCard({
  active,
  title,
  subtitle,
  icon,
  accent,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
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
        minHeight: 110,
      }}
    >
      <Box sx={{ color: colors.icon, mb: 0.5 }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={800}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {subtitle}
      </Typography>
    </Box>
  );
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

function refundModeToSettlement(mode: string): RefundSettlementType {
  if (mode === "cash") return "cash";
  if (mode === "upi") return "upi";
  if (mode === "store_credit") return "store_credit";
  return "credit";
}

function settlementToRefundMode(settlement: RefundSettlementType): string {
  if (settlement === "credit") return "ledger_credit";
  if (settlement === "store_credit") return "store_credit";
  if (settlement === "upi") return "upi";
  return "cash";
}

export function returnTypeLabel(type: string) {
  if (type === "credit_note") return "Credit Return";
  if (type === "refund") return "Refund";
  return type;
}

export function refundModeLabel(mode: string) {
  switch (mode) {
    case "ledger_credit":
      return "Credit";
    case "cash":
      return "Cash";
    case "upi":
      return "UPI";
    case "store_credit":
      return "Store Credit";
    default:
      return mode;
  }
}

export function returnSettlementSummary(returnType: string, refundMode: string, total: number) {
  const kind = returnTypeLabel(returnType);
  if (returnType === "credit_note" || refundMode === "ledger_credit") {
    return `${kind} · Credit · ${formatCurrency(total)} to balance`;
  }
  if (refundMode === "store_credit") return `${kind} · Store Credit · ${formatCurrency(total)}`;
  return `${kind} · ${refundModeLabel(refundMode)} · ${formatCurrency(total)} refund`;
}

export default function ReturnRefundDialog({
  open,
  onClose,
  total,
  customerName,
  partyBalance,
  isPartyBill = false,
  portal = false,
  returnType,
  refundMode,
  onConfirm,
  saving,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const balanceLabel = portal ? "customer" : "party";
  const [kind, setKind] = useState<ReturnKind>(returnType === "credit_note" ? "credit_note" : "refund");
  const [settlement, setSettlement] = useState<RefundSettlementType>(refundModeToSettlement(refundMode));

  useEffect(() => {
    if (!open) return;
    setKind(returnType === "credit_note" ? "credit_note" : "refund");
    setSettlement(refundModeToSettlement(refundMode));
  }, [open, returnType, refundMode]);

  const handleKindChange = (next: ReturnKind) => {
    setKind(next);
    if (next === "credit_note") setSettlement("credit");
    else setSettlement("cash");
  };

  const handleConfirm = () => {
    const mode =
      kind === "credit_note" && settlement === "credit"
        ? "ledger_credit"
        : settlementToRefundMode(settlement);
    onConfirm(kind, mode);
  };

  const showStoreCredit = (portal || !isPartyBill) && kind === "refund";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      disableScrollLock
      sx={{ zIndex: 1500 }}
      slotProps={{
        backdrop: { sx: { zIndex: 1500 } },
      }}
      PaperProps={{ className: "billing-payment-dialog", sx: { zIndex: 1501 } }}
    >
      <Box className="billing-payment-dialog__header">
        <Typography variant="h6" fontWeight={800}>
          Return type & settlement
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent className="billing-payment-dialog__body">
        <Stack spacing={2.5}>
          {customerName && (
            <Typography variant="body2" color="text.secondary">
              Customer: <strong>{customerName}</strong>
            </Typography>
          )}

          <Box textAlign="center" py={0.5}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              RETURN TOTAL
            </Typography>
            <Typography variant="h4" fontWeight={900} color="primary.main">
              {formatCurrency(total)}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
              Return type
            </Typography>
            <Box className="billing-payment-cards" sx={{ gridTemplateColumns: "1fr 1fr" }}>
              <ChoiceCard
                active={kind === "credit_note"}
                title="Credit Return"
                subtitle={`Credit note — adjust ${balanceLabel} balance`}
                icon={<AccountBalanceIcon />}
                accent="blue"
                onClick={() => handleKindChange("credit_note")}
              />
              <ChoiceCard
                active={kind === "refund"}
                title="Refund"
                subtitle="Pay cash or UPI to customer"
                icon={<ReceiptLongIcon />}
                accent="green"
                onClick={() => handleKindChange("refund")}
              />
            </Box>
          </Box>

          {partyBalance !== undefined && kind === "credit_note" && (
            <Stack direction="row" spacing={2} justifyContent="center">
              <Box textAlign="center">
                <Typography variant="caption" color="text.secondary">
                  Balance before
                </Typography>
                <Typography variant="body1" fontWeight={800}>
                  {formatCurrency(partyBalance)}
                </Typography>
              </Box>
              {settlement === "credit" && (
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary">
                    Balance after
                  </Typography>
                  <Typography variant="body1" fontWeight={800} color="success.main">
                    {formatCurrency(Math.max(0, partyBalance - total))}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}

          <Box>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
              {kind === "credit_note" ? "Credit settlement" : "Refund method"}
            </Typography>
            <Box className="billing-payment-cards">
              {kind === "credit_note" ? (
                <SettlementCard
                  active={settlement === "credit"}
                  title="Credit to balance"
                  subtitle={`Reduce ${balanceLabel} dues`}
                  amount={formatCurrency(total)}
                  icon={<AccountBalanceIcon />}
                  accent="blue"
                  onClick={() => setSettlement("credit")}
                />
              ) : (
                <>
                  <SettlementCard
                    active={settlement === "cash"}
                    title="Cash refund"
                    subtitle="Pay cash to customer"
                    amount={formatCurrency(total)}
                    icon={<PaymentsIcon />}
                    accent="green"
                    onClick={() => setSettlement("cash")}
                  />
                  <SettlementCard
                    active={settlement === "upi"}
                    title="UPI refund"
                    subtitle="Transfer via UPI"
                    amount={formatCurrency(total)}
                    icon={<CreditCardIcon />}
                    accent="orange"
                    onClick={() => setSettlement("upi")}
                  />
                  {showStoreCredit && (
                    <SettlementCard
                      active={settlement === "store_credit"}
                      title="Store credit"
                      subtitle="Credit for future purchases"
                      amount={formatCurrency(total)}
                      icon={<AccountBalanceIcon />}
                      accent="blue"
                      onClick={() => setSettlement("store_credit")}
                    />
                  )}
                </>
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions className="billing-payment-dialog__actions">
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          className="gradient-button"
          onClick={handleConfirm}
          disabled={saving || total <= 0}
        >
          {saving ? "Saving…" : "Confirm"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
