import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Box } from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PeopleIcon from "@mui/icons-material/People";
import { dashboardApi } from "@/api/services";
import { PageShell, StatCard, PageHeader, AppTable, ContentCard, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency, formatDate } from "@/utils/format";
import type { DashboardData } from "@/types";

export default function Dashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dashboardApi.get().then((r) => r.data as DashboardData),
    retry: 1,
  });

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState message="Loading dashboard…" minHeight={320} />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell>
        <Alert severity="error" action={<Button onClick={() => refetch()}>Retry</Button>}>
          Dashboard failed to load. Is backend running on port 8000?
        </Alert>
      </PageShell>
    );
  }

  const billColumns: TableColumn<Record<string, unknown>>[] = [
    { id: "bill_number", label: "Bill No" },
    { id: "customer", label: "Customer" },
    { id: "total", label: "Amount", align: "right", render: (r) => formatCurrency(r.total as number) },
    { id: "date", label: "Date", align: "right", render: (r) => formatDate(r.date as string) },
  ];

  return (
    <PageShell>
      <PageHeader title="Dashboard" subtitle="Today's business overview" />
      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
        gap={2}
        sx={{ mb: 3 }}
      >
        <StatCard title="Today's Sale" value={formatCurrency(data.today_sale)} icon={<AttachMoneyIcon />} color="var(--color-success)" />
        <StatCard title="Today's Collection" value={formatCurrency(data.today_collection)} icon={<AccountBalanceWalletIcon />} color="var(--color-primary)" />
        <StatCard title="Pending Dues" value={formatCurrency(data.pending_dues)} icon={<TrendingUpIcon />} color="var(--color-warning)" />
        <StatCard title="Customers" value={data.customer_count} icon={<PeopleIcon />} />
        <StatCard title="Monthly Sales" value={formatCurrency(data.monthly_sales)} icon={<AttachMoneyIcon />} color="var(--color-secondary)" />
      </Box>
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", lg: "1fr 1fr" }} gap={2}>
        <ContentCard title="Recent Bills" noPadding>
          <AppTable columns={billColumns} rows={data.recent_bills as Record<string, unknown>[]} emptyMessage="No bills yet" />
        </ContentCard>
        <ContentCard title="Recent Payments" noPadding>
          <AppTable
            columns={[
              { id: "customer", label: "Customer" },
              { id: "mode", label: "Mode" },
              { id: "amount", label: "Amount", align: "right", render: (r) => formatCurrency(r.amount as number) },
            ]}
            rows={data.recent_payments as Record<string, unknown>[]}
            emptyMessage="No payments yet"
          />
        </ContentCard>
      </Box>
    </PageShell>
  );
}
