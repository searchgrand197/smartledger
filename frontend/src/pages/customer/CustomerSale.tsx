import { Box, Button, Stack } from "@mui/material";
import { PageShell, PageHeader, StatCard, AppTable, ContentCard, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency, formatDate } from "@/utils/format";
import { billDue } from "@/utils/money";
import { usePortalDashboard } from "@/hooks/usePortalDashboard";
import { useCustomerPortalStore } from "@/store/customerPortalStore";

export default function CustomerSale() {
  const customer = useCustomerPortalStore((s) => s.customer);
  const { data, isLoading, error, refetch } = usePortalDashboard();

  const billCols: TableColumn<Record<string, unknown>>[] = [
    { id: "bill_number", label: "Bill No" },
    { id: "created_at", label: "Date", render: (r) => formatDate(r.created_at as string) },
    { id: "total", label: "Total (incl.)", align: "right", render: (r) => formatCurrency(r.total as number) },
    {
      id: "due",
      label: "Due on bill",
      align: "right",
      render: (r) => formatCurrency(billDue(Number(r.total), Number(r.paid_amount))),
    },
  ];

  const paymentCols: TableColumn<Record<string, unknown>>[] = [
    { id: "created_at", label: "Date", render: (r) => formatDate(r.created_at as string) },
    { id: "mode", label: "Mode" },
    { id: "amount", label: "Amount", align: "right", render: (r) => formatCurrency(r.amount as number) },
  ];

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState message="Loading your sales…" />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <Box textAlign="center" py={4}>
          <Button variant="contained" className="gradient-button" onClick={() => refetch()}>
            Retry
          </Button>
        </Box>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Sale"
        subtitle={`Your bills & payments · ${customer?.shop_name}`}
      />
      <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap={2} sx={{ mb: 3 }}>
        <StatCard title="Outstanding" value={formatCurrency(data.current_due)} color="var(--color-warning)" />
        <StatCard title="Total purchases" value={formatCurrency(data.total_sales)} color="var(--color-primary)" />
        <StatCard title="Credit available" value={formatCurrency(data.credit_available)} color="var(--color-success)" />
      </Box>
      <Stack spacing={2}>
        <ContentCard title="My bills" subtitle="All purchases from shop (view only)" noPadding>
          <AppTable columns={billCols} rows={(data.bills as Record<string, unknown>[]) || []} emptyMessage="No bills yet" />
        </ContentCard>
        <ContentCard title="My payments" noPadding>
          <AppTable columns={paymentCols} rows={(data.payments as Record<string, unknown>[]) || []} emptyMessage="No payments" />
        </ContentCard>
      </Stack>
    </PageShell>
  );
}
