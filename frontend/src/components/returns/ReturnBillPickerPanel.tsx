import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import BillViewDialog from "@/components/billing/BillViewDialog";
import ReturnLineTable from "@/components/returns/ReturnLineTable";
import { LoadingState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";

export type ReturnBillRow = {
  id: number;
  bill_number: string;
  total: number | string;
  created_at: string;
  payment_mode?: string;
  customer_name?: string;
  walk_in_name?: string;
  is_cancelled?: boolean;
  has_returnable_items?: boolean | null;
};

interface Props {
  portal?: boolean;
  bills: ReturnBillRow[];
  loading: boolean;
  expandedBillId: number | null;
  loadingBillId: number | null;
  getLinesForBill: (billId: number) => import("@/components/returns/ReturnLineTable").ReturnLineItem[];
  hasSession: (billId: number) => boolean;
  billHasReturnItems: (billId: number) => boolean;
  onExpandedBillChange: (billId: number | null) => void;
  onExpandBill: (bill: ReturnBillRow) => void;
  onUpdateQty: (billId: number, billItemId: number, qty: number) => void;
  onRemoveLine: (billId: number, billItemId: number) => void;
  onRefresh: () => void;
  partyLabel?: string;
}

function customerLabel(bill: ReturnBillRow) {
  return bill.walk_in_name || bill.customer_name || "—";
}

function billSubtitle(bill: ReturnBillRow, portal: boolean) {
  const parts: string[] = [];
  if (portal) parts.push(customerLabel(bill));
  if (bill.created_at) parts.push(formatDate(bill.created_at));
  parts.push(formatCurrency(bill.total));
  if (bill.payment_mode) parts.push(bill.payment_mode.toUpperCase());
  return parts.join(" · ");
}

export default function ReturnBillPickerPanel({
  portal = false,
  bills,
  loading,
  expandedBillId,
  loadingBillId,
  getLinesForBill,
  hasSession,
  billHasReturnItems,
  onExpandedBillChange,
  onExpandBill,
  onUpdateQty,
  onRemoveLine,
  onRefresh,
  partyLabel,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [previewBillId, setPreviewBillId] = useState<number | null>(null);

  const filtered = bills.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.bill_number.toLowerCase().includes(q) ||
      customerLabel(b).toLowerCase().includes(q)
    );
  });

  const handleEdit = (bill: ReturnBillRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (portal) {
      navigate(`/customer?edit=${bill.id}`);
    } else {
      navigate(`/wholesale/sale?edit=${bill.id}`);
    }
  };

  const handlePreview = (billId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewBillId(billId);
  };

  return (
    <Box className="return-bill-accordion" sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: "grey.50",
          borderBottom: 1,
          borderColor: "divider",
          flexWrap: "wrap",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Box flex={1} minWidth={0}>
          <Typography variant="subtitle2" fontWeight={800}>
            {partyLabel ? `${partyLabel} — bills` : "Bills"}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              ({bills.length})
            </Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Expand multiple bills — add return qty from each, then preview & save below
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search bill # or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 200 }, maxWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={loading}
          sx={{ fontWeight: 700 }}
        >
          Refresh
        </Button>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", bgcolor: "background.paper" }}>
        {loading && bills.length === 0 ? (
          <LoadingState message="Loading bills…" minHeight={160} />
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography color="text.secondary">No bills found for this party</Typography>
          </Box>
        ) : (
          filtered.map((bill) => {
            const isFullyReturned = bill.has_returnable_items === false;
            const isOpen = expandedBillId === bill.id;
            const loaded = hasSession(bill.id);
            const isLoadingThis = loadingBillId === bill.id;
            const lines = getLinesForBill(bill.id);
            const inCart = billHasReturnItems(bill.id);

            return (
              <Accordion
                key={bill.id}
                expanded={isOpen}
                disabled={bill.is_cancelled || isFullyReturned}
                onChange={(_, expanded) => {
                  if (expanded) {
                    onExpandBill(bill);
                  } else {
                    onExpandedBillChange(null);
                  }
                }}
                disableGutters
                elevation={0}
                sx={{
                  borderBottom: 1,
                  borderColor: "divider",
                  bgcolor: isOpen ? "grey.100" : "background.paper",
                  "&:before": { display: "none" },
                  opacity: bill.is_cancelled || isFullyReturned ? 0.55 : 1,
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    minHeight: 52,
                    px: 1.5,
                    bgcolor: isOpen ? "grey.100" : inCart ? "primary.50" : "background.paper",
                    "& .MuiAccordionSummary-content": {
                      alignItems: "center",
                      my: 0.75,
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ flex: 1, minWidth: 0, pr: 1 }}
                  >
                    <Box flex={1} minWidth={0}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography
                          variant="body2"
                          fontWeight={isOpen || inCart ? 800 : 600}
                          noWrap
                          color={isOpen ? "primary.dark" : "text.primary"}
                        >
                          {bill.bill_number}
                        </Typography>
                        {inCart && (
                          <Chip label="In return" size="small" color="primary" sx={{ height: 20, fontSize: "0.7rem" }} />
                        )}
                        {isFullyReturned && (
                          <Chip label="Fully returned" size="small" color="default" sx={{ height: 20, fontSize: "0.7rem" }} />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {billSubtitle(bill, portal)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.25} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Preview bill">
                        <IconButton size="small" color="primary" onClick={(e) => handlePreview(bill.id, e)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit bill">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={(e) => handleEdit(bill, e)}
                          disabled={bill.is_cancelled}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </AccordionSummary>

                <AccordionDetails sx={{ px: 0, pt: 0, pb: 1, bgcolor: "grey.50" }}>
                  {isLoadingThis ? (
                    <Stack alignItems="center" py={3}>
                      <CircularProgress size={28} />
                      <Typography variant="caption" color="text.secondary" mt={1}>
                        Loading returnable items…
                      </Typography>
                    </Stack>
                  ) : loaded ? (
                    <ReturnLineTable
                      embedded
                      items={lines}
                      onUpdateQty={(billItemId, qty) => onUpdateQty(bill.id, billItemId, qty)}
                      onRemoveLine={(billItemId) => onRemoveLine(bill.id, billItemId)}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                      Could not load items for this bill
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Box>

      <BillViewDialog
        billId={previewBillId}
        open={previewBillId != null}
        onClose={() => setPreviewBillId(null)}
        portal={portal}
      />
    </Box>
  );
}
