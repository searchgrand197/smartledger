import { useMemo, useState } from "react";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ReturnViewDialog from "@/components/returns/ReturnViewDialog";
import ReturnWhatsAppAction from "@/components/returns/ReturnWhatsAppAction";
import { ListPagination } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { openReturnPrintWindow } from "@/utils/print";
import toast from "react-hot-toast";

export interface ReturnRow {
  id: number;
  return_number: string;
  return_date: string;
  original_bill_number: string;
  return_type: string;
  refund_mode?: string;
  total: number | string;
  is_cancelled?: boolean;
}

interface Props {
  returns: ReturnRow[];
  portal?: boolean;
}

const PAGE_SIZE = 10;

function formatReturnType(type: string) {
  return type ? type.replace(/_/g, " ") : "—";
}

function formatSettlement(row: ReturnRow) {
  if (row.return_type === "credit_note") return "Credit return";
  if (row.refund_mode === "ledger_credit") return "Credit to balance";
  if (row.refund_mode === "store_credit") return "Store credit";
  if (row.refund_mode === "upi") return "UPI refund";
  if (row.refund_mode === "cash") return "Cash refund";
  return formatReturnType(row.return_type);
}

export default function ReturnsDashboard({ returns, portal = false }: Props) {
  const [viewReturnId, setViewReturnId] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  const stats = useMemo(() => {
    const active = returns.filter((r) => !r.is_cancelled);
    const cancelled = returns.filter((r) => r.is_cancelled);
    const totalValue = active.reduce((s, r) => s + Number(r.total || 0), 0);
    return {
      count: active.length,
      totalValue,
      pending: cancelled.length,
    };
  }, [returns]);

  const pageCount = Math.max(1, Math.ceil(returns.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = returns.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handlePrint = (row: ReturnRow) => {
    const opened = openReturnPrintWindow(row.id, { portal });
    if (!opened) toast.error("Allow pop-ups to print the return receipt");
  };

  if (returns.length === 0) {
    return <Box className="cp-empty">No returns recorded for this party.</Box>;
  }

  return (
    <Box>
      <Box className="cp-returns-kpi">
        <Box className="cp-kpi cp-kpi--neutral">
          <div className="cp-kpi__label">Total Returns</div>
          <div className="cp-kpi__value">{stats.count}</div>
        </Box>
        <Box className="cp-kpi cp-kpi--sales">
          <div className="cp-kpi__label">Return Value</div>
          <div className="cp-kpi__value">{formatCurrency(stats.totalValue)}</div>
        </Box>
        <Box className="cp-kpi cp-kpi--due">
          <div className="cp-kpi__label">Cancelled</div>
          <div className="cp-kpi__value">{stats.pending}</div>
        </Box>
      </Box>

      <Box className="cp-returns-table-wrap">
        <table className="cp-returns-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Return No</th>
              <th>Original Bill</th>
              <th>Type</th>
              <th>Settlement</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.return_date)}</td>
                <td>
                  <Typography component="span" fontWeight={700} fontSize="inherit">
                    {r.return_number}
                  </Typography>
                </td>
                <td>{r.original_bill_number}</td>
                <td style={{ textTransform: "capitalize" }}>{formatReturnType(r.return_type)}</td>
                <td style={{ textTransform: "capitalize" }}>{formatSettlement(r)}</td>
                <td>
                  <Typography component="span" fontWeight={800} color="success.main" fontSize="inherit">
                    −{formatCurrency(r.total)}
                  </Typography>
                </td>
                <td>
                  <span className={r.is_cancelled ? "cp-status cp-status--cancelled" : "cp-status cp-status--active"}>
                    {r.is_cancelled ? "Cancelled" : "Active"}
                  </span>
                </td>
                <td>
                  <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                    <Tooltip title="View">
                      <IconButton size="small" color="primary" onClick={() => setViewReturnId(r.id)} aria-label="view">
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Print">
                      <IconButton
                        size="small"
                        sx={{ color: "#14532d", bgcolor: "#bbf7d0" }}
                        onClick={() => handlePrint(r)}
                        aria-label="print"
                      >
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {!r.is_cancelled && (
                      <ReturnWhatsAppAction returnId={r.id} returnNumber={r.return_number} portal={portal} />
                    )}
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <ListPagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={returns.length}
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
