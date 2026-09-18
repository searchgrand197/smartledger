import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Stack, Box, IconButton, CircularProgress } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import toast from "react-hot-toast";
import { portalApi } from "@/api/portal";
import { PageShell, PageHeader, PageToolbar, AppTable, AppDialog, LoadingState } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency } from "@/utils/format";

interface CustomerRow {
  id: number;
  code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  current_due: number;
  area?: string;
  opening_balance?: number;
  credit_limit?: number;
}

export default function CustomerParties() {
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
  });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-portal-customers", search],
    queryFn: () => portalApi.customers({ search }).then((r) => r.data as CustomerRow[]),
  });

  const resetForm = () => ({
    shop_name: "",
    owner_name: "",
    phone: "",
    area: "",
    opening_balance: "" as string | number,
    credit_limit: "" as string | number,
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => portalApi.createCustomer(payload),
    onSuccess: () => {
      toast.success("Customer saved");
      qc.invalidateQueries({ queryKey: ["customer-portal-customers"] });
      setForm(resetForm());
      setOpen(false);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: Record<string, unknown> }; message?: string };
      const data = ax.response?.data;
      let msg = "Could not save customer";
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

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof form }) =>
      portalApi.updateCustomer(id, payload),
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["customer-portal-customers"] });
      qc.invalidateQueries({ queryKey: ["customer-portal-profile", editingId] });
      setForm(resetForm());
      setEditingId(null);
      setOpen(false);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: Record<string, unknown> }; message?: string };
      const data = ax.response?.data;
      let msg = "Could not update customer";
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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => portalApi.deleteCustomer(id),
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["customer-portal-customers"] });
    },
    onError: () => {
      toast.error("Could not delete customer");
    },
  });

  const handleSave = () => {
    if (!form.shop_name.trim() || !form.owner_name.trim() || !form.phone.trim()) {
      toast.error("Name, Owner and Phone are required");
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

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const columns: TableColumn<CustomerRow>[] = [
    { id: "code", label: "Code" },
    { id: "shop_name", label: "Customer Name" },
    { id: "owner_name", label: "Owner" },
    { id: "phone", label: "Phone" },
    {
      id: "current_due",
      label: "Pending Payment / Credit",
      align: "right",
      render: (r) => {
        const hasDue = Number(r.current_due) > 0;
        return (
          <Box
            component="span"
            sx={{
              color: hasDue ? "var(--color-warning)" : "var(--color-success)",
              fontWeight: 700,
            }}
          >
            {formatCurrency(r.current_due || 0)}
          </Box>
        );
      },
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
            title="Edit Customer"
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(r.id);
              setForm({
                shop_name: r.shop_name,
                owner_name: r.owner_name,
                phone: r.phone,
                area: r.area || "",
                opening_balance: r.opening_balance == null ? "" : String(r.opening_balance),
                credit_limit: r.credit_limit == null ? "" : String(r.credit_limit),
              });
              setOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            title="Delete Customer"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r.id, r.shop_name);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="primary"
            title="Ledger & details"
            onClick={(e) => {
              e.stopPropagation();
               navigate(`/customer/customers/${r.id}`);
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader title="Retail Customers" subtitle="Manage walk-in / regular customers, pending credit & payment history" />
      <PageToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code, phone…"
        action={{
          label: "Add Customer",
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
        <AppTable
          columns={columns}
          rows={data || []}
          pageSize={10}
          getRowKey={(r) => r.id}
          emptyMessage="No customers found — add your first retail customer"
          onRowClick={(r) => navigate(`/customer/customers/${r.id}`)}
        />
      )}
      <AppDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
          setForm(resetForm());
        }}
        title={editingId != null ? "Edit Customer" : "Add Customer"}
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
              : "Save Customer"}
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
          <TextField
            label="Customer Name / Shop Name"
            fullWidth
            required
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
          />
          <TextField
            label="Owner Name"
            fullWidth
            required
            value={form.owner_name}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
          />
          <TextField
            label="Phone"
            fullWidth
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            label="Area"
            fullWidth
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
          />
          <TextField
            type="number"
            label="Opening Balance"
            fullWidth
            value={form.opening_balance}
            onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
          />
          <TextField
            type="number"
            label="Credit Limit"
            fullWidth
            value={form.credit_limit}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
          />
        </Stack>
      </AppDialog>
    </PageShell>
  );
}
