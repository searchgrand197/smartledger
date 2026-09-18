import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptIcon from "@mui/icons-material/Receipt";
import toast from "react-hot-toast";

import { billingApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import BillCancelAction from "@/components/billing/BillCancelAction";
import BillViewDialog from "@/components/billing/BillViewDialog";
import { PageShell, PageHeader, StatCard, AppTable, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency, formatDate } from "@/utils/format";
import { openInvoicePrintWindow } from "@/utils/print";
import type { Bill } from "@/types";

export default function BillingHistory() {
  const navigate = useNavigate();
  const organizationId = useAuthStore((s) => s.organizationId);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [billType, setBillType] = useState<"all" | "party" | "simple">("all");
  const [viewBillId, setViewBillId] = useState<number | null>(null);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (billType !== "all") params.bill_type = billType;
    return params;
  }, [search, dateFrom, dateTo, billType]);

  const { data: billsData, isLoading, refetch } = useQuery({
    queryKey: ["wholesale-billing-history", organizationId, queryParams],
    queryFn: () => billingApi.listAll(queryParams),
  });

  const bills = (billsData as Bill[]) || [];

  // Calculate statistics from the filtered set of bills
  const stats = useMemo(() => {
    let sales = 0;
    let paid = 0;
    let due = 0;
    let activeCount = 0;

    bills.forEach((b) => {
      if (!b.is_cancelled) {
        const totalVal = Number(b.total) || 0;
        const paidVal = Number(b.paid_amount) || 0;
        const dueVal = Number(b.due_amount) || (totalVal - paidVal);

        sales += totalVal;
        paid += paidVal;
        due += dueVal;
        activeCount += 1;
      }
    });

    return {
      totalBills: activeCount,
      totalSales: sales,
      totalPaid: paid,
      totalDue: due,
    };
  }, [bills]);

  const handlePrint = (billId: number) => {
    const opened = openInvoicePrintWindow(billId, { portal: false });
    if (!opened) toast.error("Allow pop-ups to print the bill");
  };

  const handleClearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setBillType("all");
  };

  const columns: TableColumn<Bill>[] = [
    {
      id: "created_at",
      label: "Date",
      render: (row) => formatDate(row.created_at),
    },
    {
      id: "bill_number",
      label: "Bill #",
      render: (row) => (
        <Typography fontWeight={700} color="primary.main">
          {row.bill_number}
        </Typography>
      ),
    },
    {
      id: "customer_name",
      label: "Party / Customer",
      render: (row) => (
        <Typography fontWeight={600}>
          {row.customer_name || (row.bill_type === "simple" ? "Walk-in Customer" : "—")}
        </Typography>
      ),
    },
    {
      id: "bill_type",
      label: "Type",
      render: (row) => (
        <Chip
          size="small"
          label={row.bill_type === "party" ? "Wholesale (Party)" : "Retail (Simple)"}
          color={row.bill_type === "party" ? "primary" : "secondary"}
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      id: "total",
      label: "Total Amount",
      align: "right",
      render: (row) => formatCurrency(row.total),
    },
    {
      id: "paid_amount",
      label: "Paid Amount",
      align: "right",
      render: (row) => formatCurrency(row.paid_amount),
    },
    {
      id: "due_amount",
      label: "Due Amount",
      align: "right",
      render: (row) => {
        const dueVal = Number(row.due_amount) || (Number(row.total) - Number(row.paid_amount));
        return (
          <Typography
            fontWeight={700}
            color={dueVal > 0.01 ? "warning.main" : "success.main"}
          >
            {formatCurrency(dueVal)}
          </Typography>
        );
      },
    },
    {
      id: "payment_mode",
      label: "Mode",
      render: (row) => (
        <Typography sx={{ textTransform: "uppercase", fontSize: "0.85rem", fontWeight: 600 }}>
          {row.payment_mode}
        </Typography>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="nowrap" sx={{ minWidth: 168 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              color="primary"
              onClick={() => setViewBillId(row.id)}
              aria-label="view"
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print Invoice">
            <IconButton
              size="small"
              sx={{ color: "#14532d", bgcolor: "#bbf7d0", "&:hover": { bgcolor: "#86efac" } }}
              onClick={() => handlePrint(row.id)}
              aria-label="print"
            >
              <PrintIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!row.is_cancelled && (
            <Tooltip title="Edit Bill">
              <IconButton
                size="small"
                color="info"
                onClick={() => navigate(`/wholesale/sale?edit=${row.id}`)}
                aria-label="edit"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {!row.is_cancelled && (
            <BillCancelAction
              billId={row.id}
              billNumber={row.bill_number}
              onCancelled={refetch}
            />
          )}
        </Stack>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader title="Sale History" subtitle="View and manage all wholesale and walk-in sales bills" />

      {/* Statistics Cards */}
      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fill, minmax(220px, 1fr))"
        gap={2}
        sx={{ mb: 3 }}
      >
        <StatCard
          title="Total Bills"
          value={stats.totalBills}
          icon={<ReceiptIcon />}
          color="var(--color-primary)"
        />
        <StatCard
          title="Total Sales"
          value={formatCurrency(stats.totalSales)}
          icon={<AttachMoneyIcon />}
          color="var(--color-success)"
        />
        <StatCard
          title="Total Received"
          value={formatCurrency(stats.totalPaid)}
          icon={<AccountBalanceWalletIcon />}
          color="var(--color-secondary)"
        />
        <StatCard
          title="Outstanding Dues"
          value={formatCurrency(stats.totalDue)}
          icon={<TrendingUpIcon />}
          color="var(--color-warning)"
        />
      </Box>

      {/* Filter Toolbar */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <TextField
          size="small"
          placeholder="Search by Bill # or Party Name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260, flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          label="From date"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          sx={{ width: { xs: "100%", sm: "auto" } }}
        />

        <TextField
          label="To date"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          sx={{ width: { xs: "100%", sm: "auto" } }}
        />

        <TextField
          select
          label="Bill Type"
          size="small"
          value={billType}
          onChange={(e) => setBillType(e.target.value as any)}
          sx={{ minWidth: 160, width: { xs: "100%", sm: "auto" } }}
        >
          <MenuItem value="all">All Bills</MenuItem>
          <MenuItem value="party">Wholesale (Party)</MenuItem>
          <MenuItem value="simple">Retail (Simple)</MenuItem>
        </TextField>

        <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" }, justifyContent: "flex-end" }}>
          {(search || dateFrom || dateTo || billType !== "all") && (
            <Button variant="outlined" onClick={handleClearFilters}>
              Clear
            </Button>
          )}
          <IconButton onClick={() => refetch()} aria-label="refresh">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      {/* Bills List Table */}
      {isLoading ? (
        <LoadingState minHeight={200} />
      ) : (
        <AppTable
          columns={columns}
          rows={bills}
          pageSize={12}
          getRowKey={(r) => r.id}
          emptyMessage="No billing records found"
        />
      )}

      {/* Bill View Modal */}
      <BillViewDialog
        billId={viewBillId}
        open={viewBillId != null}
        onClose={() => setViewBillId(null)}
      />
    </PageShell>
  );
}
