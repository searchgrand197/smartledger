import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PercentOutlinedIcon from "@mui/icons-material/PercentOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import { formatCurrency } from "@/utils/format";
import { lineAmountWithDisc } from "@/utils/money";
import { decimalNumberFieldProps, integerNumberFieldProps, parseDecimalInput } from "@/utils/numberField";
import type { BillLineField } from "@/types";
import type { BillLineRow } from "./BillingLineTable";

type Props = {
  lines: BillLineRow[];
  onUpdateLine: (idx: number, field: BillLineField, value: number | string) => void;
  onRemoveLine: (idx: number) => void;
  onFocusRate?: (productId: number) => void;
  productSearch?: string;
  productOptions?: {
    id: number;
    name: string;
    code: string;
    batch?: string;
    category?: string;
    expiry?: string;
    stockText?: string;
    priceText?: string;
    globalRateText?: string;
    partyRateText?: string | null;
  }[];
  onProductSearchChange?: (value: string) => void;
  onSelectProduct?: (productId: number) => void;
  onSelectProductByRate?: (productId: number, mode: "global" | "party") => void;
  productSearchInputRef?: React.Ref<HTMLInputElement>;
  rateChoicesByProduct?: Record<
    number,
    { globalRate: number; partyRate: number | null; lastSaleRate?: number | null; suggestedRate?: number }
  >;
  onApplyRateChoice?: (productId: number, rate: number) => void;
  onRateBlur?: (productId: number, rate: number) => void;
  showSearchRow?: boolean;
  onOpenSearchRow?: () => void;
  onQuickAddProduct?: (name: string) => void;
};

function numDisplay(n: number | undefined) {
  if (n === undefined || n === 0) return "";
  return n;
}

function ratesMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

const EDITABLE_FIELDS = ["qty", "loose", "disc", "rate"] as const;

type NumberFieldProps = ReturnType<typeof integerNumberFieldProps>;

function withDataField(field: string, props: NumberFieldProps): NumberFieldProps {
  const htmlInput = { ...(props.slotProps?.htmlInput as Record<string, string>), "data-field": field };
  return {
    ...props,
    inputProps: { ...props.inputProps, "data-field": field },
    slotProps: { ...props.slotProps, htmlInput },
  };
}

function focusFieldInRow(row: HTMLElement, field: string) {
  const el =
    row.querySelector<HTMLInputElement>(`input[data-field="${field}"]`) ??
    row.querySelector<HTMLInputElement>(`[data-field="${field}"] input`) ??
    row.querySelector<HTMLInputElement>(`td.col-${field} input`);
  if (!el) return false;
  el.focus();
  el.select();
  return true;
}

function focusNextEditableField(row: HTMLElement, current: string) {
  const idx = EDITABLE_FIELDS.indexOf(current as (typeof EDITABLE_FIELDS)[number]);
  if (idx < 0) return false;
  for (let i = idx + 1; i < EDITABLE_FIELDS.length; i++) {
    if (focusFieldInRow(row, EDITABLE_FIELDS[i])) return true;
  }
  return false;
}

function focusNextField(row: HTMLElement, current: string) {
  focusNextEditableField(row, current);
}

function focusPrevField(row: HTMLElement, current: string) {
  const idx = EDITABLE_FIELDS.indexOf(current as (typeof EDITABLE_FIELDS)[number]);
  if (idx <= 0) return false;
  for (let i = idx - 1; i >= 0; i--) {
    if (focusFieldInRow(row, EDITABLE_FIELDS[i])) return true;
  }
  return false;
}

function focusNextRowOrSearch(currentRow: HTMLElement) {
  let next = currentRow.nextElementSibling as HTMLElement | null;
  while (next) {
    if (next.classList.contains("billing-erp-row--search")) {
      const searchInput = next.querySelector<HTMLInputElement>("input");
      searchInput?.focus();
      return true;
    }
    if (focusFieldInRow(next, "qty")) return true;
    next = next.nextElementSibling as HTMLElement | null;
  }
  return false;
}

function handleRowFieldKeyDown(
  e: KeyboardEvent,
  rowRef: React.RefObject<HTMLTableRowElement | null>,
  field: string
) {
  if (!rowRef.current) return;

  if (e.key === "Enter") {
    e.preventDefault();
    focusNextField(rowRef.current, field);
    return;
  }

  if (e.key !== "Tab") return;

  if (e.shiftKey) {
    if (field === "qty") return;
    if (focusPrevField(rowRef.current, field)) {
      e.preventDefault();
    }
    return;
  }

  if (field === "rate") {
    e.preventDefault();
    focusNextRowOrSearch(rowRef.current);
    return;
  }

  if (focusNextEditableField(rowRef.current, field)) {
    e.preventDefault();
  }
}

