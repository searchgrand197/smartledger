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
import VisibilityIcon from "@mui/icons-material/Visibility";
import { formatCurrency } from "@/utils/format";
import { returnSettlementSummary } from "@/components/returns/ReturnRefundDialog";

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

interface Props {
  returnType: string;
  refundMode: string;
  itemCount: number;
  billCount?: number;
  total: number;
  partyBalance?: number;
  hasItems: boolean;
  notes: string;
  onNotesChange: (v: string) => void;
  onOpenSettlement: () => void;
  onPreview: () => void;
  onSave: () => void;
  onSaveAndPrint: () => void;
  onClear: () => void;
  saving?: boolean;
}

export default function ReturnFooter({
  returnType,
  refundMode,
  itemCount,
  billCount = 0,
  total,
  partyBalance,
  hasItems,
  notes,
  onNotesChange,
  onOpenSettlement,
  onPreview,
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
              size="small"
              label="Notes"
              placeholder="Optional"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              sx={{ minWidth: 160, flex: 1, "& .MuiInputBase-input": { fontWeight: 600 } }}
            />
            <StatBox label="Items" value={itemCount} />
            {billCount > 0 && <StatBox label="Bills" value={billCount} />}
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
            <Box
              component="button"
              type="button"
              onClick={onPreview}
              disabled={!hasItems}
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                border: "none",
                cursor: hasItems ? "pointer" : "default",
                bgcolor: hasItems ? "secondary.main" : "grey.300",
                color: "#fff",
                minWidth: 110,
                textAlign: "center",
                opacity: hasItems ? 1 : 0.7,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.95, display: "block" }}>
                PREVIEW
              </Typography>
              <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
                <VisibilityIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                  {itemCount}
                </Typography>
              </Stack>
            </Box>

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
                onClick={onOpenSettlement}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpenSettlement()}
                sx={{ cursor: "pointer" }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  Settlement
                </Typography>
                <Typography variant="body2" fontWeight={800}>
                  {returnSettlementSummary(returnType, refundMode, total)}
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
              {saving ? "Saving…" : compactLabels ? "Save" : "Save Return"}
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
