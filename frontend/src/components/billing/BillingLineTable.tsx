import {
  Autocomplete,
  Button,
  Box,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import BillingErpDesktopTable from "./BillingErpDesktopTable";
import { formatCurrency } from "@/utils/format";
import { lineAmountWithDisc } from "@/utils/money";
import { decimalNumberFieldProps, integerNumberFieldProps, parseDecimalInput } from "@/utils/numberField";
import type { BillLine, BillLineField } from "@/types";

export type BillingLineTableHandle = {
  openSearchRow: () => void;
};

export interface BillLineRow extends BillLine {
  _idx: number;
}

interface Props {
  lines: BillLineRow[];
  onUpdateLine: (idx: number, field: BillLineField, value: number | string) => void;
  onRemoveLine: (idx: number) => void;
  onFocusRate?: (productId: number) => void;
  placeholderRows?: number;
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
}

const touchFieldSx = {
  "& .MuiInputBase-root": { fontSize: "1rem" },
  "& .MuiInputBase-input": { py: 1, px: 1 },
};

type RateChoices = NonNullable<Props["rateChoicesByProduct"]>[number];

function ratesMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

function PartyRateChips({
  productId,
  currentRate,
  choices,
  onApplyRateChoice,
}: {
  productId: number;
  currentRate: number;
  choices?: RateChoices;
  onApplyRateChoice?: Props["onApplyRateChoice"];
}) {
  if (!choices || !onApplyRateChoice) return null;

  const chips: { key: string; label: string; rate: number; tone: "global" | "party" | "last" }[] = [
    { key: "global", label: "Global", rate: choices.globalRate, tone: "global" },
  ];

  if (choices.partyRate != null) {
    chips.push({ key: "party", label: "Party", rate: choices.partyRate, tone: "party" });
  }
  if (
    choices.lastSaleRate != null &&
    (choices.partyRate == null || !ratesMatch(choices.lastSaleRate, choices.partyRate))
  ) {
    chips.push({ key: "last", label: "Last sale", rate: choices.lastSaleRate, tone: "last" });
  }

  return (
    <Box className="billing-mobile-rate-chips">
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 0.5, display: "block" }}>
        Party rate — tap to apply
      </Typography>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {chips.map((chip) => {
          const active = ratesMatch(currentRate, chip.rate);
          return (
            <Button
              key={chip.key}
              size="small"
              variant={active ? "contained" : "outlined"}
              color={chip.tone === "party" ? "primary" : chip.tone === "last" ? "success" : "inherit"}
              onClick={() => onApplyRateChoice(productId, chip.rate)}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                px: 1.25,
                py: 0.65,
                minWidth: 0,
                bgcolor: active && chip.tone === "global" ? "grey.800" : undefined,
              }}
            >
              {chip.label} · {formatCurrency(chip.rate)}
            </Button>
          );
        })}
      </Stack>
    </Box>
  );
}

function ProductSearchField({
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
        if (e.key === "Enter" && options.length > 0) {
          e.preventDefault();
          const first = options[0];
          if (first.id === -9999) {
            onQuickAddProduct?.(productSearch ?? "");
          } else {
            onSelectProduct(first.id);
          }
        }
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
          <Box component="li" {...props} key={option.id} sx={{ py: 1 }}>
            <Box sx={{ width: "100%" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                <Typography variant="body2" fontWeight={700}>
                  {option.name}
                </Typography>
                {option.priceText && (
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {option.priceText}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.25 }}>
                {option.batch && <Typography variant="caption">Batch {option.batch}</Typography>}
                {option.category && <Typography variant="caption">Category {option.category}</Typography>}
                {option.expiry && <Typography variant="caption">Exp {option.expiry}</Typography>}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
                <Typography variant="caption" color="text.secondary">
                  {option.code}
                </Typography>
                {option.stockText && (
                  <Typography variant="caption" color="success.main" fontWeight={600}>
                    {option.stockText}
                  </Typography>
                )}
              </Box>
              {onSelectProductByRate && (
                <Box sx={{ display: "flex", gap: 0.75, mt: 0.8, flexWrap: "wrap" }}>
                  <Button
                    size="small"
                    variant="outlined"
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
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectProductByRate(option.id, "party");
                    }}
                  >
                    Last Price {option.partyRateText || ""}
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="outlined"
          label="Search product"
          placeholder="Name or code…"
          inputRef={productSearchInputRef}
          sx={touchFieldSx}
        />
      )}
      sx={{ mb: 0 }}
    />
  );
}

