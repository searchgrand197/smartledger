import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  IconButton,
  Autocomplete,
  InputAdornment,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme,
  Chip,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EditIcon from "@mui/icons-material/Edit";
import { portalApi } from "@/api/portal";
import InvoicePrintPreviewDialog from "@/components/invoice/InvoicePrintPreviewDialog";
import { loadInvoicePrintData } from "@/utils/invoicePrint";
import type { InvoicePrintData } from "@/types/invoice";
import BillingLineTable, { type BillingLineTableHandle } from "@/components/billing/BillingLineTable";
import PortalBillingFooter from "@/components/billing/PortalBillingFooter";
import BillingDateTimeFields, {
  buildBillAtIso,
  defaultBillDate,
  defaultBillTime,
} from "@/components/billing/BillingDateTimeFields";
import BillingPaymentDialog from "@/components/billing/BillingPaymentDialog";
import { toBillPayloadItem, formatApiError } from "@/utils/billPayload";
import { useWhatsAppSendGuard } from "@/components/billing/WhatsAppDisconnectedDialog";
import { formatCurrency } from "@/utils/format";
import { sumLineAmounts, billTotal, roundMoney, lineAmountWithDisc } from "@/utils/money";
import type { BillLine, BillLineField } from "@/types";
import { decimalNumberFieldProps, integerNumberFieldProps } from "@/utils/numberField";
import QuickAddProductDialog from "@/components/products/QuickAddProductDialog";

type PortalProductRow = {
  id: number;
  code: string;
  name: string;
  image: string | null;
  unit: string;
  pieces_per_pack: number;
  packs_per_box: number;
  allow_length_sale: boolean;
  length_per_piece_m: number;
  current_stock: number;
  minimum_stock: number;
  is_low_stock: boolean;
  wholesale_rate: number;
  retail_rate: number;
  your_rate: number;
};


type PortalCustomerRow = {
  id: number;
  code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  current_due: number;
};

type PortalCustomerProfileResponse = {
  customer?: PortalCustomerRow;
  current_due?: number;
};

