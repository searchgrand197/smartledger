import { useQuery } from "@tanstack/react-query";
import { Box, Button, Stack } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { portalApi } from "@/api/portal";
import { PageShell, PageHeader, StatCard, AppTable, ContentCard, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency, formatDate } from "@/utils/format";
import { billDue } from "@/utils/money";
import { downloadPdfResponse } from "@/utils/pdf";
import { useCustomerPortalStore } from "@/store/customerPortalStore";
import LedgerStatement, { type LedgerEntry, type LedgerSummary } from "@/components/ledger/LedgerStatement";

export default function CustomerDashboard() {
  const customer = useCustomerPortalStore((s) => s.customer);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customer-portal-dashboard"],
    queryFn: () => portalApi.dashboard().then((r) => r.data),
  });

  const downloadLedger = async () => {
    const res = await portalApi.ledgerPdf();
    await downloadPdfResponse(res, `ledger_${customer?.code || "customer"}.pdf`);
  };

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState message="Loading your account…" />
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

  const billCols: TableColumn<Record<string, unknown>>[] = [
    { id: "bill_number", label: "Bill No" },
    { id: "created_at", label: "Date", render: (r) => formatDate(r.created_at as string) },
    { id: "total", label: "Total (incl.)", align: "right", render: (r) => formatCurrency(r.total as number) },
    {
      id: "due",
      label: "On this bill",
      align: "right",
      render: (r) => formatCurrency(billDue(Number(r.total), Number(r.paid_amount))),
    },
  ];

  const paymentCols: TableColumn<Record<string, unknown>>[] = [
    { id: "created_at", label: "Date", render: (r) => formatDate(r.created_at as string) },
    { id: "mode", label: "Mode" },
    { id: "amount", label: "Amount", align: "right", render: (r) => formatCurrency(r.amount as number) },
  ];

  const ledger = (data.ledger as LedgerEntry[]) || [];
  const summary = (data.ledger_summary as LedgerSummary) || {
    opening_balance: 0,
    total_debit: 0,
    total_credit: 0,
    closing_balance: data.current_due,
  };

  return (
    <PageShell>
      <PageHeader
        title="My Billing History"
        subtitle={`${data.customer?.shop_name || customer?.shop_name} · ${customer?.code}`}
        action={{ label: "Ledger PDF", onClick: downloadLedger, icon: <DownloadIcon /> }}
      />
      <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap={2} sx={{ mb: 3 }}>
        <StatCard title="Account balance (Due)" value={formatCurrency(data.current_due)} color="var(--color-warning)" />
        <StatCard title="Credit available" value={formatCurrency(data.credit_available)} color="var(--color-success)" />
        <StatCard title="Total purchases" value={formatCurrency(data.total_sales)} color="var(--color-primary)" />
      </Box>

      <Box sx={{ mb: 3 }}>
        <LedgerStatement
          party={{
            name: data.customer?.shop_name || customer?.shop_name || "",
            code: customer?.code,
            phone: customer?.phone,
          }}
          summary={summary}
          entries={ledger}
          compact
          portal
        />
      </Box>

      <Stack spacing={2}>
        <ContentCard title="My bills" subtitle="Per-bill due is not the same as account balance" noPadding>
          <AppTable columns={billCols} rows={(data.bills as Record<string, unknown>[]) || []} emptyMessage="No bills yet" />
        </ContentCard>
        <ContentCard title="My payments" noPadding>
          <AppTable columns={paymentCols} rows={(data.payments as Record<string, unknown>[]) || []} emptyMessage="No payments" />
        </ContentCard>
      </Stack>
    </PageShell>
  );
}