function ErpProductSearch({
  productSearch,
  productOptions = [],
  onProductSearchChange,
  onSelectProduct,
  onSelectProductByRate,
  productSearchInputRef,
  onQuickAddProduct,
}: Pick<
  Props,
  | "productSearch"
  | "productOptions"
  | "onProductSearchChange"
  | "onSelectProduct"
  | "onSelectProductByRate"
  | "productSearchInputRef"
  | "onQuickAddProduct"
>) {
  if (!onProductSearchChange || !onSelectProduct) return null;

  const tryBarcodeSelect = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const exact = productOptions.find(
      (o) => o.code.toLowerCase() === trimmed.toLowerCase() || String(o.id) === trimmed
    );
    if (exact) onSelectProduct(exact.id);
  };

  const options = [...productOptions];
  if (productSearch && productSearch.trim()) {
    const query = productSearch.trim().toLowerCase();
    const exactMatch = productOptions.some((p) => p.name.toLowerCase() === query);
    if (!exactMatch) {
      options.push({
        id: -9999,
        name: `+ Add "${productSearch.trim()}" as new product`,
        code: "QUICK_ADD",
        priceText: "",
      } as any);
    }
  }

  return (
    <Autocomplete
      size="small"
      fullWidth
      className="billing-erp-search"
      openOnFocus={true}
      options={options}
      getOptionLabel={(option) => option.name}
      inputValue={productSearch ?? ""}
      onInputChange={(_, value, reason) => {
        if (reason === "reset") return;
        onProductSearchChange(value);
      }}
      clearOnBlur={false}
      filterOptions={(opts) => opts}
      onChange={(_, option) => {
        if (option) {
          if (option.id === -9999) {
            onQuickAddProduct?.(productSearch ?? "");
          } else {
            onSelectProduct(option.id);
          }
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const trimmed = (productSearch ?? "").trim();
          const exact = productOptions.find(
            (o) => o.code.toLowerCase() === trimmed.toLowerCase() || String(o.id) === trimmed
          );
          if (exact) {
            onSelectProduct(exact.id);
            return;
          }
          if (options.length > 0) {
            const first = options[0];
            if (first.id === -9999) {
              onQuickAddProduct?.(productSearch ?? "");
            } else {
              onSelectProduct(first.id);
            }
          }
        }
      }}
      onBlur={() => tryBarcodeSelect(productSearch ?? "")}
      slotProps={{
        paper: { sx: { borderRadius: 2, boxShadow: "0 8px 24px rgba(15,36,32,0.12)", mt: 0.5 } },
        listbox: { sx: { maxHeight: 320, py: 0.5 } },
      }}
      renderOption={(props, option) => {
        if (option.id === -9999) {
          return (
            <Box component="li" {...props} key={option.id} sx={{ py: 1.5, px: 2, color: "primary.main" }}>
              <Typography variant="body2" color="primary" fontWeight={700}>
                {option.name}
              </Typography>
            </Box>
          );
        }
        return (
          <Box component="li" {...props} key={option.id}>
            <Box className="billing-erp-option">
              <Box className="billing-erp-option__icon">
                <Inventory2OutlinedIcon fontSize="small" />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Typography className="billing-erp-option__name" noWrap>
                    {option.name}
                  </Typography>
                  {option.priceText && (
                    <Typography className="billing-erp-option__price">{option.priceText}</Typography>
                  )}
                </Box>
                <Typography className="billing-erp-option__meta" noWrap>
                  {option.code}
                  {option.stockText ? ` · ${option.stockText}` : ""}
                </Typography>
                {onSelectProductByRate && (
                  <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      sx={{ textTransform: "none", fontWeight: 700, py: 0.25, minHeight: 24 }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectProductByRate(option.id, "global");
                      }}
                    >
                      Global {option.globalRateText || ""}
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!option.partyRateText}
                      sx={{ textTransform: "none", fontWeight: 700, py: 0.25, minHeight: 24 }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectProductByRate(option.id, "party");
                      }}
                    >
                      Party {option.partyRateText || ""}
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          placeholder="Search Product"
          inputRef={productSearchInputRef}
          size="small"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                <InputAdornment position="start">
                  <Inventory2OutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                </InputAdornment>
                {params.InputProps.startAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

function QtyStepper({
  value,
  onChange,
  onEdited,
  inputProps,
  dataField,
  rowRef,
}: {
  value: number;
  onChange: (v: number) => void;
  onEdited?: () => void;
  inputProps: Record<string, unknown>;
  dataField: string;
  rowRef: React.RefObject<HTMLTableRowElement | null>;
}) {
  const [edited, setEdited] = useState(false);
  const step = 1;

  const bump = (delta: number) => {
    const next = Math.max(0, value + delta);
    onChange(next);
    setEdited(true);
    onEdited?.();
  };

  return (
    <Box className={`billing-erp-qty-stepper ${edited ? "billing-erp-input--edited" : ""}`}>
      <IconButton
        className="billing-erp-qty-stepper__btn"
        size="small"
        onClick={() => bump(-step)}
        tabIndex={-1}
        aria-label="Decrease quantity"
      >
        <RemoveIcon sx={{ fontSize: 14 }} />
      </IconButton>
      <TextField
        size="small"
        variant="outlined"
        type="number"
        className="billing-erp-qty-stepper__input billing-erp-input billing-erp-input--center"
        value={numDisplay(value)}
        onChange={(e) => {
          onChange(parseDecimalInput(e.target.value));
          setEdited(true);
        }}
        {...withDataField(dataField, inputProps as NumberFieldProps)}
        onKeyDown={(e) => handleRowFieldKeyDown(e, rowRef, dataField)}
      />
      <IconButton
        className="billing-erp-qty-stepper__btn"
        size="small"
        onClick={() => bump(step)}
        tabIndex={-1}
        aria-label="Increase quantity"
      >
        <AddIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}

function ErpLineRow({
  line,
  onUpdateLine,
  onRemoveLine,
  onFocusRate,
  rateChoicesByProduct,
  onApplyRateChoice,
  onRateBlur,
}: {
  line: BillLineRow;
  onUpdateLine: Props["onUpdateLine"];
  onRemoveLine: Props["onRemoveLine"];
  onFocusRate?: Props["onFocusRate"];
  rateChoicesByProduct?: Props["rateChoicesByProduct"];
  onApplyRateChoice?: Props["onApplyRateChoice"];
  onRateBlur?: Props["onRateBlur"];
}) {
  const amount = lineAmountWithDisc(line);
  const choices = rateChoicesByProduct?.[line.product];
  const [rateMenuAnchor, setRateMenuAnchor] = useState<null | HTMLElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);

  const rateChanged =
    choices &&
    !ratesMatch(Number(line.rate), choices.globalRate) &&
    (choices.partyRate == null || !ratesMatch(Number(line.rate), choices.partyRate));

  const profit = line.quantity * (line.rate - (line.purchase_rate || 0));
  const marginPct = line.rate > 0 ? ((line.rate - (line.purchase_rate || 0)) / line.rate) * 100 : 0;

  const rateTooltip = choices
    ? [
        `Global: ${formatCurrency(choices.globalRate)}`,
        choices.partyRate != null ? `Party: ${formatCurrency(choices.partyRate)}` : null,
        choices.lastSaleRate != null ? `Last sale: ${formatCurrency(choices.lastSaleRate)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <tr ref={rowRef}>
      <td className="col-index">{line._idx + 1}</td>
      <td className="col-product">
        <Tooltip
          title={[line.product_name, line.product_code].filter(Boolean).join(" · ")}
          placement="top-start"
        >
          <Typography className="billing-erp-product-name">
            {line.product_name}
            {line.product_code && (
              <span className="billing-erp-product-code-inline">{line.product_code}</span>
            )}
          </Typography>
        </Tooltip>
      </td>
      <td className="col-pack">
        <span className="billing-erp-cell">
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          value={line.pack || "Pc"}
          className="billing-erp-input billing-erp-input--left"
          InputProps={{ readOnly: true }}
          inputProps={{ tabIndex: -1, style: { textAlign: "center", fontWeight: 800, fontSize: "0.7rem" } }}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "#f3f4f6",
              borderColor: "#e5e7eb",
              borderRadius: "6px",
            },
          }}
        />
        </span>
      </td>
      <td className="col-mrp col-num">
        <span className="billing-erp-cell">
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          type="number"
          value={numDisplay(line.mrp)}
          className="billing-erp-input"
          InputProps={{ readOnly: true }}
          inputProps={{ tabIndex: -1, style: { textAlign: "right" } }}
        />
        </span>
      </td>
      <td className="col-qty col-num">
        <QtyStepper
          value={Number(line.quantity)}
          onChange={(v) => onUpdateLine(line._idx, "quantity", v)}
          dataField="qty"
          rowRef={rowRef}
          inputProps={integerNumberFieldProps(0)}
        />
      </td>
      <td className="col-loose col-num billing-erp-loose-cell">
        <span className="billing-erp-cell">
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          type="number"
          value={numDisplay(line.loose_qty)}
          onChange={(e) => onUpdateLine(line._idx, "loose_qty", parseDecimalInput(e.target.value))}
          className="billing-erp-input"
          {...withDataField("loose", integerNumberFieldProps(0))}
          onKeyDown={(e) => handleRowFieldKeyDown(e, rowRef, "loose")}
        />
        </span>
      </td>
      <td className="col-disc col-num">
        <span className="billing-erp-cell">
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          type="number"
          placeholder="0"
          value={numDisplay(line.disc_percent)}
          onChange={(e) => onUpdateLine(line._idx, "disc_percent", parseDecimalInput(e.target.value))}
          className="billing-erp-input"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <PercentOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
          {...withDataField("disc", integerNumberFieldProps(0, 100))}
          onKeyDown={(e) => handleRowFieldKeyDown(e, rowRef, "disc")}
        />
        </span>
      </td>
      <td className="col-rate col-num">
        <Tooltip title={rateTooltip || "Rate"} placement="top">
          <span className="billing-erp-cell">
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            type="number"
            value={numDisplay(line.rate)}
            onChange={(e) => onUpdateLine(line._idx, "rate", parseDecimalInput(e.target.value))}
            onFocus={() => onFocusRate?.(line.product)}
            onBlur={(e) => onRateBlur?.(line.product, parseDecimalInput(e.target.value))}
            className={`billing-erp-input billing-erp-input--rate ${rateChanged ? "billing-erp-input--rate-changed" : ""}`}
            InputProps={{
              startAdornment: choices ? (
                <InputAdornment position="start" className="billing-erp-rate-adornment">
                  <IconButton
                    size="small"
                    tabIndex={-1}
                    onClick={(e) => setRateMenuAnchor(e.currentTarget)}
                    aria-label="Rate options"
                    edge="start"
                  >
                    <ArrowDropDownIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
            {...withDataField("rate", decimalNumberFieldProps() as NumberFieldProps)}
            onKeyDown={(e) => handleRowFieldKeyDown(e, rowRef, "rate")}
          />
          </span>
        </Tooltip>
        {choices && (
          <Menu
            anchorEl={rateMenuAnchor}
            open={Boolean(rateMenuAnchor)}
            onClose={() => setRateMenuAnchor(null)}
          >
            <MenuItem
              onClick={() => {
                onApplyRateChoice?.(line.product, choices.globalRate);
                setRateMenuAnchor(null);
              }}
            >
              Global · {formatCurrency(choices.globalRate)}
            </MenuItem>
            {choices.partyRate != null && (
              <MenuItem
                onClick={() => {
                  onApplyRateChoice?.(line.product, choices.partyRate!);
                  setRateMenuAnchor(null);
                }}
              >
                Party · {formatCurrency(choices.partyRate)}
              </MenuItem>
            )}
            {choices.lastSaleRate != null && (
              <MenuItem
                onClick={() => {
                  onApplyRateChoice?.(line.product, choices.lastSaleRate!);
                  setRateMenuAnchor(null);
                }}
              >
                Last sale · {formatCurrency(choices.lastSaleRate)}
              </MenuItem>
            )}
          </Menu>
        )}
      </td>
      <td className="col-amount billing-erp-amount-cell">
        <Tooltip
          title={
            line.purchase_rate
              ? `Margin ${marginPct.toFixed(1)}% · Profit ${formatCurrency(profit)}`
              : formatCurrency(amount)
          }
          placement="top"
        >
          <span className="billing-erp-cell">
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              value={formatCurrency(amount)}
              className="billing-erp-input"
              InputProps={{
                readOnly: true,
                startAdornment: line.purchase_rate ? (
                  <InputAdornment position="start" sx={{ mr: 0.5, display: "flex", alignItems: "center" }}>
                    <span
                      className={`billing-erp-profit-dot ${profit >= 0 ? "billing-erp-profit-dot--pos" : "billing-erp-profit-dot--neg"}`}
                      style={{ margin: 0 }}
                    />
                  </InputAdornment>
                ) : undefined,
              }}
              inputProps={{
                tabIndex: -1,
                style: {
                  textAlign: "right",
                  fontWeight: 900,
                  color: "var(--color-primary-dark)",
                },
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#ffffff",
                }
              }}
            />
          </span>
        </Tooltip>
      </td>
      <td className="col-action">
        <IconButton
          size="small"
          color="error"
          tabIndex={-1}
          onClick={() => onRemoveLine(line._idx)}
          aria-label="Remove line"
          sx={{ width: 28, height: 28 }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </td>
    </tr>
  );
}

export default function BillingErpDesktopTable(props: Props) {
  const {
    lines,
    onUpdateLine,
    onRemoveLine,
    onFocusRate,
    productSearch = "",
    productOptions = [],
    onProductSearchChange,
    onSelectProduct,
    onSelectProductByRate,
    productSearchInputRef,
    rateChoicesByProduct,
    onApplyRateChoice,
    onRateBlur,
    showSearchRow = true,
    onOpenSearchRow,
    onQuickAddProduct,
  } = props;

  const canSearch = Boolean(onProductSearchChange && onSelectProduct);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el || lines.length === 0) return;
    window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [lines.length]);

  return (
    <Box className="billing-erp-card">
      <Box className="billing-erp-table-wrap" ref={tableWrapRef}>
        <table className="billing-erp-table">
          <colgroup>
            <col className="col-index" style={{ width: 36 }} />
            <col className="col-product" />
            <col className="col-pack" style={{ width: 58 }} />
            <col className="col-mrp" style={{ width: 70 }} />
            <col className="col-qty" style={{ width: 104 }} />
            <col className="col-loose" style={{ width: 62 }} />
            <col className="col-disc" style={{ width: 72 }} />
            <col className="col-rate" style={{ width: 86 }} />
            <col className="col-amount" style={{ width: 100 }} />
            <col className="col-action" style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="col-index">#</th>
              <th className="col-product">Product</th>
              <th className="col-pack">Pack</th>
              <th className="col-mrp col-num">MRP</th>
              <th className="col-qty col-num">Qty</th>
              <th className="col-loose col-num">Loose</th>
              <th className="col-disc col-num">Disc</th>
              <th className="col-rate col-num">Rate</th>
              <th className="col-amount">Amount</th>
              <th className="col-action" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && !canSearch && (
              <tr>
                <td colSpan={10}>
                  <Box className="billing-erp-empty">Add items to start billing</Box>
                </td>
              </tr>
            )}
            {lines.map((line) => (
              <ErpLineRow
                key={line._idx}
                line={line}
                onUpdateLine={onUpdateLine}
                onRemoveLine={onRemoveLine}
                onFocusRate={onFocusRate}
                rateChoicesByProduct={rateChoicesByProduct}
                onApplyRateChoice={onApplyRateChoice}
                onRateBlur={onRateBlur}
              />
            ))}
            {canSearch && showSearchRow && (
              <tr className="billing-erp-row--search">
                <td className="col-index">{lines.length + 1}</td>
                <td colSpan={9} className="col-product">
                  <ErpProductSearch
                    productSearch={productSearch}
                    productOptions={productOptions}
                    onProductSearchChange={onProductSearchChange}
                    onSelectProduct={onSelectProduct}
                    onSelectProductByRate={onSelectProductByRate}
                    productSearchInputRef={productSearchInputRef}
                    onQuickAddProduct={onQuickAddProduct}
                  />
                </td>
              </tr>
            )}
            {lines.length === 0 && canSearch && showSearchRow && (
              <tr>
                <td colSpan={10}>
                  <Box className="billing-erp-empty">
                    Search above — Enter to add · Tab: Qty → Loose → Disc → Rate
                  </Box>
                </td>
              </tr>
            )}
            {lines.length > 0 && canSearch && !showSearchRow && (
              <tr>
                <td colSpan={10}>
                  <Box className="billing-erp-empty">
                    Click Add row or press Ctrl+Enter to add another product
                  </Box>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>
      {canSearch && onOpenSearchRow && (
        <Box className="billing-erp-add-row">
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={onOpenSearchRow}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}
          >
            Add row
          </Button>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Ctrl+Enter · Tab: Qty → Loose → Disc → Rate
          </Typography>
        </Box>
      )}
    </Box>
  );
}
