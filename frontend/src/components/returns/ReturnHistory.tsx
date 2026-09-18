import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
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
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import { portalApi } from "@/api/portal";
import { returnsApi } from "@/api/services";
import ReturnViewDialog from "@/components/returns/ReturnViewDialog";
import ReturnWhatsAppAction from "@/components/returns/ReturnWhatsAppAction";
import { ListPagination, LoadingState } from "@/components/ui";
import { openReturnPrintWindow } from "@/utils/print";
import { portalReturnUrl, wholesaleReturnUrl } from "@/utils/returnNavigation";
import { formatCurrency, formatDate } from "@/utils/format";

export type ReturnHistoryRow = {
  id: number;
  return_number: string;
  return_date: string;
  customer: number;
  customer_name: string;
  original_bill: number;
  original_bill_number: string;
  return_type: string;
  refund_mode?: string;
  total: number | string;
  is_cancelled: boolean;
};

interface Props {
  portal?: boolean;
  title?: string;
}

const PAGE_SIZE = 25;

function formatReturnType(type: string) {
  return type ? type.replace(/_/g, " ") : "—";
}

function formatSettlement(row: ReturnHistoryRow) {
  if (row.return_type === "credit_note") return "Credit return";
  if (row.refund_mode === "ledger_credit") return "Credit to balance";
  if (row.refund_mode === "store_credit") return "Store credit";
  if (row.refund_mode === "upi") return "UPI refund";
  if (row.refund_mode === "cash") return "Cash refund";
  return formatReturnType(row.return_type);
}

export default function ReturnHistory({ portal = false, title }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReturnHistoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewReturnId, setViewReturnId] = useState<number | null>(null);

  const load = useCallback(
    async (q?: string, pageIndex = 0) => {
      setLoading(true);
      try {
        if (portal) {
          const { data } = await portalApi.quickSaleReturns({
            search: q?.trim() || undefined,
            page: pageIndex + 1,
            page_size: PAGE_SIZE,
          });
          const body = data as { results?: ReturnHistoryRow[]; count?: number };
          setRows(body.results || []);
          setTotal(body.count ?? (body.results?.length || 0));
        } else {
          const params: Record<string, string> = {
            page: String(pageIndex + 1),
            page_size: String(PAGE_SIZE),
          };
          if (q?.trim()) params.search = q.trim();
          const { data } = await returnsApi.list(params);
          if (Array.isArray(data)) {
            setRows(data);
            setTotal(data.length);
          } else {
            const body = data as { results?: ReturnHistoryRow[]; count?: number };
            setRows(body.results || []);
            setTotal(body.count ?? body.results?.length ?? 0);
          }
        }
      } catch {
        toast.error("Could not load returns history");
      } finally {
        setLoading(false);
      }
    },
    [portal]
  );

  useEffect(() => {
    void load(search, page);
  }, [load, page]);

  const handleSearch = () => {
    setPage(0);
    void load(search, 0);
  };

  const handlePrint = (row: ReturnHistoryRow) => {
    const opened = openReturnPrintWindow(row.id, { portal });
    if (!opened) toast.error("Allow pop-ups to print the return receipt");
  };

  const handleEditReturn = (row: ReturnHistoryRow) => {
    if (row.is_cancelled) {
      toast.error("This return is cancelled");
      return;
    }
    if (!row.original_bill) {
      toast.error("Original bill not found for this return");
      return;
    }
    if (portal) {
      navigate(portalReturnUrl(row.original_bill, row.customer_name));
    } else {
      navigate(wholesaleReturnUrl(row.original_bill, row.customer));
    }
  };

  const heading = title ?? (portal ? "Walk-in returns history" : "Party returns history");

  return (
    <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700} flex={1}>
          {heading}
        </Typography>
        <TextField
          size="small"
          placeholder="Search by customer, return #, bill #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          sx={{ minWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button variant="outlined" onClick={handleSearch} disabled={loading}>
          Search
        </Button>
        <IconButton onClick={() => void load(search, page)} disabled={loading} aria-label="refresh">
          <RefreshIcon />
        </IconButton>
      </Stack>

      <TableContainer component={Paper} className="app-table" sx={{ flex: 1, minHeight: 0, overflowX: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Return #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Original Bill</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Settlement</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  {loading ? (
                    <LoadingState message="Loading returns history…" minHeight={120} />
                  ) : (
                    <Typography color="text.secondary">No returns yet</Typography>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{formatDate(row.return_date)}</TableCell>
                  <TableCell>{row.return_number}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell>{row.original_bill_number}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{formatReturnType(row.return_type)}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>{formatSettlement(row)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.total)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.is_cancelled ? "status-pill status-pill--cancelled" : "status-pill status-pill--active"
                      }
                    >
                      {row.is_cancelled ? "Cancelled" : "Active"}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.25} justifyContent="flex-end" flexWrap="nowrap">
                      <Tooltip title="View">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => setViewReturnId(row.id)}
                          aria-label="view"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit / add return on same bill">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleEditReturn(row)}
                          disabled={row.is_cancelled}
                          aria-label="edit"
                        >
                          <EditIcon fontSize="small" />
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
                      {!row.is_cancelled && (
                        <ReturnWhatsAppAction
                          returnId={row.id}
                          returnNumber={row.return_number}
                          portal={portal}
                        />
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ListPagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        label="returns"
      />

      <ReturnViewDialog
        returnId={viewReturnId}
        open={viewReturnId != null}
        onClose={() => setViewReturnId(null)}
        portal={portal}
      />
    </Box>
  );
}