export default function SimpleBilling() {
  const PORTAL_BILLING_DRAFT_KEY = "portal_billing_draft_v1";
  const [draftRestored, setDraftRestored] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [products, setProducts] = useState<PortalProductRow[]>([]);
  const [customerOptions, setCustomerOptions] = useState<PortalCustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<PortalCustomerRow | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<InvoicePrintData | null>(null);
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(defaultBillDate);
  const [billTime, setBillTime] = useState(defaultBillTime);
  const productRef = useRef<HTMLInputElement>(null);
  const lineTableRef = useRef<BillingLineTableHandle>(null);
  const portalProductCache = useRef<Map<number, PortalProductRow>>(new Map());
  const { runWithWhatsAppCheck, whatsappDialog } = useWhatsAppSendGuard(true, "/wholesale/whatsapp");

  const [searchParams, setSearchParams] = useSearchParams();
  const editId = Number(searchParams.get("edit")) || null;
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [editingBillNumber, setEditingBillNumber] = useState<string | null>(null);

  // Mobile Billing state variables
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editRate, setEditRate] = useState(0);
  const [editDisc, setEditDisc] = useState(0);
  const [editLoose, setEditLoose] = useState(0);
  const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState(false);
  const [productSearchRowOpen, setProductSearchRowOpen] = useState(true);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const subtotal = sumLineAmounts(lines);
  const total = billTotal(subtotal, discount, 0, roundOff);
  const dueAmount = roundMoney(Math.max(0, total - paidAmount));

  const openPaymentDialog = () => {
    if (!lines.length) {
      toast.error("Add items first");
      return;
    }
    setPaymentOpen(true);
  };

  const handlePaymentConfirm = (paid: number, mode: string) => {
    setPaidAmount(paid);
    setPaymentMode(mode);
    setPaymentOpen(false);
  };

  const handleProductSearch = async (q: string) => {
    setProductSearch(q);
    const trimmed = q.trim();
    const { data } = await portalApi.products(
      trimmed ? { search: trimmed } : { all: true }
    );
    const rows = data as PortalProductRow[];
    rows.forEach((p) => portalProductCache.current.set(p.id, p));
    setProducts(rows);
  };

  const resolvePortalProduct = (productId: number): PortalProductRow | undefined => {
    return products.find((p) => p.id === productId) ?? portalProductCache.current.get(productId);
  };

  const handleCustomerSearch = async (q: string) => {
    setCustomerSearch(q);
    const { data } = await portalApi.customers({ search: q });
    setCustomerOptions(data as PortalCustomerRow[]);
  };

  const ADD_NEW_ID = -999;
  const customerFilterOptions = (options: PortalCustomerRow[], { inputValue }: { inputValue: string }) => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      const addNew: PortalCustomerRow = {
        id: ADD_NEW_ID,
        code: "",
        shop_name: trimmed,
        owner_name: "",
        phone: "",
        current_due: 0,
      };
      return [...options, addNew];
    }
    return options;
  };

  useEffect(() => {
    void handleProductSearch("");
    if (editId) {
      setDraftRestored(true);
      return;
    }
    const raw = localStorage.getItem(PORTAL_BILLING_DRAFT_KEY);
    let initialSearch = "";
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (typeof d.customerSearch === "string") initialSearch = d.customerSearch;
      } catch {}
    }
    void handleCustomerSearch(initialSearch);
  }, [editId]);

  useEffect(() => {
    if (editId) {
      setDraftRestored(true);
      return;
    }
    const raw = localStorage.getItem(PORTAL_BILLING_DRAFT_KEY);
    if (!raw) {
      setDraftRestored(true);
      return;
    }
    try {
      const d = JSON.parse(raw);
      if (Array.isArray(d.lines)) setLines(d.lines);
      if (typeof d.discount === "number") setDiscount(d.discount);
      if (typeof d.roundOff === "number") setRoundOff(d.roundOff);
      if (typeof d.paymentMode === "string") setPaymentMode(d.paymentMode);
      if (typeof d.paidAmount === "number") setPaidAmount(d.paidAmount);
      if (typeof d.billNumber === "string") setBillNumber(d.billNumber);
      if (typeof d.billDate === "string") setBillDate(d.billDate);
      if (typeof d.billTime === "string") setBillTime(d.billTime);
      if (typeof d.customerPhone === "string") setCustomerPhone(d.customerPhone);
      if (typeof d.customerSearch === "string") setCustomerSearch(d.customerSearch);
      if (d.selectedCustomer) setSelectedCustomer(d.selectedCustomer);
    } catch {
      localStorage.removeItem(PORTAL_BILLING_DRAFT_KEY);
    } finally {
      setDraftRestored(true);
    }
  }, [editId]);

  useEffect(() => {
    if (!draftRestored) return;
    if (editId || editingBillId) return;
    if (lines.length === 0 && !selectedCustomer && !customerSearch && !customerPhone) {
      localStorage.removeItem(PORTAL_BILLING_DRAFT_KEY);
      return;
    }
    try {
      localStorage.setItem(
        PORTAL_BILLING_DRAFT_KEY,
        JSON.stringify({
          lines,
          discount,
          roundOff,
          paymentMode,
          paidAmount,
          selectedCustomer,
          customerSearch,
          customerPhone,
          billNumber,
          billDate,
          billTime,
        })
      );
    } catch {
      // Ignore quota / storage errors — bill lines stay in React state
    }
  }, [
    draftRestored,
    editId,
    editingBillId,
    lines,
    discount,
    roundOff,
    paymentMode,
    paidAmount,
    selectedCustomer,
    customerSearch,
    customerPhone,
    billNumber,
    billDate,
    billTime,
  ]);

  const addProduct = (p: PortalProductRow) => {
    const rate = Number(p.your_rate ?? p.retail_rate ?? p.wholesale_rate ?? 0) || 0;
    portalProductCache.current.set(p.id, p);
    setLines((prev) => {
      const existing = prev.find((l) => l.product === p.id);
      if (existing) {
        return prev.map((l) => (l.product === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      const newLine: BillLine = {
        product: p.id,
        product_name: p.name,
        product_code: p.code,
        quantity: 1,
        rate,
        purchase_rate: rate,
        mrp: rate,
        pack: p.unit || "Pc",
        pieces_per_pack: p.pieces_per_pack && p.pieces_per_pack > 0 ? p.pieces_per_pack : 1,
        allow_length_sale: Boolean(p.allow_length_sale),
        length_per_piece_m: Number(p.length_per_piece_m || 0),
        loose_qty: 0,
        disc_percent: 0,
        your_rate: p.your_rate,
        retail_rate: p.retail_rate,
        wholesale_rate: p.wholesale_rate,
        current_stock: p.current_stock,
      };
      return [...prev, newLine];
    });
    setProductSearch("");
    setProducts([]);
    setProductSearchRowOpen(false);
  };

  const handleQuickAddSuccess = (newProduct: any) => {
    const rate = Number(newProduct.retail_price) || Number(newProduct.sale_price) || 0;
    const newLine: any = {
      product: newProduct.id,
      product_name: newProduct.name,
      product_code: newProduct.code,
      quantity: 1,
      rate,
      purchase_rate: rate,
      mrp: rate,
      pack: newProduct.unit || "Pc",
      pieces_per_pack: 1,
      allow_length_sale: false,
      length_per_piece_m: 0,
      loose_qty: 0,
      disc_percent: 0,
      your_rate: rate,
      retail_rate: rate,
      wholesale_rate: Number(newProduct.sale_price),
      current_stock: newProduct.current_stock || 0,
    };
    setLines((prev) => [...prev, newLine]);
    setProductSearch("");
    setProducts([]);
    setProductSearchRowOpen(false);
  };

  const openProductSearchRow = useCallback(() => {
    setProductSearchRowOpen(true);
    window.setTimeout(() => productRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (lines.length === 0) setProductSearchRowOpen(true);
  }, [lines.length]);

  useEffect(() => {
    if (editId) {
      const loadBill = async () => {
        const loadingToast = toast.loading("Loading bill to edit...");
        try {
          const res = await portalApi.getSimpleBill(editId);
          const bill = res.data;

          if (bill.is_cancelled) {
            toast.error("Cannot edit a cancelled bill", { id: loadingToast });
            setSearchParams({});
            return;
          }

          setEditingBillId(bill.id);
          setEditingBillNumber(bill.bill_number);
          setDiscount(Number(bill.discount_amount) || 0);
          setRoundOff(Number(bill.round_off) || 0);
          setPaidAmount(Number(bill.paid_amount) || 0);
          setPaymentMode(bill.payment_mode);
          setBillNumber(bill.bill_number || "");

          // Date & Time
          if (bill.created_at) {
            const dateObj = new Date(bill.created_at);
            const YYYY = dateObj.getFullYear();
            const MM = String(dateObj.getMonth() + 1).padStart(2, '0');
            const DD = String(dateObj.getDate()).padStart(2, '0');
            const hh = String(dateObj.getHours()).padStart(2, '0');
            const mm = String(dateObj.getMinutes()).padStart(2, '0');
            setBillDate(`${YYYY}-${MM}-${DD}`);
            setBillTime(`${hh}:${mm}`);
          }

          // Customer logic — portal customerDetail returns { customer, current_due, ... }
          const isWalkInBill = bill.customer_code === "CUS-WALK";
          if (isWalkInBill) {
            setSelectedCustomer(null);
            let walkinName = bill.customer_name || "";
            if (bill.notes && bill.notes.startsWith("Simple customer: ")) {
              walkinName = bill.notes.replace("Simple customer: ", "");
            }
            setCustomerSearch(walkinName);
            setCustomerPhone("");
          } else if (bill.customer) {
            try {
              const custRes = await portalApi.customerDetail(bill.customer);
              const profile = custRes.data as PortalCustomerProfileResponse;
              const cust = profile.customer;
              if (!cust) throw new Error("Customer not found");
              const due = Number(profile.current_due ?? cust.current_due ?? 0);
              const row: PortalCustomerRow = {
                id: cust.id,
                code: cust.code,
                shop_name: cust.shop_name,
                owner_name: cust.owner_name,
                phone: cust.phone,
                current_due: due,
              };
              setSelectedCustomer(row);
              setCustomerSearch(cust.shop_name);
              setCustomerPhone(cust.phone || "");
              setCustomerOptions([row]);
            } catch {
              setSelectedCustomer({
                id: bill.customer,
                code: bill.customer_code || "",
                shop_name: bill.customer_name || "",
                owner_name: "",
                phone: "",
                current_due: 0,
              });
              setCustomerSearch(bill.customer_name || "");
            }
          }

          // Fetch products detail to reconstruct lines
          const mappedLines = await Promise.all(
            (bill.items || []).map(async (item: any) => {
              try {
                const searchRes = await portalApi.products({ search: item.product_code, all: true });
                const matchingProducts = searchRes.data as PortalProductRow[];
                const prod = matchingProducts.find((p) => p.id === item.product);
                if (!prod) throw new Error("Product not found in portal");

                let qty = Number(item.quantity) || 0;
                let loose = 0;
                if (prod.pieces_per_pack && prod.pieces_per_pack > 1) {
                  qty = Math.floor(item.quantity / prod.pieces_per_pack);
                  loose = item.quantity % prod.pieces_per_pack;
                }

                return {
                  product: prod.id,
                  product_name: prod.name,
                  product_code: prod.code,
                  quantity: qty,
                  rate: Number(item.rate),
                  purchase_rate: Number(prod.wholesale_rate ?? item.purchase_rate),
                  mrp: Number(prod.retail_rate ?? prod.your_rate),
                  pack: prod.unit || "Pc",
                  pieces_per_pack: prod.pieces_per_pack && prod.pieces_per_pack > 0 ? prod.pieces_per_pack : 1,
                  allow_length_sale: Boolean(prod.allow_length_sale),
                  length_per_piece_m: Number(prod.length_per_piece_m || 0),
                  loose_qty: loose,
                  disc_percent: 0,
                  your_rate: prod.your_rate,
                  retail_rate: prod.retail_rate,
                  wholesale_rate: prod.wholesale_rate,
                  current_stock: prod.current_stock,
                };
              } catch {
                return {
                  product: item.product,
                  product_name: item.product_name,
                  product_code: item.product_code,
                  quantity: Number(item.quantity) || 0,
                  rate: Number(item.rate),
                  purchase_rate: Number(item.purchase_rate),
                  loose_qty: 0,
                  disc_percent: 0,
                };
              }
            })
          );

          setLines(mappedLines);
          localStorage.removeItem(PORTAL_BILLING_DRAFT_KEY);
          toast.success("Bill loaded for editing", { id: loadingToast });
        } catch (err) {
          toast.error("Failed to load bill", { id: loadingToast });
          setSearchParams({});
        }
      };

      void loadBill();
    } else {
      setEditingBillId(null);
      setEditingBillNumber(null);
    }
  }, [editId]);

  useEffect(() => {
    if (!isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      e.preventDefault();
      openProductSearchRow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, openProductSearchRow]);

  const updateLineQty = (idx: number, qty: number) => {
    updateLine(idx, "quantity", qty);
  };

  const updateLine = (idx: number, field: BillLineField, value: number | string) => {
    const u = [...lines];
    const line = u[idx];
    u[idx] = { ...line, [field]: value };
    setLines(u);
  };
  const clearAll = (options?: { silent?: boolean }) => {
    setLines([]);
    setProductSearch("");
    setProducts([]);
    setDiscount(0);
    setRoundOff(0);
    setPaymentMode("cash");
    setPaidAmount(0);
    setPaymentOpen(false);
    setBillNumber("");
    setBillDate(defaultBillDate());
    setBillTime(defaultBillTime());
    setCustomerOptions([]);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerPhone("");
    localStorage.removeItem(PORTAL_BILLING_DRAFT_KEY);
    if (editingBillId || editId) {
      setSearchParams({});
      setEditingBillId(null);
    }
    void handleCustomerSearch("");
    window.setTimeout(() => lineTableRef.current?.openSearchRow(), 0);
    if (!options?.silent) toast.success("Bill cleared");
  };

  const saveBill = (withPrint = false) => {
    if (!lines.length) {
      toast.error("Add products first");
      return;
    }
    void runWithWhatsAppCheck(() => {
      void doSaveBill(paidAmount, paymentMode, withPrint);
    });
  };

  const doSaveBill = async (paidVal: number, modeVal: string, withPrint = false) => {
    if (!lines.length) return;
    setSaving(true);
    try {
      const nameToSend = selectedCustomer ? selectedCustomer.shop_name : customerSearch;
      const payload = {
        items: lines.map(toBillPayloadItem),
        customer_name: nameToSend.trim(),
        customer_phone: customerPhone.trim(),
        discount_amount: discount,
        gst_rate: 0,
        round_off: roundOff,
        paid_amount: paidVal,
        payment_mode: modeVal,
        bill_number: billNumber.trim() || undefined,
        bill_at: buildBillAtIso(billDate, billTime) || undefined,
      };

      const { data } = editingBillId
        ? await portalApi.updateSimpleBill(editingBillId, payload)
        : await portalApi.createSimpleBill(payload);

      const savedMode = data.payment_mode || modeVal;
      const actionText = editingBillId ? "updated" : "saved";
      toast.success(`Bill ${data.bill_number} ${actionText} — ${savedMode.toUpperCase()}`);

      // WhatsApp Delivery Trigger
      if (data && data.whatsapp) {
        const wa = data.whatsapp;
        if (wa.sent_via) {
          toast.success(`WhatsApp PDF sent automatically to +${wa.phone} via ${wa.sent_via.toUpperCase()}!`, { icon: "💬" });
        } else if (wa.whatsapp_url) {
          const win = window.open(wa.whatsapp_url, "_blank");
          if (!win || win.closed || typeof win.closed === "undefined") {
            toast(
              (t) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    WhatsApp link is ready. Popup was blocked.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      size="small"
                      component="a"
                      href={wa.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => toast.dismiss(t.id)}
                      sx={{ textTransform: "none" }}
                    >
                      Open WhatsApp
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => toast.dismiss(t.id)}
                      sx={{ textTransform: "none" }}
                    >
                      Dismiss
                    </Button>
                  </Stack>
                </Box>
              ),
              { duration: 15000, icon: "💬" }
            );
          } else {
            toast(
              (t) => (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>
                    WhatsApp page opened for +{wa.phone}!
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    component="a"
                    href={wa.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => toast.dismiss(t.id)}
                    sx={{ textTransform: "none", p: 0, justifyContent: "flex-start" }}
                  >
                    Click here if it didn't open
                  </Button>
                </Box>
              ),
              { duration: 6000, icon: "💬" }
            );
          }
        } else if (wa.status === "skipped") {
          toast(`WhatsApp skipped: ${wa.reason}`, { icon: "ℹ️" });
        } else if (wa.status === "error") {
          toast.error(`WhatsApp Error: ${wa.detail}`);
        }
      }

      clearAll({ silent: true });
      if (editingBillId) {
        setSearchParams({});
        setEditingBillId(null);
      }
      if (withPrint) {
        const printData = await loadInvoicePrintData(data.id, { portal: true });
        if (printData) {
          setPrintPreviewData(printData);
          setPrintPreviewOpen(true);
        } else {
          toast.error("Bill saved — could not load print preview");
        }
      }
    } catch (err: unknown) {
      toast.error(formatApiError(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const tableRows = lines.map((l, i) => ({ ...l, _idx: i }));

  if (isMobile) {
    return (
      <Box className="billing-mobile-container">
        {/* Header */}
        <Box className="billing-mobile-header">
          <Box className="billing-mobile-header-top">
            <Typography variant="subtitle1" fontWeight={900}>
              {editingBillId ? `Edit Bill: ${editingBillNumber}` : "Quick Sale"}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                color="inherit"
                onClick={() => clearAll()}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Clear
              </Button>
            </Stack>
          </Box>
          <Box className="billing-top-bar__datetime" sx={{ display: "flex", width: "100%" }}>
            <Stack direction="column" spacing={1} sx={{ width: "100%" }}>
              <TextField
                size="small"
                variant="outlined"
                className="app-outlined-field billing-meta-field billing-meta-field--bill-no"
                label="BILL #"
                placeholder="QUICK"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: "100%" }}
              />
              <BillingDateTimeFields
                billDate={billDate}
                billTime={billTime}
                onDateChange={setBillDate}
                onTimeChange={setBillTime}
              />
            </Stack>
          </Box>
        </Box>

        {/* Customer Selector Card */}
        <Box className="billing-mobile-party-card" sx={{ p: 1.5, cursor: "default", display: "block" }}>
          <Stack spacing={1}>
            <Autocomplete
              freeSolo
              size="small"
              openOnFocus={true}
              options={customerOptions}
              filterOptions={customerFilterOptions}
              getOptionLabel={(option) => {
                if (typeof option === "string") return option;
                if (option.id === ADD_NEW_ID) return option.shop_name;
                return `${option.shop_name} (${option.phone})`;
              }}
              renderOption={(props, option) => {
                if (option.id === ADD_NEW_ID) {
                  return (
                    <li {...props} key="__add_new__">
                      <AddIcon sx={{ fontSize: 18, mr: 0.5, color: "primary.main" }} />
                      <Typography variant="body2" color="primary" fontWeight={700}>
                        + Add new: {option.shop_name}
                      </Typography>
                    </li>
                  );
                }
                return (
                  <li {...props} key={option.id}>
                    <Typography variant="body2">{option.shop_name}</Typography>
                    {option.phone && option.phone !== "0000000000" && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {option.phone}
                      </Typography>
                    )}
                  </li>
                );
              }}
              value={selectedCustomer}
              inputValue={customerSearch}
              onInputChange={(_, newValue) => {
                void handleCustomerSearch(newValue);
              }}
              onChange={(_, newValue) => {
                if (typeof newValue === "string") {
                  setSelectedCustomer(null);
                } else if (newValue && typeof newValue === "object") {
                  if (newValue.id === ADD_NEW_ID) {
                    setSelectedCustomer(null);
                    setCustomerPhone("");
                  } else {
                    setSelectedCustomer(newValue);
                    setCustomerPhone(newValue.phone);
                  }
                } else {
                  setSelectedCustomer(null);
                  setCustomerPhone("");
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="CUSTOMER / WALK-IN"
                  placeholder="Search or type name..."
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon color="action" fontSize="small" />
                        </InputAdornment>
                      ),
                    }
                  }}
                />
              )}
              fullWidth
            />
            {(!selectedCustomer || !selectedCustomer.phone) && (
              <TextField
                size="small"
                fullWidth
                label="CUSTOMER PHONE"
                placeholder="Phone (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            )}
            {selectedCustomer && (
              <Typography
                className={`billing-mobile-party-balance ${
                  selectedCustomer.current_due && selectedCustomer.current_due > 0 ? "due" : "clean"
                }`}
                sx={{ fontSize: "0.85rem", fontWeight: 700, mt: 0.5 }}
              >
                Balance: {formatCurrency(selectedCustomer.current_due)}
              </Typography>
            )}
          </Stack>
        </Box>
        {lines.length === 0 || productSearchRowOpen ? (
        <Box className="billing-mobile-search-bar">
          <Autocomplete
            size="small"
            fullWidth
            openOnFocus={true}
            options={(() => {
              const base = products.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                priceText: formatCurrency(p.retail_rate ?? p.your_rate),
                stockText: "",
                isLowStock: Boolean(p.is_low_stock),
              }));
              if (productSearch && productSearch.trim()) {
                const query = productSearch.trim().toLowerCase();
                const exactMatch = products.some((p) => p.name.toLowerCase() === query);
                if (!exactMatch) {
                  base.push({
                    id: -9999,
                    name: `+ Add "${productSearch.trim()}" as new product`,
                    code: "QUICK_ADD",
                    priceText: "",
                    stockText: "",
                    isLowStock: false,
                  });
                }
              }
              return base;
            })()}
            getOptionLabel={(option) => option.name}
            inputValue={productSearch}
            onInputChange={(_, value, reason) => {
              if (reason === "reset") return;
              void handleProductSearch(value);
            }}
            clearOnBlur={false}
            filterOptions={(opts) => opts}
            onChange={(_, option) => {
              if (option) {
                if (option.id === -9999) {
                  setQuickAddName(productSearch);
                  setQuickAddOpen(true);
                } else {
                  const selected = resolvePortalProduct(option.id);
                  if (selected) addProduct(selected);
                  else toast.error("Could not add product — search and select again");
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
                      <Typography variant="body2" fontWeight={700} color="primary.main">
                        {option.priceText}
                      </Typography>
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
                  </Box>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                placeholder="Search items to add..."
                inputRef={productRef}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" fontSize="small" />
                      </InputAdornment>
                    ),
                  }
                }}
              />
            )}
          />
        </Box>
        ) : (
          <Box sx={{ px: 2, py: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={openProductSearchRow}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              Add row (Ctrl+Enter)
            </Button>
          </Box>
        )}

        {/* Item List Scrollable */}
        <Box className="billing-mobile-item-list">
          {lines.length === 0 ? (
            <Box className="billing-mobile-empty-state">
              <AddIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" fontWeight={700} color="text.secondary">
                No items added yet
              </Typography>
              <Typography variant="caption" textAlign="center" color="text.secondary">
                Find and tap products above to add them to this sale.
              </Typography>
            </Box>
          ) : (
            lines.map((line, idx) => {
              const amount = lineAmountWithDisc(line);
              return (
                <Box
                  key={idx}
                  className="billing-mobile-item-card"
                  onClick={() => {
                    setEditingLineIdx(idx);
                    setEditQty(line.quantity);
                    setEditRate(line.rate);
                    setEditLoose(line.loose_qty || 0);
                    setEditDisc(line.disc_percent || 0);
                  }}
                >
                  <Box className="billing-mobile-item-title-row">
                    <Box minWidth={0}>
                      <Typography className="billing-mobile-item-title">
                        {idx + 1}. {line.product_name}
                      </Typography>
                      <Typography className="billing-mobile-item-pack">
                        {line.product_code || "—"} · {line.pack || "Pc"}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLines(lines.filter((_, i) => i !== idx));
                      }}
                      sx={{ mt: -0.5, mr: -0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Box className="billing-mobile-item-controls">
                    {/* Stepper */}
                    <Box className="billing-mobile-stepper" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="billing-mobile-stepper-btn"
                        onClick={() => {
                          if (line.quantity > 1) {
                            updateLineQty(idx, line.quantity - 1);
                          } else {
                            const confirmDelete = window.confirm(`Remove ${line.product_name} from bill?`);
                            if (confirmDelete) {
                              setLines(lines.filter((_, i) => i !== idx));
                            }
                          }
                        }}
                      >
                        -
                      </button>
                      <input
                        className="billing-mobile-stepper-value"
                        type="text"
                        readOnly
                        value={line.quantity}
                      />
                      <button
                        className="billing-mobile-stepper-btn"
                        onClick={() => {
                          updateLineQty(idx, line.quantity + 1);
                        }}
                      >
                        +
                      </button>
                    </Box>

                    {/* Pricing details */}
                    <Box className="billing-mobile-item-details-trigger">
                      <Typography className="billing-mobile-item-price-info">
                        Rate: {formatCurrency(line.rate)}
                        {line.disc_percent ? ` (-${line.disc_percent}%)` : ""}
                      </Typography>
                      <Typography className="billing-mobile-item-amount">
                        {formatCurrency(amount)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* Summary Footer */}
        <Box className="billing-mobile-footer">
          {/* Expandable options */}
          <Collapse in={mobileSummaryExpanded}>
            <Box className="billing-mobile-footer-expanded">
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2} justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary" fontWeight={700}>
                    Subtotal:
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {formatCurrency(subtotal)}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Discount (₹)"
                    type="number"
                    size="small"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    {...integerNumberFieldProps(0)}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Round Off"
                    type="number"
                    size="small"
                    value={roundOff || ""}
                    onChange={(e) => setRoundOff(Number(e.target.value) || 0)}
                    {...integerNumberFieldProps()}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                {total > 0 && (
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    onClick={openPaymentDialog}
                    startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                    sx={{ justifyContent: "space-between", py: 1, textTransform: "none" }}
                  >
                    <Box textAlign="left">
                      <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
                        Payment Mode
                      </Typography>
                      <Typography variant="body2" fontWeight={800}>
                        {paymentMode.toUpperCase()} ({formatCurrency(paidAmount)} paid, {formatCurrency(dueAmount)} due)
                      </Typography>
                    </Box>
                  </Button>
                )}
              </Stack>
            </Box>
          </Collapse>

          {/* Footer Summary Row */}
          <Box className="billing-mobile-footer-summary">
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }} onClick={() => setMobileSummaryExpanded(!mobileSummaryExpanded)}>
              <Box>
                <Typography className="billing-mobile-footer-total-label">
                  Total ({lines.length} items)
                </Typography>
                <Typography className="billing-mobile-footer-total-value">
                  {formatCurrency(total)}
                </Typography>
              </Box>
              <IconButton size="small">
                {mobileSummaryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Box className="billing-mobile-footer-actions" sx={{ flex: 1, justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                className="billing-mobile-btn-secondary"
                onClick={() => saveBill(false)}
                disabled={saving || lines.length === 0}
              >
                {saving ? "Saving…" : "Estimate"}
              </Button>
              <Button
                variant="contained"
                className="billing-mobile-btn-primary"
                onClick={() => saveBill(true)}
                disabled={saving || lines.length === 0}
              >
                {saving ? "Saving…" : "Save & Print"}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Mobile Edit Item Dialog */}
        <Dialog
          open={editingLineIdx !== null}
          onClose={() => setEditingLineIdx(null)}
          fullWidth
          maxWidth="xs"
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          {editingLineIdx !== null && lines[editingLineIdx] && (
            <>
              <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
                Edit {lines[editingLineIdx].product_name}
              </DialogTitle>
              <DialogContent sx={{ pt: 1 }}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Code: {lines[editingLineIdx].product_code || "—"} | Pack: {lines[editingLineIdx].pack || "Pc"}
                  </Typography>
                  <TextField
                    label="Quantity"
                    type="number"
                    size="small"
                    fullWidth
                    value={editQty}
                    onChange={(e) => setEditQty(Number(e.target.value) || 0)}
                    {...integerNumberFieldProps(0)}
                  />
                  {lines[editingLineIdx].allow_length_sale && (
                    <TextField
                      label="Loose Qty"
                      type="number"
                      size="small"
                      fullWidth
                      value={editLoose}
                      onChange={(e) => setEditLoose(Number(e.target.value) || 0)}
                      {...integerNumberFieldProps(0)}
                    />
                  )}
                  <TextField
                    label="Rate"
                    type="number"
                    size="small"
                    fullWidth
                    value={editRate}
                    onChange={(e) => setEditRate(Number(e.target.value) || 0)}
                    {...decimalNumberFieldProps()}
                  />

                  {/* Quick Rate Picker */}
                  <Box className="billing-mobile-rate-chip-group">
                    <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" sx={{ mb: 1, letterSpacing: 0.5 }}>
                      QUICK PRICE SELECT
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {(lines[editingLineIdx] as any).your_rate != null && (
                        <Button
                          size="small"
                          variant={editRate === Number((lines[editingLineIdx] as any).your_rate) ? "contained" : "outlined"}
                          onClick={() => setEditRate(Number((lines[editingLineIdx] as any).your_rate))}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          Your Rate: {formatCurrency(Number((lines[editingLineIdx] as any).your_rate))}
                        </Button>
                      )}
                      {(lines[editingLineIdx] as any).retail_rate != null && (
                        <Button
                          size="small"
                          variant={editRate === Number((lines[editingLineIdx] as any).retail_rate) ? "contained" : "outlined"}
                          onClick={() => setEditRate(Number((lines[editingLineIdx] as any).retail_rate))}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          Retail: {formatCurrency(Number((lines[editingLineIdx] as any).retail_rate))}
                        </Button>
                      )}
                      {(lines[editingLineIdx] as any).wholesale_rate != null && (
                        <Button
                          size="small"
                          variant={editRate === Number((lines[editingLineIdx] as any).wholesale_rate) ? "contained" : "outlined"}
                          onClick={() => setEditRate(Number((lines[editingLineIdx] as any).wholesale_rate))}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          Wholesale: {formatCurrency(Number((lines[editingLineIdx] as any).wholesale_rate))}
                        </Button>
                      )}
                    </Stack>
                  </Box>

                  <TextField
                    label="Discount %"
                    type="number"
                    size="small"
                    fullWidth
                    value={editDisc}
                    onChange={(e) => setEditDisc(Number(e.target.value) || 0)}
                    {...integerNumberFieldProps(0, 100)}
                  />
                </Stack>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={() => setEditingLineIdx(null)} color="inherit" sx={{ fontWeight: 700 }}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    updateLine(editingLineIdx, "quantity", editQty);
                    updateLine(editingLineIdx, "rate", editRate);
                    updateLine(editingLineIdx, "disc_percent", editDisc);
                    updateLine(editingLineIdx, "loose_qty", editLoose);
                    setEditingLineIdx(null);
                  }}
                  className="gradient-button"
                  sx={{ fontWeight: 800 }}
                >
                  Apply
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        <InvoicePrintPreviewDialog
          open={printPreviewOpen}
          data={printPreviewData}
          portal={true}
          onClose={() => {
            setPrintPreviewOpen(false);
            setPrintPreviewData(null);
          }}
        />
        {whatsappDialog}
      </Box>
    );
  }

  return (
    <Box className="billing-workspace portal-billing-workspace animate-fade-in-up" sx={{ height: "100%", minHeight: 0 }}>
      <Box className="billing-top-bar">
        <Stack spacing={0} className="billing-top-bar__inner">
          <Box className="billing-top-bar__meta-row">
            <Box className="billing-top-bar__customer" sx={{ flex: 1, minWidth: 0, maxWidth: 340 }}>
              <Autocomplete
                freeSolo
                size="small"
                openOnFocus={true}
                options={customerOptions}
                filterOptions={customerFilterOptions}
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  if (option.id === ADD_NEW_ID) return option.shop_name;
                  return `${option.shop_name} (${option.phone})`;
                }}
                renderOption={(props, option) => {
                  if (option.id === ADD_NEW_ID) {
                    return (
                      <li {...props} key="__add_new__">
                        <AddIcon sx={{ fontSize: 18, mr: 0.5, color: "primary.main" }} />
                        <Typography variant="body2" color="primary" fontWeight={700}>
                          + Add new: {option.shop_name}
                        </Typography>
                      </li>
                    );
                  }
                  return (
                    <li {...props} key={option.id}>
                      <Typography variant="body2">{option.shop_name}</Typography>
                      {option.phone && option.phone !== "0000000000" && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {option.phone}
                        </Typography>
                      )}
                    </li>
                  );
                }}
                value={selectedCustomer}
                inputValue={customerSearch}
                onInputChange={(_, newValue) => {
                  void handleCustomerSearch(newValue);
                }}
                onChange={(_, newValue) => {
                  if (typeof newValue === "string") {
                    setSelectedCustomer(null);
                  } else if (newValue && typeof newValue === "object") {
                    if (newValue.id === ADD_NEW_ID) {
                      setSelectedCustomer(null);
                      setCustomerPhone("");
                    } else {
                      setSelectedCustomer(newValue);
                      setCustomerPhone(newValue.phone);
                    }
                  } else {
                    setSelectedCustomer(null);
                    setCustomerPhone("");
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="CUSTOMER / WALK-IN"
                    placeholder="Search or type name..."
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon color="action" fontSize="small" />
                          </InputAdornment>
                        ),
                      }
                    }}
                  />
                )}
                fullWidth
              />
            </Box>
            {(!selectedCustomer || !selectedCustomer.phone) && (
              <Box className="billing-top-bar__phone" sx={{ flex: 1, minWidth: 0, maxWidth: 180, ml: 1 }}>
                <TextField
                  size="small"
                  label="PHONE"
                  placeholder="Optional"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  fullWidth
                />
              </Box>
            )}
            <Box className="billing-top-bar__datetime">
              <Stack direction="row" spacing={0.75} className="billing-datetime-fields" sx={{ width: "auto", maxWidth: "100%", minWidth: 0 }}>
                <TextField
                  size="small"
                  variant="outlined"
                  className="app-outlined-field billing-meta-field billing-meta-field--bill-no"
                  label="BILL #"
                  placeholder="QUICK"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 96, maxWidth: 120 }}
                />
                <BillingDateTimeFields
                  billDate={billDate}
                  billTime={billTime}
                  onDateChange={setBillDate}
                  onTimeChange={setBillTime}
                />
              </Stack>
            </Box>
            {editingBillId && !isMobile && (
              <Chip
                label={`Editing: ${editingBillNumber}`}
                color="warning"
                onDelete={() => clearAll()}
                sx={{ ml: 1, mr: 1, fontWeight: 700, height: 40, borderRadius: 2 }}
              />
            )}
            <Box className="billing-top-bar__actions">
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => lineTableRef.current?.openSearchRow()}
                sx={{ fontWeight: 700, flexShrink: 0 }}
              >
                Product
              </Button>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <BillingLineTable
            ref={lineTableRef}
            lines={tableRows}
            onUpdateLine={(idx, field: BillLineField, value: number | string) => {
              setLines((prev) => {
                const u = [...prev];
                u[idx] = { ...u[idx], [field]: value };
                return u;
              });
            }}
            onRemoveLine={(idx) => setLines((prev) => prev.filter((_, i) => i !== idx))}
            productSearch={productSearch}
            onQuickAddProduct={(name) => {
              setQuickAddName(name);
              setQuickAddOpen(true);
            }}
            productOptions={products.map((p) => ({
              id: p.id,
              name: p.name,
              code: p.code,
              priceText: formatCurrency(p.retail_rate ?? p.your_rate),
              stockText: "",
            }))}
            onProductSearchChange={(q) => void handleProductSearch(q)}
            onSelectProduct={(productId) => {
              const selected = resolvePortalProduct(productId);
              if (selected) addProduct(selected);
              else toast.error("Could not add product — search and select again");
            }}
            productSearchInputRef={productRef}
          />
        </Box>

        <PortalBillingFooter
          paymentMode={paymentMode}
          paidAmount={paidAmount}
          dueAmount={dueAmount}
          discount={discount}
          onDiscountChange={setDiscount}
          itemCount={lines.length}
          subtotal={subtotal}
          total={total}
          partyBalance={selectedCustomer?.current_due}
          hasItems={lines.length > 0}
          onOpenPayment={openPaymentDialog}
          onSave={() => saveBill(false)}
          onSaveAndPrint={() => saveBill(true)}
          onClear={clearAll}
          saving={saving}
        />
      </Box>

      <InvoicePrintPreviewDialog
        open={printPreviewOpen}
        data={printPreviewData}
        portal={true}
        onClose={() => {
          setPrintPreviewOpen(false);
          setPrintPreviewData(null);
        }}
      />

      <QuickAddProductDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        initialName={quickAddName}
        portal={true}
        onSuccess={handleQuickAddSuccess}
      />

      <BillingPaymentDialog
        open={paymentOpen}
        onClose={() => !saving && setPaymentOpen(false)}
        total={total}
        roundOff={roundOff}
        onRoundOffChange={setRoundOff}
        customerName={selectedCustomer ? selectedCustomer.shop_name : customerSearch || "Walk-in"}
        partyBalance={selectedCustomer?.current_due}
        initialPaid={paidAmount}
        initialMode={paymentMode}
        onConfirm={handlePaymentConfirm}
        saving={saving}
        saveOnConfirm={false}
      />
      {whatsappDialog}
    </Box>
  );
}
