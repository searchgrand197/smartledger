import { useQuery } from "@tanstack/react-query";
import { Box } from "@mui/material";
import { reportsApi } from "@/api/services";
import { PageShell, PageHeader, AppTable, StatCard, ContentCard } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency } from "@/utils/format";

export default function Reports() {
  const { data: daily } = useQuery({ queryKey: ["r-daily"], queryFn: () => reportsApi.dailySales().then((r) => r.data) });
  const { data: profit } = useQuery({ queryKey: ["r-profit"], queryFn: () => reportsApi.profit().then((r) => r.data) });
  const { data: dues } = useQuery({ queryKey: ["r-dues"], queryFn: () => reportsApi.customerDues().then((r) => r.data) });

  const dueCols: TableColumn<Record<string, unknown>>[] = [
    { id: "shop_name", label: "Customer" },
    { id: "due_amount", label: "Due", align: "right", render: (r) => formatCurrency(r.due_amount as number) },
  ];

  return (
    <PageShell>
      <PageHeader title="Reports" subtitle="Sales, profit & dues summary" />
      <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={2} sx={{ mb: 3 }}>
        <StatCard title="Today Sales" value={formatCurrency(daily?.total_sales)} />
        <StatCard title="Today Profit" value={formatCurrency(daily?.total_profit)} />
        <StatCard title="Total Profit" value={formatCurrency(profit?.total_profit)} />
      </Box>
      <ContentCard title="Customer dues" noPadding>
        <AppTable columns={dueCols} rows={(dues as Record<string, unknown>[]) || []} emptyMessage="No dues" />
      </ContentCard>
    </PageShell>
  );
}
