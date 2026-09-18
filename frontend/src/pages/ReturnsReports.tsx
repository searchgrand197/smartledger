import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
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
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { dashboardApi, reportsApi } from "@/api/services";
import ReturnViewDialog from "@/components/returns/ReturnViewDialog";
import { ContentCard, LoadingState, PageHeader, PageShell } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { openReturnPrintWindow } from "@/utils/print";
import toast from "react-hot-toast";
const REPORT_TABS = [
  { key: "salesReturns", label: "Sales Returns", fn: reportsApi.salesReturns },
  { key: "byProduct", label: "By Product", fn: reportsApi.returnsByProduct },
  { key: "byCustomer", label: "By Customer", fn: reportsApi.returnsByCustomer },
  { key: "byParty", label: "By Party", fn: reportsApi.returnsByParty },
  { key: "refunds", label: "Refunds", fn: reportsApi.refunds },
  { key: "creditNotes", label: "Credit Notes", fn: reportsApi.creditNotes },
] as const;

interface Props {
  embedded?: boolean;
  initialTabKey?: string | null;
  initialDateFrom?: string | null;
  initialDateTo?: string | null;
}

export default function ReturnsReports({
  embedded,
  initialTabKey,
  initialDateFrom,
  initialDateTo,
}: Props) {
  const initialTabIdx = initialTabKey
    ? REPORT_TABS.findIndex((t) => t.key === initialTabKey)
    : -1;

  const [tab, setTab] = useState(initialTabIdx !== -1 ? initialTabIdx : 0);
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialDateTo ?? "");

  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const active = REPORT_TABS[tab];
  const { data, isLoading } = useQuery({
    queryKey: ["returns-report", active.key, dateFrom, dateTo],
    queryFn: () => active.fn(params).then((r) => r.data),
  });

  const content = (
    <>
      {!embedded && (
        <PageHeader title="Return Reports" subtitle="Sales returns, refunds, credit notes and product analysis" />
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="From date"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <TextField
          label="To date"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        {REPORT_TABS.map((t) => (
          <Tab key={t.key} label={t.label} sx={{ textTransform: "none", fontWeight: 600 }} />
        ))}
      </Tabs>
      {isLoading ? (
        <LoadingState />
      ) : (
        <ReportBody tabKey={active.key} data={data} />
      )}
    </>
  );

  if (embedded) return <Box>{content}</Box>;
  return <PageShell>{content}</PageShell>;
}

function ReportBody({ tabKey, data }: { tabKey: string; data: unknown }) {
  const [viewReturnId, setViewReturnId] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [tabKey, data]);

  const handlePrint = (returnId: number) => {
    const opened = openReturnPrintWindow(returnId);
    if (!opened) toast.error("Allow pop-ups to print the return receipt");
  };

  if (!data) return <Typography color="text.secondary">No data</Typography>;

  const PAGE_SIZE = 15;

  if (tabKey === "byProduct") {
    const rows = data as {
      product_code: string;
      product_name: string;
      quantity_returned: number;
      return_amount: number | string;
      return_count: number;
    }[];

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const paginatedRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    return (
      <Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">Qty Returned</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Returns</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRows.map((r) => (
                <TableRow key={r.product_code}>
                  <TableCell>{r.product_name}</TableCell>
                  <TableCell align="right">{r.quantity_returned}</TableCell>
                  <TableCell align="right">{formatCurrency(r.return_amount)}</TableCell>
                  <TableCell align="right">{r.return_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {rows.length > PAGE_SIZE && (
          <Box className="cp-ledger-pagination" sx={{ mt: 1.5 }}>
            <Typography variant="caption" fontWeight={700}>
              {rows.length} entries · Page {safePage + 1} of {pageCount}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    );
  }

  if (tabKey === "byCustomer" || tabKey === "byParty") {
    const rows = data as Record<string, unknown>[];

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount - 1);
    const paginatedRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    return (
      <Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Returns</TableCell>
                <TableCell align="right">Total Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{String(r.customer_name || r.party_name)}</TableCell>
                  <TableCell align="right">{String(r.return_count)}</TableCell>
                  <TableCell align="right">{formatCurrency(r.total_amount as number | string)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {rows.length > PAGE_SIZE && (
          <Box className="cp-ledger-pagination" sx={{ mt: 1.5 }}>
            <Typography variant="caption" fontWeight={700}>
              {rows.length} entries · Page {safePage + 1} of {pageCount}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    );
  }

  const report = data as {
    count?: number;
    total_amount?: number | string;
    refund_paid?: number | string;
    returns?: Record<string, unknown>[];
  };

  const showActions = ["salesReturns", "refunds", "creditNotes"].includes(tabKey);
  const returnsList = report.returns || [];

  const pageCount = Math.max(1, Math.ceil(returnsList.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paginatedReturns = returnsList.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <ContentCard>
      <Stack direction="row" spacing={3} sx={{ mb: 2 }} flexWrap="wrap">
        {report.count != null && (
          <Typography variant="body2">
            <strong>Count:</strong> {report.count}
          </Typography>
        )}
        {report.total_amount != null && (
          <Typography variant="body2">
            <strong>Total:</strong> {formatCurrency(report.total_amount)}
          </Typography>
        )}
        {report.refund_paid != null && (
          <Typography variant="body2">
            <strong>Refund paid:</strong> {formatCurrency(report.refund_paid)}
          </Typography>
        )}
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Return #</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Customer / Party</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              {showActions && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedReturns.map((r, i) => {
              const returnId = Number(r.id);
              return (
                <TableRow key={returnId || i}>
                  <TableCell>{String(r.return_number)}</TableCell>
                  <TableCell>{formatDate(String(r.return_date))}</TableCell>
                  <TableCell>{String(r.customer || r.party)}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize" }}>
                    {String(r.return_type || (tabKey === "creditNotes" ? "credit_note" : tabKey === "refunds" ? "refund" : ""))
                      .replace(/_/g, " ") || "—"}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(r.total as number | string)}</TableCell>
                  {showActions && (
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View return">
                          <IconButton
                            size="small"
                            aria-label="View return"
                            disabled={!returnId}
                            onClick={() => setViewReturnId(returnId)}
                            sx={{
                              color: "var(--color-primary-dark)",
                              bgcolor: "var(--color-chip-bg)",
                              border: "1px solid var(--color-border)",
                              "&:hover": { bgcolor: "var(--color-row-hover)", borderColor: "var(--color-primary)" },
                              "&.Mui-disabled": { opacity: 0.45 },
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print return">
                          <IconButton
                            size="small"
                            aria-label="Print return"
                            disabled={!returnId}
                            onClick={() => handlePrint(returnId)}
                            sx={{
                              color: "#14532d",
                              bgcolor: "#bbf7d0",
                              border: "1px solid #86efac",
                              "&:hover": { bgcolor: "#86efac", borderColor: "#22c55e" },
                              "&.Mui-disabled": { opacity: 0.45 },
                            }}
                          >
                            <PrintIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {returnsList.length > PAGE_SIZE && (
        <Box className="cp-ledger-pagination" sx={{ mt: 1.5 }}>
          <Typography variant="caption" fontWeight={700}>
            {returnsList.length} entries · Page {safePage + 1} of {pageCount}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </Stack>
        </Box>
      )}

      <ReturnViewDialog
        returnId={viewReturnId}
        open={viewReturnId != null}
        onClose={() => setViewReturnId(null)}
      />
    </ContentCard>
  );
}

export function ReturnsDashboardWidget({
  onCardClick,
}: {
  onCardClick?: (type: "today" | "month" | "refund") => void;
}) {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.get().then((r) => r.data),
  });

  if (!data) return null;

  return (
    <Box
      display="grid"
      gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))"
      gap={2}
      sx={{ mb: 2 }}
    >
      <Box
        className="stat-card"
        onClick={() => onCardClick?.("today")}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          cursor: onCardClick ? "pointer" : "default",
          transition: "all 0.2s",
          "&:hover": onCardClick
            ? {
                borderColor: "var(--color-primary, #0f766e)",
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }
            : {},
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Today&apos;s Returns
        </Typography>
        <Typography variant="h6" fontWeight={800}>
          {data.today_returns_count ?? 0}
        </Typography>
        <Typography variant="body2">{formatCurrency(data.today_returns_amount)}</Typography>
      </Box>
      <Box
        className="stat-card"
        onClick={() => onCardClick?.("month")}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          cursor: onCardClick ? "pointer" : "default",
          transition: "all 0.2s",
          "&:hover": onCardClick
            ? {
                borderColor: "var(--color-primary, #0f766e)",
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }
            : {},
        }}
      >
        <Typography variant="caption" color="text.secondary">
          This Month Returns
        </Typography>
        <Typography variant="h6" fontWeight={800}>
          {data.month_returns_count ?? 0}
        </Typography>
        <Typography variant="body2">{formatCurrency(data.month_returns_amount)}</Typography>
      </Box>
      <Box
        className="stat-card"
        onClick={() => onCardClick?.("refund")}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          cursor: onCardClick ? "pointer" : "default",
          transition: "all 0.2s",
          "&:hover": onCardClick
            ? {
                borderColor: "error.main",
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              }
            : {},
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Refund Paid (Month)
        </Typography>
        <Typography variant="h6" fontWeight={800} color="error.main">
          {formatCurrency(data.month_refund_paid)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Today: {formatCurrency(data.today_refund_paid)}
        </Typography>
      </Box>
    </Box>
  );
}
