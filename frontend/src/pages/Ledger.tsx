import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, TextField, MenuItem, Stack, Typography } from "@mui/material";
import { customersApi, ledgerApi } from "@/api/services";
import { PageShell, PageHeader, AppTable, ContentCard, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency, formatDate } from "@/utils/format";
import type { Customer } from "@/types";

export default function Ledger() {
  const [customerId, setCustomerId] = useState("");
  const [period, setPeriod] = useState("all");

  const { data: customers } = useQuery({
    queryKey: ["customers-ledger"],
    queryFn: () => customersApi.list({ is_wholesale: "true" }).then((r) => r.data.results || r.data),
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ["ledger", customerId, period],
    queryFn: () => ledgerApi.get(Number(customerId), { period }).then((r) => r.data),
    enabled: !!customerId,
  });

  const columns: TableColumn<Record<string, unknown>>[] = [
    { id: "date", label: "Date", render: (r) => formatDate(r.date as string) },
    { id: "description", label: "Description" },
    { id: "bill_number", label: "Bill No" },
    { id: "debit", label: "Debit", align: "right", render: (r) => formatCurrency(r.debit as number) },
    { id: "credit", label: "Credit", align: "right", render: (r) => formatCurrency(r.credit as number) },
    { id: "balance", label: "Balance", align: "right", render: (r) => formatCurrency(r.balance as number) },
  ];

  return (
    <PageShell>
      <PageHeader title="Ledger" subtitle="Party account statement" />
      <ContentCard>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Typography py={0.5} variant="caption" sx={{ display: "none" }} />
          <TextField
            select
            label="Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            sx={{ minWidth: { sm: 240 }, flex: 1 }}
          >
            <MenuItem value="">Select customer</MenuItem>
            {(customers as Customer[] || []).map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.shop_name} ({c.code})
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} sx={{ width: { sm: 160 } }}>
            <MenuItem value="all">All time</MenuItem>
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="month">This month</MenuItem>
          </TextField>
        </Stack>
      </ContentCard>
      <Box mt={2}>
        {!customerId ? (
          <ContentCard>
            <Typography py={4} textAlign="center" color="text.secondary" display="block">
              Select a customer to view ledger
            </Typography>
          </ContentCard>
        ) : isLoading ? (
          <ContentCard>
            <LoadingState message="Loading ledger…" minHeight={120} />
          </ContentCard>
        ) : (
          <ContentCard title="Ledger entries" noPadding>
            <AppTable columns={columns} rows={(ledger?.entries as Record<string, unknown>[]) || []} emptyMessage="No entries" />
          </ContentCard>
        )}
      </Box>
    </PageShell>
  );
}
