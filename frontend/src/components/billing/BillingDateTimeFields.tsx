import { Stack, TextField } from "@mui/material";
import { format, isValid, parse } from "date-fns";

export function defaultBillDate() {
  return format(new Date(), "yyyy-MM-dd");
}

export function defaultBillTime() {
  return format(new Date(), "HH:mm");
}

/** Combine date + time inputs into ISO string for the API. */
export function buildBillAtIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const parsed = parse(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", new Date());
  if (!isValid(parsed)) return null;
  return parsed.toISOString();
}

interface Props {
  billDate: string;
  billTime: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}

/** Editable bill date & time (supports previous dates for back-dated bills). */
export default function BillingDateTimeFields({
  billDate,
  billTime,
  onDateChange,
  onTimeChange,
}: Props) {
  return (
    <Stack direction="row" spacing={0.75} className="billing-datetime-fields" sx={{ width: "auto", maxWidth: "100%", minWidth: 0 }}>
      <TextField
        type="date"
        label="DATE"
        size="small"
        value={billDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="app-outlined-field billing-meta-field billing-meta-field--date app-outlined-field--has-value"
        variant="outlined"
        InputLabelProps={{ shrink: true }}
        sx={{ flex: "1 1 140px", minWidth: 132, maxWidth: 168 }}
        slotProps={{ htmlInput: { "aria-label": "Bill date" } }}
      />
      <TextField
        type="time"
        label="TIME"
        size="small"
        value={billTime}
        onChange={(e) => onTimeChange(e.target.value)}
        className="app-outlined-field billing-meta-field billing-meta-field--time app-outlined-field--has-value"
        variant="outlined"
        InputLabelProps={{ shrink: true }}
        sx={{ flex: "0 0 auto", width: "auto", minWidth: 0 }}
        slotProps={{ htmlInput: { "aria-label": "Bill time", step: 60 } }}
      />
    </Stack>
  );
}
