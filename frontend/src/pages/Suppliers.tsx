import { useQuery } from "@tanstack/react-query";
import { suppliersApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import { PageShell, PageHeader, PageToolbar, AppTable, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency } from "@/utils/format";
import { useState } from "react";

interface Props {
  embedded?: boolean;
}

export default function Suppliers({ embedded }: Props) {
  const [search, setSearch] = useState("");
  const organizationId = useAuthStore((s) => s.organizationId);
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", organizationId],
    queryFn: () => suppliersApi.list().then((r) => r.data.results || r.data),
  });

  const rows = ((data as Record<string, unknown>[]) || []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(r.name || "").toLowerCase().includes(q) || String(r.code || "").toLowerCase().includes(q);
  });

  const columns: TableColumn<Record<string, unknown>>[] = [
    { id: "code", label: "Code" },
    { id: "name", label: "Supplier" },
    { id: "phone", label: "Phone" },
    { id: "pending_payment", label: "Pending", align: "right", render: (r) => formatCurrency(r.pending_payment as number) },
  ];

  const body = (
    <>
      {!embedded && <PageHeader title="Suppliers" subtitle="Purchase & payment tracking" />}
      <PageToolbar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search suppliers…" />
      {isLoading ? <LoadingState /> : <AppTable columns={columns} rows={rows} emptyMessage="No suppliers" />}
    </>
  );

  return embedded ? body : <PageShell>{body}</PageShell>;
}