function MobileLineCard({
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

  return (
    <Box className="billing-mobile-line-card">
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 0.5 }}>
        <Box minWidth={0}>
          <Typography variant="body2" fontWeight={700}>
            {line._idx + 1}. {line.product_name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {line.product_code || "—"} · {line.pack || "Pc"}
          </Typography>
        </Box>
        <IconButton size="medium" color="error" onClick={() => onRemoveLine(line._idx)} aria-label="Remove line">
          <DeleteIcon />
        </IconButton>
      </Stack>
      <PartyRateChips
        productId={line.product}
        currentRate={Number(line.rate)}
        choices={choices}
        onApplyRateChoice={onApplyRateChoice}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <TextField
          size="small"
          type="number"
          label="Qty"
          value={numDisplay(line.quantity)}
          onChange={(e) =>
            onUpdateLine(line._idx, "quantity", parseDecimalInput(e.target.value))
          }
          sx={{ ...touchFieldSx, flex: 1 }}
          inputProps={{ "data-field": "qty" }}
          slotProps={{ htmlInput: { "data-field": "qty" } }}
          {...integerNumberFieldProps(0)}
        />
        <TextField
          size="small"
          type="number"
          label="Rate"
          value={numDisplay(line.rate)}
          onChange={(e) => onUpdateLine(line._idx, "rate", parseDecimalInput(e.target.value))}
          onFocus={() => onFocusRate?.(line.product)}
          onBlur={(e) => onRateBlur?.(line.product, parseDecimalInput(e.target.value))}
          sx={{ ...touchFieldSx, flex: 1.2 }}
          inputProps={{ "data-field": "rate" }}
          slotProps={{ htmlInput: { "data-field": "rate" } }}
          {...decimalNumberFieldProps()}
        />
        <TextField
          size="small"
          type="number"
          label="Disc%"
          value={numDisplay(line.disc_percent)}
          onChange={(e) =>
            onUpdateLine(line._idx, "disc_percent", parseDecimalInput(e.target.value))
          }
          sx={{ ...touchFieldSx, flex: 0.9 }}
          inputProps={{ "data-field": "disc" }}
          slotProps={{ htmlInput: { "data-field": "disc" } }}
          {...integerNumberFieldProps(0, 100)}
        />
      </Stack>
      {choices?.partyRate == null && choices?.globalRate != null && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
          No party rate yet — edit Rate and tap Yes to save for this customer.
        </Typography>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          MRP {line.mrp ? formatCurrency(line.mrp) : "—"}
        </Typography>
        <Typography variant="body2" fontWeight={800} color="primary.dark">
          {formatCurrency(amount)}
        </Typography>
      </Stack>
    </Box>
  );
}

function MobileBillingLines(props: Props) {
  const {
    lines,
    onUpdateLine,
    onRemoveLine,
    onFocusRate,
    productSearch,
    productOptions,
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || lines.length === 0) return;
    window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [lines.length]);

  return (
    <Box className="billing-mobile-lines billing-entry-table">
      {showSearchRow ? (
        <Box className="billing-mobile-search">
          <ProductSearchField
            productSearch={productSearch}
            productOptions={productOptions}
            onProductSearchChange={onProductSearchChange}
            onSelectProduct={onSelectProduct}
            onSelectProductByRate={onSelectProductByRate}
            productSearchInputRef={productSearchInputRef}
            onQuickAddProduct={onQuickAddProduct}
          />
        </Box>
      ) : onOpenSearchRow ? (
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onOpenSearchRow}
          sx={{ mb: 1, textTransform: "none", fontWeight: 800, alignSelf: "flex-start" }}
        >
          Add row (Ctrl+Enter)
        </Button>
      ) : null}

      {lines.length > 0 && (
        <Typography variant="subtitle2" fontWeight={800} className="billing-mobile-lines__title">
          Bill items ({lines.length})
        </Typography>
      )}

      <Box className="billing-mobile-lines__scroll" ref={scrollRef}>
        {lines.length === 0 ? (
          <Box className="billing-mobile-lines__empty">
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Search a product above and tap to add it to this bill.
            </Typography>
          </Box>
        ) : (
          lines.map((line) => (
            <MobileLineCard
              key={line._idx}
              line={line}
              onUpdateLine={onUpdateLine}
              onRemoveLine={onRemoveLine}
              onFocusRate={onFocusRate}
              rateChoicesByProduct={rateChoicesByProduct}
              onApplyRateChoice={onApplyRateChoice}
              onRateBlur={onRateBlur}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

function numDisplay(n: number | undefined) {
  if (n === undefined || n === 0) return "";
  return n;
}

const BillingLineTable = forwardRef<BillingLineTableHandle, Props>(function BillingLineTable(props, ref) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [searchRowOpen, setSearchRowOpen] = useState(props.lines.length === 0);

  useEffect(() => {
    if (props.lines.length === 0) setSearchRowOpen(true);
  }, [props.lines.length]);

  useEffect(() => {
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const tableEl = document.querySelector(".billing-lines-panel");
      if (!tableEl) return;

      const editableInputs = Array.from(
        tableEl.querySelectorAll<HTMLInputElement>(
          'input[data-field="qty"], input[data-field="loose"], input[data-field="disc"], input[data-field="rate"], .billing-erp-search input, .billing-mobile-search input'
        )
      ).filter((input) => {
        const style = window.getComputedStyle(input);
        return style.display !== "none" && style.visibility !== "hidden" && !input.disabled;
      });

      if (editableInputs.length === 0) return;

      const activeEl = document.activeElement as HTMLInputElement;
      const index = editableInputs.indexOf(activeEl);

      if (index === -1) {
        e.preventDefault();
        const searchInput = editableInputs.find((input) =>
          input.placeholder?.toLowerCase().includes("search") ||
          input.closest(".billing-erp-search") ||
          input.closest(".billing-mobile-search")
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.select?.();
        } else {
          editableInputs[0].focus();
          editableInputs[0].select?.();
        }
      } else {
        e.preventDefault();
        let nextIndex;
        if (e.shiftKey) {
          nextIndex = index - 1;
          if (nextIndex < 0) {
            nextIndex = editableInputs.length - 1;
          }
        } else {
          nextIndex = index + 1;
          if (nextIndex >= editableInputs.length) {
            nextIndex = 0;
          }
        }
        const targetInput = editableInputs[nextIndex];
        targetInput.focus();
        targetInput.select?.();
      }
    };

    window.addEventListener("keydown", handleTabKey, true);
    return () => window.removeEventListener("keydown", handleTabKey, true);
  }, [props.lines]);

  const openSearchRow = useCallback(() => {
    setSearchRowOpen(true);
    window.setTimeout(() => {
      if (props.productSearchInputRef && "current" in props.productSearchInputRef) {
        props.productSearchInputRef.current?.focus();
      }
    }, 0);
  }, [props.productSearchInputRef]);

  useImperativeHandle(ref, () => ({ openSearchRow }), [openSearchRow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      e.preventDefault();
      openSearchRow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearchRow]);

  const closeSearchRow = useCallback(() => setSearchRowOpen(false), []);

  const showSearchRow = props.lines.length === 0 || searchRowOpen;

  const tableProps: Props = {
    ...props,
    showSearchRow,
    onOpenSearchRow: openSearchRow,
    onSelectProduct: props.onSelectProduct
      ? (productId) => {
          props.onSelectProduct!(productId);
          closeSearchRow();
        }
      : undefined,
    onSelectProductByRate: props.onSelectProductByRate
      ? (productId, mode) => {
          props.onSelectProductByRate!(productId, mode);
          closeSearchRow();
        }
      : undefined,
  };

  if (isMobile) {
    return (
      <Box
        className="billing-lines-panel billing-lines-panel--mobile"
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        <MobileBillingLines {...tableProps} />
      </Box>
    );
  }

  return (
    <Box
      className="billing-lines-panel billing-lines-panel--desktop"
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <BillingErpDesktopTable {...tableProps} />
    </Box>
  );
});

export default BillingLineTable;
