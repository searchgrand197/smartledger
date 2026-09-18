import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import { paymentsApi } from "@/api/services";
import { PageShell, PageHeader, AppTable, ContentCard, LoadingState } from "@/components/ui";
import PaymentViewDialog from "@/components/payments/PaymentViewDialog";
import PaymentEditDialog from "@/components/payments/PaymentEditDialog";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency, formatDate } from "@/utils/format";

export default function Payments() {
  const [viewPaymentId, setViewPaymentId] = useState<number | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);

  const { data: dues } = useQuery({ queryKey: ["dues"], queryFn: () => paymentsApi.dues().then((r) => r.data) });
  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.list().then((r) => r.data),
  });

  const dueColumns: TableColumn<Record<string, unknown>>[] = [
    { id: "shop_name", label: "Customer" },
    { id: "phone", label: "Phone" },
    { id: "due_amount", label: "Due", align: "right", render: (r) => formatCurrency(r.due_amount as number) },
  ];

  const paymentColumns: TableColumn<Record<string, unknown>>[] = [
    { id: "created_at", label: "Date", render: (r) => formatDate(r.created_at as string) },
    { id: "customer_name", label: "Customer" },
    { id: "mode", label: "Mode" },
    { id: "amount", label: "Amount", align: "right", render: (r) => formatCurrency(r.amount as number) },
    {
      id: "actions",
      label: "Actions",
      align: "right",
      render: (r) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <Tooltip title="View Receipt">
            <IconButton size="small" color="primary" onClick={() => setViewPaymentId(r.id as number)}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Payment">
            <IconButton size="small" color="info" onClick={() => setEditPaymentId(r.id as number)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader title="Payments" subtitle="Collections & outstanding dues" />
      <Box mb={2}>
        <ContentCard title="Payment due" subtitle="Customers with balance" noPadding>
          <AppTable columns={dueColumns} rows={(dues as Record<string, unknown>[]) || []} emptyMessage="No outstanding dues" />
        </ContentCard>
      </Box>
      <ContentCard title="Payment history" noPadding>
        {isLoading ? (
          <LoadingState message="Loading payment history…" minHeight={120} />
        ) : (
          <AppTable
            columns={paymentColumns}
            rows={(payments as Record<string, unknown>[])?.slice(0, 100) || []}
            emptyMessage="No payments recorded"
          />
        )}
      </ContentCard>

      <PaymentViewDialog
        paymentId={viewPaymentId}
        open={viewPaymentId != null}
        onClose={() => setViewPaymentId(null)}
        onUpdated={refetch}
      />
      <PaymentEditDialog
        paymentId={editPaymentId}
        open={editPaymentId != null}
        onClose={() => setEditPaymentId(null)}
        onUpdated={refetch}
      />
    </PageShell>
  );
}
