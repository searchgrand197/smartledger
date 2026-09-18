import { useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import PaymentsIcon from "@mui/icons-material/Payments";
import toast from "react-hot-toast";
import { paymentsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { ContentCard } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { roundMoney } from "@/utils/money";

interface Props {
  customerId: number;
  customerName: string;
  closingBalance: number;
  onRecorded: () => void;
  portal?: boolean;
}

export default function PartyReceivePayment({
  customerId,
  customerName,
  closingBalance,
  onRecorded,
  portal = false,
}: Props) {
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [mode, setMode] = useState<"cash" | "upi">("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const received = roundMoney(Number(amount) || 0);
  const discountRs = roundMoney(Number(discount) || 0);
  const totalApplied = roundMoney(received + discountRs);
  const newClosing = roundMoney(closingBalance - totalApplied);

  const recordPayment = async () => {
    if (totalApplied <= 0) {
      toast.error("Enter amount received and/or discount in ₹");
      return;
    }
    if (discountRs > closingBalance && received <= 0) {
      toast.error("Discount cannot exceed current balance");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer: customerId,
        amount: received,
        discount_amount: discountRs,
        mode,
        notes: notes.trim() || `Payment from ${customerName}`,
      };
      if (portal) {
        await portalApi.createCustomerPayment(payload);
      } else {
        await paymentsApi.create(payload);
      }
      const parts: string[] = [];
      if (received > 0) parts.push(`received ${formatCurrency(received)}`);
      if (discountRs > 0) parts.push(`discount ${formatCurrency(discountRs)}`);
      if (totalApplied > closingBalance && closingBalance >= 0) {
        toast.success(
          `${parts.join(" + ")}. Party balance cleared — advance ${formatCurrency(Math.abs(newClosing))}`
        );
      } else {
        toast.success(`${parts.join(" + ")}. New closing balance: ${formatCurrency(newClosing)}`);
      }
      setAmount("");
      setDiscount("");
      setNotes("");
      onRecorded();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Could not record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ContentCard
      title="Receive payment from party"
      subtitle="Cash/UPI received + discount in ₹ both reduce party balance"
    >
      <Stack spacing={2}>
        <Box
          display="grid"
          gridTemplateColumns={{ xs: "1fr 1fr", md: "repeat(4, 1fr)" }}
          gap={1.5}
        >
          <Box className="party-payment-calc party-payment-calc--current">
            <Typography variant="caption" fontWeight={800} color="text.secondary">
              CURRENT BALANCE (DUE)
            </Typography>
            <Typography variant="h6" fontWeight={900} color="warning.dark">
              {formatCurrency(closingBalance)}
            </Typography>
          </Box>
          <Box className="party-payment-calc party-payment-calc--received">
            <Typography variant="caption" fontWeight={800} color="text.secondary">
              AMOUNT RECEIVED
            </Typography>
            <Typography variant="h6" fontWeight={900} color="success.dark">
              {received > 0 ? formatCurrency(received) : "—"}
            </Typography>
          </Box>
          <Box className="party-payment-calc" sx={{ bgcolor: "#fef3c7", borderColor: "#fcd34d", border: "1.5px solid" }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary">
              DISCOUNT (₹)
            </Typography>
            <Typography variant="h6" fontWeight={900} color="warning.dark">
              {discountRs > 0 ? formatCurrency(discountRs) : "—"}
            </Typography>
          </Box>
          <Box className="party-payment-calc party-payment-calc--closing">
            <Typography variant="caption" fontWeight={800} color="text.secondary">
              NEW CLOSING BALANCE
            </Typography>
            <Typography
              variant="h6"
              fontWeight={900}
              color={newClosing > 0 ? "warning.dark" : "success.dark"}
            >
              {formatCurrency(newClosing)}
            </Typography>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Closing balance = current balance − amount received − discount (₹)
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "flex-end" }}>
          <TextField
            type="number"
            label="AMOUNT RECEIVED"
            className="app-outlined-field"
            variant="outlined"
            size="small"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={{ flex: 1, minWidth: 140 }}
            inputProps={{ min: 0, step: "1" }}
            placeholder="0"
          />
          <TextField
            type="number"
            label="DISCOUNT IN ₹"
            className="app-outlined-field"
            variant="outlined"
            size="small"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            sx={{ flex: 1, minWidth: 140 }}
            inputProps={{ min: 0, step: "1" }}
            placeholder="0"
          />
          <Box>
            <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              RECEIVED VIA
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_, v) => v && setMode(v)}
            >
              <ToggleButton value="cash" sx={{ fontWeight: 800, px: 2 }}>
                Cash
              </ToggleButton>
              <ToggleButton value="upi" sx={{ fontWeight: 800, px: 2 }}>
                UPI
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              QUICK FILL
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                disabled={closingBalance <= 0}
                onClick={() => setAmount(String(closingBalance))}
                sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
              >
                Full due
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={closingBalance <= 0}
                onClick={() => setAmount(String(roundMoney(closingBalance / 2)))}
                sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
              >
                Half
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setAmount("");
                  setDiscount("");
                }}
                sx={{ fontWeight: 700 }}
              >
                Clear
              </Button>
            </Stack>
          </Box>
        </Stack>

        <TextField
          label="Note (optional)"
          className="app-outlined-field"
          variant="outlined"
          size="small"
          fullWidth
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Cash received at shop"
        />

        <Button
          variant="contained"
          className="gradient-button"
          startIcon={<PaymentsIcon />}
          disabled={saving || totalApplied <= 0}
          onClick={() => void recordPayment()}
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, fontWeight: 800, px: 3 }}
        >
          {saving ? "Saving…" : "Record payment & update balance"}
        </Button>
      </Stack>
    </ContentCard>
  );
}
