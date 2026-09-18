import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TextField,
  Button,
  Stack,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Divider,
  Typography,
} from "@mui/material";
import toast from "react-hot-toast";
import { productsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { AppDialog } from "@/components/ui";

const STOCK_UNITS = ["Pc", "Kg", "g", "Feet", "Inch", "Meter", "Box", "Bag", "Ltr", "Set", "Dozen"];

type FormState = {
  name: string;
  categoryName: string;
  sale_price: number;
  retail_price: number;
  retailSameAsWholesale: boolean;
  current_stock: number;
  unit: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  portal?: boolean;
  onSuccess: (product: { id: number; name: string; code: string; sale_price: number; retail_price: number; unit: string; current_stock: number }) => void;
}

export default function QuickAddProductDialog({
  open,
  onClose,
  initialName = "",
  portal = false,
  onSuccess,
}: Props) {
  const [form, setForm] = useState<FormState>({
    name: "",
    categoryName: "",
    sale_price: 0,
    retail_price: 0,
    retailSameAsWholesale: true,
    current_stock: 0,
    unit: "Pc",
  });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm({
        name: initialName,
        categoryName: "",
        sale_price: 0,
        retail_price: 0,
        retailSameAsWholesale: true,
        current_stock: 0,
        unit: "Pc",
      });
    }
  }, [open, initialName]);

  const { data: categoryRows } = useQuery({
    queryKey: ["product-categories", portal ? "portal" : "wholesale"],
    queryFn: () => {
      const apiCall = portal ? portalApi.categories() : productsApi.categories();
      return apiCall.then((r) => r.data.results || r.data);
    },
    enabled: open,
  });
  const categories = (categoryRows as { id: number; name: string }[]) || [];

  const resolveCategoryId = async (name: string): Promise<number | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    
    const { data } = portal
      ? await portalApi.createCategory(trimmed)
      : await productsApi.createCategory(trimmed);
    return (data as { id: number }).id;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);
    try {
      const categoryId = await resolveCategoryId(form.categoryName);
      const wholesale = Number(form.sale_price) || 0;
      const retail = form.retailSameAsWholesale ? wholesale : (Number(form.retail_price) || 0);

      const payload = new FormData();
      payload.append("name", form.name.trim());
      payload.append("brand", "");
      payload.append("current_stock", String(form.current_stock));
      payload.append("minimum_stock", String(Math.max(1, Math.round(form.current_stock * 0.2))));
      payload.append("sale_price", String(wholesale));
      payload.append("purchase_price", String(wholesale));
      payload.append("retail_price", String(retail));
      payload.append("unit", form.unit);
      payload.append("pieces_per_pack", "1");
      payload.append("packs_per_box", "1");
      payload.append("length_per_piece_m", "0");
      payload.append("allow_length_sale", "false");
      if (categoryId) {
        payload.append("category", String(categoryId));
      }

      const { data: newProd } = portal
        ? await portalApi.createProduct(payload)
        : await productsApi.create(payload);

      toast.success(`Product "${form.name.trim()}" added successfully!`);
      
      // Invalidate queries so that standard product autocomplete/lists get the new product
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["products-billing"] });
      await qc.invalidateQueries({ queryKey: ["customer-portal-products"] });

      // Call onSuccess to automatically select this new product
      onSuccess({
        id: newProd.id,
        name: newProd.name,
        code: newProd.code,
        sale_price: Number(newProd.sale_price) || wholesale,
        retail_price: Number(newProd.retail_price) || retail,
        unit: newProd.unit || form.unit,
        current_stock: Number(newProd.current_stock) || form.current_stock,
      });
      onClose();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      let msg = "Could not save item";
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

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Quick Add Product"
      maxWidth="sm"
      actions={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            className="gradient-button"
            onClick={() => void handleSave()}
            disabled={saving}
            sx={{ fontWeight: 800 }}
          >
            {saving ? "Saving…" : "Save & Add to Bill"}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5} sx={{ pt: 0.5 }}>
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
          inputProps={{ list: "quick-add-category-suggestions" }}
        />
        <datalist id="quick-add-category-suggestions">
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>

        <Divider />
        <Typography variant="overline" color="text.secondary" fontWeight={800}>
          Pricing & Stock
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
            disabled={form.retailSameAsWholesale}
            value={form.retailSameAsWholesale ? form.sale_price || "" : form.retail_price || ""}
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : Number(e.target.value);
              setForm({
                ...form,
                retail_price: val,
                retailSameAsWholesale: false,
              });
            }}
            helperText={form.retailSameAsWholesale ? "Uses wholesale price" : "Optional"}
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

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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
            {STOCK_UNITS.map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            type="number"
            label="OPENING STOCK"
            className="app-outlined-field"
            variant="outlined"
            size="small"
            fullWidth
            value={form.current_stock === 0 ? "" : form.current_stock}
            onChange={(e) => setForm({ ...form, current_stock: e.target.value === "" ? 0 : Number(e.target.value) })}
            inputProps={{ min: 0 }}
          />
        </Stack>
      </Stack>
    </AppDialog>
  );
}
