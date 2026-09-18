import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TextField,
  Button,
  Stack,
  Box,
  MenuItem,
  IconButton,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CategoryIcon from "@mui/icons-material/Category";
import toast from "react-hot-toast";
import { productsApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import { PageShell, PageHeader, StatCard, AppTable, AppDialog, LoadingState, SearchField } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatCurrency } from "@/utils/format";
import { mediaUrl } from "@/utils/media";
import type { Product } from "@/types";

const STOCK_UNITS = ["Pc", "Kg", "g", "Feet", "Inch", "Meter", "Box", "Bag", "Ltr", "Set", "Dozen"];

type ItemForm = {
  name: string;
  categoryName: string;
  companyName: string;
  sale_price: number;
  retail_price: number;
  retailSameAsWholesale: boolean;
  current_stock: number;
  minimum_stock: number;
  unit: string;
  expiry: string;
};

const emptyForm = (): ItemForm => ({
  name: "",
  categoryName: "",
  companyName: "",
  sale_price: 0,
  retail_price: 0,
  retailSameAsWholesale: false,
  current_stock: 0,
  minimum_stock: 0,
  unit: "Pc",
  expiry: "",
});

interface Props {
  title?: string;
  subtitle?: string;
}

export default function Products({
  title = "Products",
  subtitle = "Add and manage items with name, category, and pricing.",
}: Props) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const organizationId = useAuthStore((s) => s.organizationId);

  const { data, isLoading } = useQuery({
    queryKey: ["products", organizationId, search],
    queryFn: () => productsApi.listAll({ search }),
  });

  const { data: categoryRows } = useQuery({
    queryKey: ["product-categories", organizationId],
    queryFn: () => productsApi.categories().then((r) => r.data.results || r.data),
    enabled: formOpen,
  });
  const categories = (categoryRows as { id: number; name: string }[]) || [];

  const allProducts = (data as Product[]) || [];

  const filteredProducts = allProducts;

  const stats = useMemo(() => {
    return {
      total: allProducts.length,
    };
  }, [allProducts]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    const wholesale = Number(p.sale_price);
    const retail = p.retail_price && p.retail_price > 0 ? Number(p.retail_price) : 0;
    const sameAsWholesale = retail > 0 && retail === wholesale;
    setForm({
      name: p.name,
      categoryName: p.category_name || "",
      companyName: p.brand || "",
      sale_price: wholesale,
      retail_price: sameAsWholesale ? 0 : retail,
      retailSameAsWholesale: sameAsWholesale,
      current_stock: p.current_stock,
      minimum_stock: p.minimum_stock,
      unit: p.unit || "Pc",
      expiry: p.expiry || "",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const resolveCategoryId = async (): Promise<number | null> => {
    const name = form.categoryName.trim();
    if (!name) return null;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const { data } = await productsApi.createCategory(name);
    return (data as { id: number }).id;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const savedName = form.name.trim();
    setSaving(true);
    const payload = new FormData();
    payload.append("name", form.name.trim());
    payload.append("brand", form.companyName.trim());
    payload.append("current_stock", String(form.current_stock));
    payload.append("minimum_stock", String(form.minimum_stock));
    payload.append("sale_price", String(form.sale_price));
    const retailToSave = form.retailSameAsWholesale
      ? form.sale_price
      : form.retail_price > 0
        ? form.retail_price
        : 0;
    payload.append("retail_price", String(retailToSave));
    payload.append("unit", form.unit);
    payload.append("purchase_price", String(form.sale_price));
    payload.append("pieces_per_pack", "1");
    payload.append("packs_per_box", "1");
    payload.append("length_per_piece_m", "0");
    payload.append("allow_length_sale", "false");
    payload.append("expiry", form.expiry || "");
    try {
      const categoryId = await resolveCategoryId();
      if (categoryId) payload.append("category", String(categoryId));
      if (editing) {
        await productsApi.update(editing.id, payload);
        toast.success("Item updated");
      } else {
        await productsApi.create(payload);
        toast.success(`"${savedName}" saved`);
        setSearch(savedName);
      }
      closeForm();
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      let msg = editing ? "Could not update item" : "Could not save item";
      if (typeof data === "string") msg = data;
      else if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        if (typeof d.detail === "string") msg = d.detail;
        else {
          const first = Object.values(d).flat().find((v) => typeof v === "string");
          if (typeof first === "string") msg = first;
        }
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete product "${name}"?`);
    if (!confirmDelete) return;
    try {
      await productsApi.delete(id);
      toast.success("Product deleted successfully");
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      toast.error("Could not delete product");
    }
  };

  const ProductThumb = ({ product }: { product: Product }) => {
    const src = mediaUrl(product.image);
    if (src) {
      return (
        <Box
          component="img"
          src={src}
          alt=""
          className="inventory-item-thumb"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      );
    }
    return (
      <Box className="inventory-item-thumb inventory-item-thumb--placeholder">
        {product.name.slice(0, 2).toUpperCase()}
      </Box>
    );
  };

  const columns: TableColumn<Product>[] = [
    {
      id: "name",
      label: "Item",
      minWidth: 220,
      render: (p) => (
        <Box display="flex" alignItems="center" gap={1.25} minWidth={0}>
          <ProductThumb product={p} />
          <Box minWidth={0}>
            <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
              <Typography component="span" fontWeight={700} fontSize="0.9rem" noWrap title={p.name}>
                {p.name}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {p.code}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: "sale_price",
      label: "Wholesale",
      align: "right",
      render: (p) => (
        <Typography fontWeight={600} fontSize="0.875rem">
          {formatCurrency(p.sale_price)}
        </Typography>
      ),
    },
    {
      id: "retail_price",
      label: "Retail",
      align: "right",
      render: (p) => (
        <Typography fontWeight={600} fontSize="0.875rem" color="primary.dark">
          {p.retail_price && p.retail_price > 0 ? formatCurrency(p.retail_price) : "—"}
        </Typography>
      ),
    },
    { id: "unit", label: "Unit", align: "center" },
    {
      id: "packing",
      label: "Pack/Box",
      align: "center",
      render: (p) => (
        <Typography variant="body2" fontWeight={600}>
          {p.pieces_per_pack || 1} / {p.packs_per_box || 1}
        </Typography>
      ),
    },
    {
      id: "actions",
      label: "",
      align: "center",
      render: (p) => (
        <Stack direction="row" spacing={0.25} justifyContent="center">
          <IconButton
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(p);
            }}
            aria-label={`Edit ${p.name}`}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              void handleDeleteProduct(p.id, p.name);
            }}
            aria-label={`Delete ${p.name}`}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  const formFields = (
    <Stack spacing={2.5} sx={{ pt: 0.5 }}>
      <Typography variant="overline" color="text.secondary" fontWeight={800}>
        Product details
      </Typography>
      <TextField
        label="PRODUCT NAME"
        className="app-outlined-field"
        variant="outlined"
        size="small"
        fullWidth
        required
        autoFocus
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <TextField
        label="CATEGORY"
        className="app-outlined-field"
        variant="outlined"
        size="small"
        fullWidth
        value={form.categoryName}
        onChange={(e) => setForm({ ...form, categoryName: e.target.value })}
        placeholder="Optional — e.g. Plumbing, Electrical"
        inputProps={{ list: "product-category-suggestions" }}
      />
      <datalist id="product-category-suggestions">
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <TextField
        label="COMPANY NAME"
        className="app-outlined-field"
        variant="outlined"
        size="small"
        fullWidth
        value={form.companyName}
        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
        placeholder="Optional — brand / manufacturer"
      />

      <Divider />
      <Typography variant="overline" color="text.secondary" fontWeight={800}>
        Pricing
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          type="number"
          label="WHOLESALE PRICE"
          className="app-outlined-field"
          variant="outlined"
          size="small"
          fullWidth
          value={form.sale_price === 0 ? "" : form.sale_price}
          onChange={(e) => setForm({ ...form, sale_price: e.target.value === "" ? 0 : Number(e.target.value) })}
          inputProps={{ min: 0, step: "0.01" }}
        />
        <TextField
          type="number"
          label="RETAIL PRICE"
          className="app-outlined-field"
          variant="outlined"
          size="small"
          fullWidth
          value={
            form.retailSameAsWholesale
              ? form.sale_price === 0
                ? ""
                : form.sale_price
              : form.retail_price === 0
                ? ""
                : form.retail_price
          }
          onChange={(e) => {
            const val = e.target.value === "" ? 0 : Number(e.target.value);
            setForm({
              ...form,
              retail_price: val,
              retailSameAsWholesale: false,
            });
          }}
          helperText={form.retailSameAsWholesale ? "Uses wholesale price" : "Optional — leave blank if not set"}
          inputProps={{ min: 0, step: "0.01" }}
        />
      </Stack>
      <FormControlLabel
        control={
          <Checkbox
            checked={form.retailSameAsWholesale}
            onChange={(e) =>
              setForm({
                ...form,
                retailSameAsWholesale: e.target.checked,
                retail_price: e.target.checked ? 0 : form.retail_price,
              })
            }
          />
        }
        label="Same as wholesale price"
      />

      <Divider />
      <TextField
        select
        label="UNIT"
        className="app-outlined-field"
        variant="outlined"
        size="small"
        fullWidth
        value={form.unit}
        onChange={(e) => setForm({ ...form, unit: e.target.value })}
      >
        {[...new Set([...STOCK_UNITS, form.unit].filter(Boolean))].map((u) => (
          <MenuItem key={u} value={u}>
            {u}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        type="date"
        label="EXPIRY DATE (OPTIONAL)"
        className="app-outlined-field"
        variant="outlined"
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
        value={form.expiry}
        onChange={(e) => setForm({ ...form, expiry: e.target.value })}
      />
    </Stack>
  );

  return (
    <PageShell>
      <PageHeader title={title} subtitle={subtitle} />

      <Box className="inventory-stats">
        <StatCard title="Total products" value={stats.total} icon={<CategoryIcon />} />
      </Box>

      <Box className="inventory-top-bar">
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ md: "center" }}
          justifyContent="space-between"
        >
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Item name or code…"
            fullWidth
            noMargin
          />
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              className="gradient-button"
              startIcon={<AddIcon />}
              onClick={openAdd}
              sx={{ fontWeight: 800, whiteSpace: "nowrap" }}
            >
              Add Item
            </Button>
          </Stack>
        </Stack>
      </Box>

      {isLoading ? (
        <LoadingState message="Loading inventory…" />
      ) : (
        <AppTable
          columns={columns}
          rows={filteredProducts}
          pageSize={10}
          getRowKey={(r) => r.id}
          emptyMessage={
            search
              ? "No items match your search"
              : "No items yet — tap Add Item"
          }
          onRowClick={openEdit}
        />
      )}

      <AppDialog
        open={formOpen}
        onClose={closeForm}
        title={editing ? `Edit — ${editing.code}` : "Add inventory item"}
        maxWidth="sm"
        actions={
          <>
            <Button onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="contained"
              className="gradient-button"
              onClick={() => void handleSave()}
              disabled={saving}
              sx={{ fontWeight: 800 }}
            >
              {saving ? "Saving…" : editing ? "Update" : "Save item"}
            </Button>
          </>
        }
      >
        {formFields}
      </AppDialog>
    </PageShell>
  );
}
