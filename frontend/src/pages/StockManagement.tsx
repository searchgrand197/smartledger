import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import TuneIcon from "@mui/icons-material/Tune";
import toast from "react-hot-toast";
import { productsApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import BillViewDialog from "@/components/billing/BillViewDialog";
import ReturnViewDialog from "@/components/returns/ReturnViewDialog";
import { AppDialog, AppTable, LoadingState, PageHeader, PageShell } from "@/components/ui";
import type { TableColumn } from "@/components/ui/AppTable";
import { formatDateTime } from "@/utils/format";
import type { Product, StockMovement, StockMovementType } from "@/types";
import { fetchAllPages } from "@/api/pagination";

const MOVEMENT_FILTERS: { value: "" | StockMovementType; label: string }[] = [
  { value: "", label: "All" },
  { value: "opening", label: "Opening" },
  { value: "sale", label: "Sales" },
  { value: "purchase", label: "Purchases" },
  { value: "return", label: "Returns" },
  { value: "cancel", label: "Cancelled" },
  { value: "adjustment", label: "Adjustments" },
];

function bumpAdjustDelta(current: string, step: number): string {
  return String((Number(current) || 0) + step);
}

function movementChipColor(type: StockMovementType): "error" | "success" | "warning" | "info" | "default" {
  if (type === "sale" || type === "return_cancel") return "error";
  if (type === "opening" || type === "purchase" || type === "return" || type === "cancel") return "success";
  if (type === "adjustment") return "info";
  return "default";
}

export default function StockManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const productIdParam = searchParams.get("product");
  const selectedProductId = productIdParam ? Number(productIdParam) : null;

  const [itemSearch, setItemSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState<"" | StockMovementType>("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [viewBillId, setViewBillId] = useState<number | null>(null);
  const [viewReturnId, setViewReturnId] = useState<number | null>(null);

  const qc = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["products", organizationId, "stock-mgmt"],
    queryFn: () => productsApi.listAll(),
  });

  const productList = (products as Product[]) || [];
  const selectedProduct = productList.find((p) => p.id === selectedProductId) ?? null;

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return productList;
    return productList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q)
    );
  }, [productList, itemSearch]);

  const movementParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (selectedProductId) params.product_id = String(selectedProductId);
    if (movementFilter) params.movement_type = movementFilter;
    return params;
  }, [selectedProductId, movementFilter]);

  const { data: movementData, isLoading: movementsLoading } = useQuery({
    queryKey: ["stock-movements", organizationId, movementParams],
    queryFn: () => fetchAllPages<StockMovement>("/products/stock-movements/", movementParams),
    enabled: !!selectedProductId,
  });

  const movements = movementData || [];

  const selectProduct = (product: Product) => {
    setSearchParams({ product: String(product.id) });
    setMovementFilter("");
  };

  const handleAdjust = async () => {
    if (!selectedProduct) return;
    const delta = Number(adjustDelta);
    if (!delta || Number.isNaN(delta)) {
      toast.error("Enter a valid quantity change");
      return;
    }
    setAdjusting(true);
    try {
      await productsApi.stockAdjust(selectedProduct.id, {
        quantity_delta: Math.trunc(delta),
        notes: adjustNotes.trim() || undefined,
      });
      toast.success("Stock updated");
      setAdjustOpen(false);
      setAdjustDelta("");
      setAdjustNotes("");
      await qc.invalidateQueries({ queryKey: ["stock-movements"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || "Could not adjust stock");
    } finally {
      setAdjusting(false);
    }
  };

  const openReference = (movement: StockMovement) => {
    if (!movement.reference_id || !movement.reference_type) return;
    if (movement.reference_type === "bill") setViewBillId(movement.reference_id);
    if (movement.reference_type === "return") setViewReturnId(movement.reference_id);
  };

  const columns: TableColumn<StockMovement>[] = [
    {
      id: "created_at",
      label: "When",
      minWidth: 140,
      render: (m) => (
        <Box>
          <Typography fontWeight={700} fontSize="0.85rem">
            {formatDateTime(m.created_at)}
          </Typography>
          {m.created_by_name && (
            <Typography variant="caption" color="text.secondary">
              {m.created_by_name}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: "movement_type",
      label: "Type",
      render: (m) => (
        <Chip size="small" label={m.movement_label} color={movementChipColor(m.movement_type)} sx={{ fontWeight: 700 }} />
      ),
    },
    {
      id: "quantity_delta",
      label: "Change",
      align: "right",
      render: (m) => (
        <Typography fontWeight={800} color={m.quantity_delta < 0 ? "error.main" : "success.main"}>
          {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta} {m.product_unit}
        </Typography>
      ),
    },
    {
      id: "quantity_after",
      label: "Balance",
      align: "right",
      render: (m) => (
        <Typography fontWeight={700}>
          {m.quantity_after} {m.product_unit}
        </Typography>
      ),
    },
    {
      id: "reference",
      label: "Reference",
      render: (m) => (
        <Box>
          {m.reference_type && m.reference_label ? (
            <Button
              size="small"
              variant="text"
              sx={{ fontWeight: 700, textTransform: "none", p: 0, minWidth: 0, display: "block" }}
              onClick={(e) => {
                e.stopPropagation();
                openReference(m);
              }}
            >
              {m.reference_label}
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary" fontWeight={m.movement_type === "opening" ? 600 : 400}>
              {m.reference_label || m.notes || "—"}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: "party_name",
      label: "Billed to",
      minWidth: 130,
      render: (m) =>
        m.party_name ? (
          <Typography variant="body2" fontWeight={700} noWrap title={m.party_name}>
            {m.party_name}
          </Typography>
        ) : (
          <Typography color="text.secondary">—</Typography>
        ),
    },
  ];

  return (
    <PageShell className="stock-mgmt-page">
      <PageHeader
        title="Stock Management"
        subtitle="Select an item to view its stock timeline"
        size="section"
      />

      <Box className="stock-mgmt-layout">
        <Paper className="stock-mgmt-items" elevation={0}>
          <Box className="stock-mgmt-items-header">
            <Typography variant="subtitle2" fontWeight={800}>
              Items ({filteredItems.length})
            </Typography>
            <TextField
              size="small"
              fullWidth
              hiddenLabel
              placeholder="Search items…"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="app-outlined-field stock-mgmt-search"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {productsLoading ? (
            <LoadingState message="Loading items…" minHeight={100} />
          ) : (
            <List dense disablePadding className="stock-mgmt-items-list">
              {filteredItems.map((p) => {
                const selected = p.id === selectedProductId;
                return (
                  <ListItemButton
                    key={p.id}
                    selected={selected}
                    onClick={() => selectProduct(p)}
                    className={selected ? "stock-mgmt-item--selected" : undefined}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={0.75} useFlexGap>
                          <Typography fontWeight={700} fontSize="0.875rem" noWrap>
                            {p.name}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary" component="span">
                          {p.code} ·{" "}
                          <Typography
                            component="span"
                            variant="caption"
                            fontWeight={700}
                            color="text.primary"
                          >
                            {p.current_stock} {p.unit}
                          </Typography>
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
              {filteredItems.length === 0 && (
                <Typography color="text.secondary" textAlign="center" py={4} px={2}>
                  No items match your search
                </Typography>
              )}
            </List>
          )}
        </Paper>

        <Box className="stock-mgmt-detail">
          {!selectedProduct ? (
            <Paper className="stock-mgmt-empty" elevation={0}>
              <Typography color="text.secondary" fontWeight={600}>
                Select an item from the list to view its stock timeline
              </Typography>
            </Paper>
          ) : (
            <Paper className="stock-mgmt-detail-card" elevation={0}>
              <Box className="stock-mgmt-detail-header">
                <Box minWidth={0}>
                  <Typography variant="subtitle1" fontWeight={800} noWrap title={selectedProduct.name}>
                    {selectedProduct.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {selectedProduct.code}
                    {selectedProduct.brand ? ` · ${selectedProduct.brand}` : ""}
                  </Typography>
                </Box>
                <ToggleButtonGroup
                  value={movementFilter}
                  exclusive
                  onChange={(_, value: "" | StockMovementType | null) => setMovementFilter(value ?? "")}
                  size="small"
                  className="stock-mgmt-filters"
                >
                  {MOVEMENT_FILTERS.map((f) => (
                    <ToggleButton key={f.value || "all"} value={f.value} className="stock-mgmt-filter-chip">
                      {f.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>

              <Box className="stock-mgmt-timeline">
                {movementsLoading ? (
                  <LoadingState message="Loading timeline…" minHeight={120} />
                ) : (
                  <AppTable
                    columns={columns}
                    rows={movements}
                    pageSize={12}
                    getRowKey={(r) => r.id}
                    emptyMessage="No stock movements for this item yet"
                  />
                )}
              </Box>

              <Box className="stock-mgmt-footer">
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800} letterSpacing={0.5}>
                    TOTAL STOCK
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
                    <Typography
                      variant="h5"
                      fontWeight={800}
                      lineHeight={1.2}
                      color="primary.dark"
                    >
                      {selectedProduct.current_stock} {selectedProduct.unit}
                    </Typography>
                  </Stack>
                </Box>
                <Button
                  variant="contained"
                  className="gradient-button"
                  startIcon={<TuneIcon />}
                  onClick={() => setAdjustOpen(true)}
                  sx={{ fontWeight: 800, flexShrink: 0 }}
                >
                  Adjust stock
                </Button>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>

      <AppDialog
        open={adjustOpen}
        onClose={() => !adjusting && setAdjustOpen(false)}
        title={selectedProduct ? `Adjust — ${selectedProduct.name}` : "Adjust stock"}
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setAdjustOpen(false)} disabled={adjusting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              className="gradient-button"
              onClick={() => void handleAdjust()}
              disabled={adjusting || !adjustDelta}
              sx={{ fontWeight: 800 }}
            >
              {adjusting ? "Saving…" : "Apply"}
            </Button>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {selectedProduct && (
            <Typography variant="body2" color="text.secondary">
              Current stock:{" "}
              <strong>
                {selectedProduct.current_stock} {selectedProduct.unit}
              </strong>
            </Typography>
          )}
          <TextField
            type="number"
            label="Quantity change"
            className="app-outlined-field"
            fullWidth
            size="small"
            value={adjustDelta}
            onChange={(e) => setAdjustDelta(e.target.value)}
            helperText="Negative to reduce, positive to add"
            inputProps={{ step: 1 }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" onClick={() => setAdjustDelta((v) => bumpAdjustDelta(v, -5))}>
              −5
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RemoveIcon />}
              onClick={() => setAdjustDelta((v) => bumpAdjustDelta(v, -1))}
            >
              −1
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAdjustDelta((v) => bumpAdjustDelta(v, 1))}
            >
              +1
            </Button>
            <Button size="small" variant="outlined" onClick={() => setAdjustDelta((v) => bumpAdjustDelta(v, 5))}>
              +5
            </Button>
          </Stack>
          <TextField
            label="Reason (optional)"
            className="app-outlined-field"
            fullWidth
            size="small"
            multiline
            minRows={2}
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            placeholder="e.g. Damaged goods, physical count"
          />
        </Stack>
      </AppDialog>

      <BillViewDialog billId={viewBillId} open={viewBillId != null} onClose={() => setViewBillId(null)} />
      <ReturnViewDialog returnId={viewReturnId} open={viewReturnId != null} onClose={() => setViewReturnId(null)} />
    </PageShell>
  );
}
