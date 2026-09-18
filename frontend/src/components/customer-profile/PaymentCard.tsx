import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import PaymentsIcon from "@mui/icons-material/Payments";
import toast from "react-hot-toast";
import { paymentsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { formatCurrency } from "@/utils/format";
import { roundMoney } from "@/utils/money";

type PaymentMode = "cash" | "upi" | "bank";

interface Props {
  customerId: number;
  customerName: string;
  closingBalance: number;
  onRecorded: () => void;
  portal?: boolean;
}

export default function PaymentCard({ customerId, customerName, closingBalance, onRecorded, portal = false }: Props) {
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
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
          `${parts.join(" + ")}. Balance cleared — advance ${formatCurrency(Math.abs(newClosing))}`
        );
      } else {
        toast.success(`${parts.join(" + ")}. New balance: ${formatCurrency(newClosing)}`);
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

  const newBalanceClass =
    newClosing <= 0 ? "cp-payment__row-value cp-payment__row-value--cleared" : "cp-payment__row-value cp-payment__row-value--new";

  return (
    <Box className="cp-panel cp-payment" id="receive-payment">
      <Typography className="cp-payment__title">Receive Payment</Typography>

      <Box className="cp-payment__row">
        <span className="cp-payment__row-label">Current Due</span>
        <span className="cp-payment__row-value cp-payment__row-value--due">{formatCurrency(closingBalance)}</span>
      </Box>

      <TextField
        type="number"
        label="Amount Received"
        size="small"
        fullWidth
        className="app-outlined-field"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputProps={{ min: 0, step: "1" }}
        placeholder="0"
        sx={{ mt: 1 }}
      />

      <TextField
        type="number"
        label="Discount in ₹"
        size="small"
        fullWidth
        className="app-outlined-field"
        value={discount}
        onChange={(e) => setDiscount(e.target.value)}
        inputProps={{ min: 0, step: "1" }}
        placeholder="0"
        sx={{ mt: 1.5 }}
      />

      <Typography className="cp-payment__row-label" sx={{ mt: 1.5, mb: 0.5, display: "block" }}>
        Payment Mode
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, v) => v && setMode(v)}
        className="cp-payment__modes"
        fullWidth
      >
        <ToggleButton value="cash" sx={{ flex: 1, fontWeight: 800, textTransform: "none" }}>
          Cash
        </ToggleButton>
        <ToggleButton value="upi" sx={{ flex: 1, fontWeight: 800, textTransform: "none" }}>
          UPI
        </ToggleButton>
        <ToggleButton value="bank" sx={{ flex: 1, fontWeight: 800, textTransform: "none" }}>
          Bank
        </ToggleButton>
      </ToggleButtonGroup>

      <Box className="cp-payment__quick">
        <Button
          size="small"
          variant="outlined"
          disabled={closingBalance <= 0}
          onClick={() => setAmount(String(closingBalance))}
          sx={{ fontWeight: 700, textTransform: "none", borderRadius: 2 }}
        >
          Full Amount
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={closingBalance <= 0}
          onClick={() => setAmount(String(roundMoney(closingBalance / 2)))}
          sx={{ fontWeight: 700, textTransform: "none", borderRadius: 2 }}
        >
          Half Amount
        </Button>
        <Button
          size="small"
          variant="text"
          onClick={() => {
            setAmount("");
            setDiscount("");
          }}
          sx={{ fontWeight: 700, textTransform: "none" }}
        >
          Clear
        </Button>
      </Box>

      <TextField
        label="Note"
        size="small"
        fullWidth
        className="app-outlined-field"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional"
      />

      <Box className="cp-payment__row" sx={{ mt: 1, borderBottom: "none" }}>
        <span className="cp-payment__row-label">New Balance</span>
        <span className={newBalanceClass}>{formatCurrency(newClosing)}</span>
      </Box>

      <Button
        variant="contained"
        className="gradient-button cp-payment__submit"
        startIcon={<PaymentsIcon />}
        disabled={saving || totalApplied <= 0}
        onClick={() => void recordPayment()}
      >
        {saving ? "Saving…" : "Record Payment"}
      </Button>
    </Box>
  );
}
