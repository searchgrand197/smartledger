import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { PageShell, PageHeader, StatCard, ContentCard, LoadingState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { downloadPdfResponse } from "@/utils/pdf";
import { portalApi } from "@/api/portal";
import { usePortalDashboard } from "@/hooks/usePortalDashboard";
import { useCustomerPortalStore } from "@/store/customerPortalStore";
import LedgerStatement, { type LedgerEntry, type LedgerSummary } from "@/components/ledger/LedgerStatement";

/** Customer menu — same role as wholesale "Parties", but only your own account. */
export default function CustomerAccount() {
  const customer = useCustomerPortalStore((s) => s.customer);
  const { data, isLoading, error, refetch } = usePortalDashboard();

  const downloadLedger = async () => {
    const res = await portalApi.ledgerPdf();
    await downloadPdfResponse(res, `ledger_${customer?.code || "customer"}.pdf`);
  };

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState message="Loading account…" />
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

  const c = data.customer || customer;
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
        title="Customer"
        subtitle={`${c?.shop_name} · ${c?.code} · ${c?.phone}`}
        action={{ label: "Ledger PDF", onClick: downloadLedger, icon: <DownloadIcon /> }}
      />
      <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap={2} sx={{ mb: 3 }}>
        <StatCard title="Closing balance (Due)" value={formatCurrency(data.current_due)} color="var(--color-warning)" />
        <StatCard title="Credit limit" value={formatCurrency(c?.credit_limit || 0)} />
        <StatCard title="Last purchase" value={formatDate(data.last_purchase_date)} />
      </Box>

      <Box sx={{ mb: 3 }}>
        <LedgerStatement
          party={{
            name: c?.shop_name || "",
            code: c?.code,
            owner: c?.owner_name,
            phone: c?.phone,
            address: c?.address,
          }}
          summary={summary}
          entries={ledger}
          compact
          portal
        />
      </Box>

      <ContentCard title="Your item rates (history)" subtitle="Prices you were charged on past bills">
        <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(220px, 1fr))" gap={2}>
          {data.previous_item_rates?.map(
            (item: { product_name: string; rates: { rate: number; date: string }[] }, i: number) => (
              <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography fontWeight={600}>{item.product_name}</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                  {item.rates.map((r, j) => (
                    <Chip key={j} size="small" label={`${formatCurrency(r.rate)} · ${formatDate(r.date)}`} />
                  ))}
                </Stack>
              </Paper>
            )
          )}
        </Box>
      </ContentCard>
    </PageShell>
  );
}
