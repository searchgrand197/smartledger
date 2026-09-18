import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import { billingApi } from "@/api/services";
import BillCancelAction from "@/components/billing/BillCancelAction";
import BillViewDialog from "@/components/billing/BillViewDialog";
import { wholesaleReturnUrl } from "@/utils/returnNavigation";
import { AppDialog, LoadingState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { openInvoicePrintWindow } from "@/utils/print";
import toast from "react-hot-toast";

type BillRow = {
  id: number;
  bill_number: string;
  customer_name: string;
  created_at: string;
  total: number | string;
  paid_amount?: number | string;
  payment_mode: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BillFinderDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchKey, setSearchKey] = useState(0);
  const [viewBillId, setViewBillId] = useState<number | null>(null);

  const params: Record<string, string> = {};
  if (query.trim()) params.search = query.trim();
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["bill-finder", searchKey],
    queryFn: () => billingApi.list(params).then((r) => {
      const body = r.data;
      return (body.results || body) as BillRow[];
    }),
    enabled: open && searchKey > 0,
  });

  const runSearch = () => {
    if (!query.trim() && !dateFrom && !dateTo) {
      toast.error("Enter bill no., customer name, or a date range");
      return;
    }
    setSearchKey((k) => k + 1);
  };

  const handlePrint = (billId: number) => {
    const opened = openInvoicePrintWindow(billId);
    if (!opened) toast.error("Allow pop-ups to print");
  };

  const handleClose = () => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setSearchKey(0);
    onClose();
  };

  return (
    <>
      <AppDialog
        open={open}
        onClose={handleClose}
        title="Find bill"
        maxWidth="md"
        actions={<Button onClick={handleClose}>Close</Button>}
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Search by bill number, customer name, code, or phone. Optional date range.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-end" }}>
            <TextField
              label="Bill / customer"
              placeholder="BILL-0007 or shop name"
              size="small"
              fullWidth
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <TextField
              label="From"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Button
              variant="contained"
              className="gradient-button"
              startIcon={<SearchIcon />}
              onClick={runSearch}
              sx={{ minWidth: { sm: 120 }, flexShrink: 0 }}
            >
              Search
            </Button>
          </Stack>

          {searchKey === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
              Enter search and click Search
            </Typography>
          ) : isLoading || isFetching ? (
            <LoadingState message="Searching bills…" />
          ) : !data?.length ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
              No bills found
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bill #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((row) => {
                    return (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{row.bill_number}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>{row.payment_mode}</TableCell>
                      <TableCell align="right">{formatCurrency(row.total)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                          <Tooltip title="View">
                            <IconButton size="small" color="primary" onClick={() => setViewBillId(row.id)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Print">
                            <IconButton
                              size="small"
                              sx={{ color: "#14532d", bgcolor: "#bbf7d0" }}
                              onClick={() => handlePrint(row.id)}
                            >
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <BillCancelAction
                            billId={row.id}
                            billNumber={row.bill_number}
                            onCancelled={() => void qc.invalidateQueries({ queryKey: ["bill-finder"] })}
                          />
                          <Tooltip title="Create return">
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => {
                                handleClose();
                                navigate(wholesaleReturnUrl(row.id));
                              }}
                            >
                              <AssignmentReturnIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </AppDialog>

      <BillViewDialog billId={viewBillId} open={viewBillId != null} onClose={() => setViewBillId(null)} />
    </>
  );
}
