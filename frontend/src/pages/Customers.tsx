import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Stack, Box, IconButton, CircularProgress, Checkbox, FormControlLabel } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PaymentsIcon from "@mui/icons-material/Payments";
import EditIcon from "@mui/icons-material/Edit";
import toast from "react-hot-toast";
import { customersApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import { PageShell, PageHeader, PageToolbar, AppTable, AppDialog, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency } from "@/utils/format";
import type { Customer } from "@/types";

interface Props {
  embedded?: boolean;
  type?: "wholesale" | "retail";
}

export default function Customers({ embedded, type }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    shop_name: "",
    owner_name: "",
    phone: "",
    area: "",
    opening_balance: "" as string | number,
    credit_limit: "" as string | number,
    is_wholesale: type !== "retail",
  });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", organizationId, search, type],
    queryFn: () =>
      customersApi
        .list({ search, is_wholesale: type === "retail" ? "false" : "true" })
        .then((r) => r.data.results || r.data),
  });

  const resetForm = () => ({
    shop_name: "",
    owner_name: "",
    phone: "",
    area: "",
    opening_balance: "" as string | number,
    credit_limit: "" as string | number,
    is_wholesale: type !== "retail",
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => customersApi.create(payload),
    onSuccess: () => {
      toast.success("Party saved");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setForm(resetForm());
      setOpen(false);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: Record<string, unknown> }; message?: string };
      const data = ax.response?.data;
      let msg = "Could not save party";
      if (data) {
        if (typeof data.detail === "string") msg = data.detail;
        else {
          const first = Object.values(data).flat()[0];
          if (first) msg = String(first);
        }
      } else if (ax.message?.includes("Network")) {
        msg = "Cannot reach server — start backend on port 8000";
      }
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof form }) =>
      customersApi.update(id, payload),
    onSuccess: () => {
      toast.success("Party updated");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-profile", editingId] });
      setForm(resetForm());
      setEditingId(null);
      setOpen(false);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: Record<string, unknown> }; message?: string };
      const data = ax.response?.data;
      let msg = "Could not update party";
      if (data) {
        if (typeof data.detail === "string") msg = data.detail;
        else {
          const first = Object.values(data).flat()[0];
          if (first) msg = String(first);
        }
      }
      toast.error(msg);
    },
  });

  const handleSave = () => {
    if (!form.shop_name.trim() || !form.owner_name.trim() || !form.phone.trim()) {
      toast.error("Shop name, owner name and phone are required");
      return;
    }
    const cleanPhone = form.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    const payload = {
      ...form,
      phone: cleanPhone,
      opening_balance: form.opening_balance === "" ? 0 : Number(form.opening_balance) || 0,
      credit_limit: form.credit_limit === "" ? 0 : Number(form.credit_limit) || 0,
    };
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const rows = ((data as Customer[]) || []).filter((c) => c.code !== "CUS-WALK");

  const columns: TableColumn<Customer>[] = [
    { id: "code", label: "Code" },
    { id: "shop_name", label: "Shop Name" },
    { id: "owner_name", label: "Owner" },
    { id: "phone", label: "Phone" },
    {
      id: "current_due",
      label: "Due",
      align: "right",
      render: (r) => (
        <Box component="span" sx={{ color: "var(--color-warning)", fontWeight: 700 }}>
          {formatCurrency(r.current_due || 0)}
        </Box>
      ),
    },
    {
      id: "actions",
      label: "",
      align: "right",
      render: (r) => (
        <Stack direction="row" spacing={0.25} justifyContent="flex-end">
          <IconButton
            size="small"
            color="warning"
            title="Edit Party"
            onClick={() => {
              setEditingId(r.id);
              setForm({
                shop_name: r.shop_name,
                owner_name: r.owner_name,
                phone: r.phone,
                area: r.area || "",
                opening_balance: r.opening_balance == null ? "" : String(r.opening_balance),
                credit_limit: r.credit_limit == null ? "" : String(r.credit_limit),
                is_wholesale: r.is_wholesale ?? true,
              });
              setOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="success"
            title="Receive payment"
            onClick={() => navigate(`/wholesale/parties/customers/${r.id}#receive-payment`)}
          >
            <PaymentsIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="primary"
            title="Ledger & details"
            onClick={() => navigate(`/wholesale/parties/customers/${r.id}`)}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const body = (
    <>
      {!embedded && (
        <PageHeader title="Parties" subtitle="Parties with ledger, credit & billing history" />
      )}
      <PageToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code, phone…"
        action={{
          label: "Add Party",
          onClick: () => {
            setEditingId(null);
            setForm(resetForm());
            setOpen(true);
          },
          icon: <AddIcon />,
        }}
      />
      {isLoading ? (
        <LoadingState />
      ) : (
        <AppTable columns={columns} rows={rows} getRowKey={(r) => r.id} emptyMessage="No parties — add your first party" />
      )}
      <AppDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
          setForm(resetForm());
        }}
        title={editingId != null ? "Edit Party" : "Add Party"}
        actions={
          <Button
            type="button"
            variant="contained"
            className="gradient-button"
            disabled={createMutation.isPending || updateMutation.isPending}
            onClick={handleSave}
            startIcon={
              createMutation.isPending || updateMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Saving…"
              : editingId != null
              ? "Save Changes"
              : "Save Party"}
          </Button>
        }
      >
        <Stack
          component="form"
          spacing={2}
          sx={{ pt: 1 }}
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <TextField label="Shop Name" fullWidth required value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} />
          <TextField label="Owner Name" fullWidth required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          <TextField label="Phone" fullWidth required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="Area" fullWidth value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.is_wholesale}
                onChange={(e) => setForm({ ...form, is_wholesale: e.target.checked })}
              />
            }
            label="Wholesale Party"
          />
          <TextField
            type="number"
            label="Opening Balance"
            fullWidth
            value={form.opening_balance}
            onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
          />
        </Stack>
      </AppDialog>
    </>
  );

  return embedded ? body : <PageShell>{body}</PageShell>;
}
