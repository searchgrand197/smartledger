import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { formatCurrency } from "@/utils/format";
import type { ProductRateContext } from "@/types";

interface Props {
  context: ProductRateContext;
  onApplyRate: (rate: number) => void;
  onSavePartyRate?: (rate: number) => void;
}

function RateChip({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: number | null | undefined;
  color: "primary" | "success" | "inherit";
  onClick: () => void;
}) {
  if (value == null) return null;
  return (
    <Button
      size="small"
      variant="outlined"
      color={color}
      onClick={onClick}
      sx={{ justifyContent: "flex-start", textTransform: "none", py: 0.75 }}
    >
      <Box textAlign="left">
        <Typography variant="caption" display="block" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={700}>
          {formatCurrency(value)}
        </Typography>
      </Box>
    </Button>
  );
}

export default function BillingRatePanel({ context, onApplyRate, onSavePartyRate }: Props) {
  const lineRate =
    context.party_rate ?? context.last_sale_rate ?? context.suggested_rate;

  return (
    <Box sx={{ p: 1.5, bgcolor: "#f0f7ff", borderRadius: 2, border: "1px solid #90caf9" }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        {context.product_name}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Tap a rate to apply · edit freely in the line table
      </Typography>
      <Stack spacing={0.75}>
        <RateChip
          label="Party rate (fixed for this customer)"
          value={context.party_rate}
          color="primary"
          onClick={() => onApplyRate(Number(context.party_rate))}
        />
        <RateChip
          label="Global rate (inventory price)"
          value={context.global_rate}
          color="inherit"
          onClick={() => onApplyRate(Number(context.global_rate))}
        />
        <RateChip
          label="Last sale to this party"
          value={context.last_sale_rate}
          color="success"
          onClick={() => onApplyRate(Number(context.last_sale_rate))}
        />
      </Stack>
      {context.last_rates_to_customer?.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
          {context.last_rates_to_customer.map((r, i) => (
            <Chip
              key={i}
              size="small"
              label={formatCurrency(r.rate)}
              onClick={() => onApplyRate(Number(r.rate))}
              sx={{ cursor: "pointer" }}
            />
          ))}
        </Stack>
      )}
      {onSavePartyRate && (
        <Button
          size="small"
          fullWidth
          variant="contained"
          sx={{ mt: 1 }}
          onClick={() => onSavePartyRate(lineRate)}
        >
          Save current as party rate
        </Button>
      )}
    </Box>
  );
}
