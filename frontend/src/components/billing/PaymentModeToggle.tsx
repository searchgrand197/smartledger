import { ToggleButton, ToggleButtonGroup } from "@mui/material";

export const PAYMENT_MODES = [
  {
    value: "cash",
    label: "CASH",
    color: "#1b5e20",
    tint: "#c8e6c9",
    selected: "#2e7d32",
  },
  {
    value: "upi",
    label: "UPI",
    color: "#0d47a1",
    tint: "#bbdefb",
    selected: "#1565c0",
  },
  {
    value: "credit",
    label: "CREDIT",
    color: "#bf360c",
    tint: "#ffcc80",
    selected: "#e65100",
  },
] as const;

export const PORTAL_PAYMENT_MODES = PAYMENT_MODES.filter(
  (m) => m.value === "cash" || m.value === "upi" || m.value === "credit"
);

export const DEFAULT_PAYMENT_MODE = "credit";

export function paymentButtonSx(mode: (typeof PAYMENT_MODES)[number], active: boolean) {
  return {
    minWidth: 88,
    px: 2,
    py: 1,
    fontSize: "0.8125rem",
    fontWeight: 800,
    letterSpacing: 0.6,
    lineHeight: 1.2,
    border: `2px solid ${mode.selected} !important`,
    borderColor: `${mode.selected} !important`,
    color: active ? "#fff !important" : `${mode.color} !important`,
    bgcolor: active ? `${mode.selected} !important` : `${mode.tint} !important`,
    boxShadow: active ? `0 2px 8px ${mode.selected}55` : "none",
    "&:hover": {
      bgcolor: active ? `${mode.selected} !important` : `${mode.tint} !important`,
      filter: active ? "brightness(1.06)" : "brightness(0.96)",
    },
    "&.Mui-selected": {
      bgcolor: `${mode.selected} !important`,
      color: "#fff !important",
    },
    "&.Mui-selected:hover": {
      bgcolor: `${mode.selected} !important`,
    },
  };
}

interface Props {
  value: string;
  onChange: (mode: string) => void;
  fullWidth?: boolean;
}

export default function PaymentModeToggle({ value, onChange, fullWidth }: Props) {
  return (
    <ToggleButtonGroup
      exclusive
      fullWidth={fullWidth}
      size="medium"
      value={value}
      onChange={(_, v) => v && onChange(v)}
      sx={{
        gap: 0.75,
        "& .MuiToggleButtonGroup-grouped": {
          border: 2,
          borderRadius: "10px !important",
          mx: 0.25,
          flex: fullWidth ? 1 : undefined,
        },
      }}
    >
      {PAYMENT_MODES.map((mode) => (
        <ToggleButton
          key={mode.value}
          value={mode.value}
          sx={paymentButtonSx(mode, value === mode.value)}
        >
          {mode.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
