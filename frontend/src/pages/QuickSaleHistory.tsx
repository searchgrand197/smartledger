import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
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
import RefreshIcon from "@mui/icons-material/Refresh";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import { portalApi } from "@/api/portal";
import { portalReturnUrl } from "@/utils/returnNavigation";
import BillCancelAction from "@/components/billing/BillCancelAction";
import BillViewDialog from "@/components/billing/BillViewDialog";
import { openInvoicePrintWindow } from "@/utils/print";
import { formatCurrency, formatDate } from "@/utils/format";
import { LoadingState } from "@/components/ui";

type QuickSaleRow = {
  id: number;
  bill_number: string;
  walk_in_name: string;
  total: number | string;
  payment_mode: string;
  created_at: string;
};

export default function QuickSaleHistory() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<QuickSaleRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewBillId, setViewBillId] = useState<number | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const { data } = await portalApi.quickSaleHistory(q?.trim() || undefined);
      setRows(data as QuickSaleRow[]);
    } catch {
      toast.error("Could not load history");
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    void load(search);
  }, [load, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = (row: QuickSaleRow) => {
    const opened = openInvoicePrintWindow(row.id, { portal: true });
    if (!opened) toast.error("Allow pop-ups to print the bill");
  };

  return (
    <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700} flex={1}>
          Walk-in sale history
        </Typography>
        <TextField
          size="small"
          placeholder="Search by name or bill #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          sx={{ minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button variant="outlined" onClick={() => load(search)} disabled={loading}>
          Search
        </Button>
        <IconButton onClick={() => load(search)} disabled={loading} aria-label="refresh">
          <RefreshIcon />
        </IconButton>
      </Stack>

      <TableContainer component={Paper} className="app-table" sx={{ flex: 1, minHeight: 0, overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Bill #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Pay</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  {loading ? (
                    <LoadingState message="Loading sales history…" minHeight={120} />
                  ) : (
                    <Typography color="text.secondary">No walk-in sales yet</Typography>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{formatDate(row.created_at)}</TableCell>
                  <TableCell>{row.bill_number}</TableCell>
                  <TableCell>{row.walk_in_name}</TableCell>
                  <TableCell align="right">{formatCurrency(row.total)}</TableCell>
                  <TableCell sx={{ textTransform: "uppercase" }}>{row.payment_mode}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                      <Tooltip title="View">
                        <IconButton size="small" color="primary" onClick={() => setViewBillId(row.id)} aria-label="view">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print">
                        <IconButton
                          size="small"
                          sx={{ color: "#14532d", bgcolor: "#bbf7d0" }}
                          onClick={() => handlePrint(row)}
                          aria-label="print"
                        >
                          <PrintIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <BillCancelAction
                        billId={row.id}
                        billNumber={row.bill_number}
                        portal
                        onCancelled={reload}
                      />
                      <Tooltip title="Create return">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => navigate(portalReturnUrl(row.id, row.walk_in_name))}
                          aria-label="return"
                        >
                          <AssignmentReturnIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <BillViewDialog
        billId={viewBillId}
        open={viewBillId != null}
        onClose={() => setViewBillId(null)}
        portal
      />
    </Box>
  );
}
