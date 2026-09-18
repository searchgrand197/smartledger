import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Collapse,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EditIcon from "@mui/icons-material/Edit";
import { billingApi, customersApi, productsApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import BillingFooterBar from "@/components/billing/BillingFooterBar";
import BillingDateTimeFields, {
  buildBillAtIso,
  defaultBillDate,
  defaultBillTime,
} from "@/components/billing/BillingDateTimeFields";
import BillingPaymentDialog from "@/components/billing/BillingPaymentDialog";
import BillFinderDialog from "@/components/billing/BillFinderDialog";
import PartyPickerDialog from "@/components/billing/PartyPickerDialog";
import { DEFAULT_PAYMENT_MODE } from "@/components/billing/PaymentModeToggle";
import InvoicePrintPreviewDialog from "@/components/invoice/InvoicePrintPreviewDialog";
import { loadInvoicePrintData } from "@/utils/invoicePrint";
import type { InvoicePrintData } from "@/types/invoice";
import { formatCurrency } from "@/utils/format";
import {
  sumLineAmounts,
  billTotal,
  roundMoney,
} from "@/utils/money";
import { toBillPayloadItem, formatApiError } from "@/utils/billPayload";
import { useWhatsAppSendGuard } from "@/components/billing/WhatsAppDisconnectedDialog";
import BillingLineTable, { type BillingLineTableHandle } from "@/components/billing/BillingLineTable";
import { AppOutlinedField } from "@/components/ui";
import type { BillLine, BillLineField, BillingContext, Customer, Product, RateHint } from "@/types";
import { decimalNumberFieldProps, integerNumberFieldProps } from "@/utils/numberField";
import QuickAddProductDialog from "@/components/products/QuickAddProductDialog";

export default function Billing() {
  const LAST_CUSTOMER_KEY = "billing_last_customer_id";
  const BILLING_DRAFT_KEY = "billing_sale_draft_v1";
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState(DEFAULT_PAYMENT_MODE);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [printAfterSave, setPrintAfterSave] = useState(false);
  const [customerRestored, setCustomerRestored] = useState(false);
  const [rateHints, setRateHints] = useState<Record<number, RateHint>>({});
  const [promptedRateKeys, setPromptedRateKeys] = useState<Record<string, true>>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [billFinderOpen, setBillFinderOpen] = useState(false);
  const [billDate, setBillDate] = useState(defaultBillDate);
  const [billTime, setBillTime] = useState(defaultBillTime);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<InvoicePrintData | null>(null);
  const productRef = useRef<HTMLInputElement>(null);
  const lineTableRef = useRef<BillingLineTableHandle>(null);
  const { runWithWhatsAppCheck, whatsappDialog } = useWhatsAppSendGuard(false);

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

  const organizationId = useAuthStore((s) => s.organizationId);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { data: products } = useQuery({
    queryKey: ["products-billing", organizationId, productSearch],
    queryFn: () => productsApi.list({ search: productSearch }).then((r) => r.data.results || r.data),
  });
  const productList = (products as Product[]) || [];

  const { data: context, refetch: refetchContext } = useQuery({
    queryKey: ["billing-context", customer?.id, selectedProductId],
    queryFn: () =>
      billingApi.context(customer!.id, selectedProductId || undefined).then((r) => r.data as BillingContext),
    enabled: !!customer,
  });

  const subtotal = sumLineAmounts(lines);
  const total = billTotal(subtotal, discount, 0, roundOff);
  const dueAmount = roundMoney(Math.max(0, total - paidAmount));
  const totalProfit = roundMoney(
    lines.reduce((s, l) => s + l.quantity * (l.rate - (l.purchase_rate || 0)), 0)
  );

  const openPaymentDialog = () => {
    if (!customer) {
      toast.error("Select customer first (F3)");
      return;
    }
    if (!lines.length) {
      toast.error("Add items first");
      return;
    }
    setPaymentOpen(true);
  };

  const addProduct = async (p: Product, forcedRate?: number) => {
    if (!customer) {
      toast.error("Select customer first (F3)");
      return;
    }
    setSelectedProductId(p.id);
    let rate = Number(forcedRate ?? p.sale_price) || 0;
    try {
      const { data } = await billingApi.rateHint(customer.id, p.id);
      setRateHints((prev) => ({ ...prev, [p.id]: data as RateHint }));
      if (forcedRate == null) rate = Number(data.suggested_rate) || Number(p.sale_price) || 0;
    } catch {
      /* use global price */
    }
    const existing = lines.find((l) => l.product === p.id);
    if (existing) {
      setLines(
        lines.map((l) => (l.product === p.id ? { ...l, quantity: l.quantity + 1, rate: forcedRate ?? l.rate } : l))
      );
    } else {
      setLines([
        ...lines,
        {
          product: p.id,
          product_name: p.name,
          product_code: p.code,
          quantity: 1,
          rate,
          purchase_rate: Number(p.purchase_price),
          mrp: Math.round(Number(p.sale_price)),
          pack: p.unit || "Pc",
          pieces_per_pack: p.pieces_per_pack && p.pieces_per_pack > 0 ? p.pieces_per_pack : 1,
          allow_length_sale: Boolean(p.allow_length_sale),
          length_per_piece_m: Number(p.length_per_piece_m || 0),
          loose_qty: 0,
          disc_percent: 0,
          current_stock: p.current_stock,
        },
      ]);
    }
    setProductSearch("");
    setProductSearchRowOpen(false);
  };

  const handleQuickAddSuccess = (newProduct: any) => {
    const newLine: BillLine = {
      product: newProduct.id,
      product_name: newProduct.name,
      product_code: newProduct.code,
      quantity: 1,
      rate: Number(newProduct.sale_price) || 0,
      purchase_rate: Number(newProduct.sale_price) || 0,
      mrp: Math.round(Number(newProduct.sale_price)),
      pack: newProduct.unit || "Pc",
      pieces_per_pack: 1,
      allow_length_sale: false,
      length_per_piece_m: 0,
      loose_qty: 0,
      disc_percent: 0,
      current_stock: newProduct.current_stock || 0,
    };
    setLines((prev) => [...prev, newLine]);
    setProductSearch("");
    setProductSearchRowOpen(false);
  };

  const openProductSearchRow = useCallback(() => {
    setProductSearchRowOpen(true);
    window.setTimeout(() => productRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (lines.length === 0) setProductSearchRowOpen(true);
  }, [lines.length]);

  const applyRateToLine = (productId: number, rate: number) => {
    setLines((prev) =>
      prev.map((l) => (l.product === productId ? { ...l, rate: roundMoney(rate) } : l))
    );
  };

  const savePartyRate = async (productId: number, rate: number) => {
    if (!customer) return;
    try {
      const saved = roundMoney(rate);
      await customersApi.setPartyRate(customer.id, { product: productId, rate: saved });
      toast.success("Party rate saved");
      setRateHints((prev) => {
        const existing = prev[productId];
        if (!existing) return prev;
        return { ...prev, [productId]: { ...existing, party_rate: saved, suggested_rate: saved } };
      });
      try {
        const { data } = await billingApi.rateHint(customer.id, productId);
        setRateHints((prev) => ({ ...prev, [productId]: data as RateHint }));
      } catch {
        /* keep local update */
      }
      refetchContext();
    } catch {
      toast.error("Could not save party rate");
    }
  };

  const updateLine = (idx: number, field: BillLineField, value: number | string) => {
    const updated = [...lines];
    const line = updated[idx];
    updated[idx] = { ...line, [field]: value };
    setLines(updated);
    if (field === "rate") setSelectedProductId(updated[idx].product);
  };

  const doSaveBill = async (
    paidOverride?: number,
    modeOverride?: string,
    withPrint = false
  ) => {
    if (!customer || lines.length === 0) {
      toast.error("Customer and items required");
      return;
    }
    const paidVal = paidOverride ?? paidAmount;
    const modeVal = modeOverride ?? paymentMode;
    setSaving(true);
    try {
      const billAt = buildBillAtIso(billDate, billTime);
      if (billAt && new Date(billAt) > new Date()) {
        toast.error("Bill date/time cannot be in the future");
        setSaving(false);
        return;
      }
      const payload = {
        customer: customer.id,
        items: lines.map(toBillPayloadItem),
        discount_amount: discount,
        gst_rate: 0,
        round_off: roundOff,
        paid_amount: Math.min(paidVal, total),
        payment_mode: modeVal,
        ...(billAt ? { bill_at: billAt } : {}),
      };

      const { data } = editingBillId
        ? await billingApi.update(editingBillId, payload)
        : await billingApi.create(payload);

      const savedDue = roundMoney(Math.max(0, total - Math.min(paidVal, total)));
      const actionText = editingBillId ? "updated" : "saved";
      if (savedDue > 0 && paidVal > 0) {
        toast.success(
          `Bill ${data.bill_number} ${actionText} — ${formatCurrency(paidVal)} received, ${formatCurrency(savedDue)} added to party balance`
        );
      } else if (savedDue > 0) {
        toast.success(
          `Bill ${data.bill_number} ${actionText} — ${formatCurrency(savedDue)} added to party balance`
        );
      } else {
        toast.success(`Bill ${data.bill_number} ${actionText} — paid in full`);
      }

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

      setPaymentOpen(false);
      clearAll({ silent: true });
      refetchContext();
      if (editingBillId) {
        setSearchParams({});
        setEditingBillId(null);
      }
      if (withPrint) {
        setPartyPickerOpen(false);
        const printData = await loadInvoicePrintData(data.id);
        if (printData) {
          setPrintPreviewData(printData);
          setPrintPreviewOpen(true);
        } else {
          toast.error("Bill saved — could not load print preview");
        }
      }
    } catch (err: unknown) {
      toast.error(formatApiError(err, "Failed to save bill"));
    } finally {
      setSaving(false);
    }
  };

  const requestSaveBill = (withPrint = false) => {
    if (!customer) {
      toast.error("Select customer first");
      return;
    }
    if (!lines.length) {
      toast.error("Add items first");
      return;
    }
    void runWithWhatsAppCheck(() => {
      setPrintAfterSave(withPrint);
      void doSaveBill(paidAmount, paymentMode, withPrint);
    });
  };

  const handlePaymentConfirm = (paid: number, mode: string) => {
    setPaidAmount(paid);
    setPaymentMode(mode);
    setPaymentOpen(false);
    toast.success("Payment updated — use Estimate Bill or Save and Print to save");
  };

  const selectParty = (c: Customer) => {
    setCustomer(c);
    localStorage.setItem(LAST_CUSTOMER_KEY, String(c.id));
  };

  const clearAll = (options?: { silent?: boolean }) => {
    setLines([]);
    setCustomer(null);
    setDiscount(0);
    setRoundOff(0);
    setPaidAmount(0);
    setPaymentMode(DEFAULT_PAYMENT_MODE);
    setPrintAfterSave(false);
    setSelectedProductId(null);
    setProductSearch("");
    setRateHints({});
    setPromptedRateKeys({});
    setPaymentOpen(false);
    setBillDate(defaultBillDate());
    setBillTime(defaultBillTime());
    localStorage.removeItem(BILLING_DRAFT_KEY);
    localStorage.removeItem(LAST_CUSTOMER_KEY);
    if (editingBillId || editId) {
      setSearchParams({});
      setEditingBillId(null);
    }
    if (!options?.silent) {
      toast.success("Bill cleared — select party");
      setPartyPickerOpen(true);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        clearAll();
      } else if (e.key === "F3") {
        e.preventDefault();
        setPartyPickerOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        openPaymentDialog();
      } else if (e.key === "F6") {
        e.preventDefault();
        setBillFinderOpen(true);
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (isMobile) openProductSearchRow();
        else lineTableRef.current?.openSearchRow();
      }
    },
    [customer, lines, discount, roundOff, paidAmount, paymentMode, printAfterSave, isMobile, openProductSearchRow]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    let active = true;
    const raw = localStorage.getItem(BILLING_DRAFT_KEY);
    if (!raw || editId) {
      setDraftRestored(true);
      return () => {
        active = false;
      };
    }
    const restore = async () => {
      try {
        const d = JSON.parse(raw) as {
          customerId?: number;
          lines?: BillLine[];
          discount?: number;
          roundOff?: number;
          paidAmount?: number;
          paymentMode?: string;
          printAfterSave?: boolean;
          billDate?: string;
          billTime?: string;
        };
        if (Array.isArray(d.lines) && active) setLines(d.lines);
        if (typeof d.discount === "number" && active) setDiscount(d.discount);
        if (typeof d.roundOff === "number" && active) setRoundOff(d.roundOff);
        if (typeof d.paidAmount === "number" && active) setPaidAmount(d.paidAmount);
        if (typeof d.paymentMode === "string" && active) setPaymentMode(d.paymentMode);
        if (typeof d.printAfterSave === "boolean" && active) setPrintAfterSave(d.printAfterSave);
        if (typeof d.billDate === "string" && active) setBillDate(d.billDate);
        if (typeof d.billTime === "string" && active) setBillTime(d.billTime);
        if (d.customerId) {
          try {
            const res = await customersApi.get(d.customerId);
            if (active) setCustomer(res.data as Customer);
          } catch {
            /* stale draft customer */
          }
        }
      } catch {
        localStorage.removeItem(BILLING_DRAFT_KEY);
      } finally {
        if (active) setDraftRestored(true);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (editId) {
      setCustomerRestored(true);
      return;
    }
    if (!draftRestored || customerRestored || customer) return;
    const savedId = Number(localStorage.getItem(LAST_CUSTOMER_KEY) || 0);
    if (!savedId) {
      setCustomerRestored(true);
      return;
    }
    customersApi
      .get(savedId)
      .then((r) => setCustomer(r.data as Customer))
      .finally(() => setCustomerRestored(true));
  }, [draftRestored, customerRestored, customer]);

  useEffect(() => {
    if (!customer?.id) return;
    localStorage.setItem(LAST_CUSTOMER_KEY, String(customer.id));
  }, [customer]);

  useEffect(() => {
    if (!draftRestored) return;
    if (editingBillId) return;
    if (lines.length === 0) {
      localStorage.removeItem(BILLING_DRAFT_KEY);
      return;
    }
    localStorage.setItem(
      BILLING_DRAFT_KEY,
      JSON.stringify({
        customerId: customer?.id ?? null,
        lines,
        discount,
        roundOff,
        paidAmount,
        paymentMode,
        printAfterSave,
        billDate,
        billTime,
      })
    );
  }, [draftRestored, customer, lines, discount, roundOff, paidAmount, paymentMode, printAfterSave, billDate, billTime]);

  useEffect(() => {
    setRateHints({});
    setPromptedRateKeys({});
  }, [customer?.id]);

  useEffect(() => {
    if (!draftRestored || !customerRestored || customer || printPreviewOpen) return;
    setPartyPickerOpen(true);
  }, [draftRestored, customerRestored, customer, printPreviewOpen]);

  useEffect(() => {
    if (!customer || lines.length === 0) return;
    const missing = [...new Set(lines.map((l) => l.product))].filter((id) => !rateHints[id]);
    if (missing.length === 0) return;
    missing.forEach((productId) => {
      billingApi
        .rateHint(customer.id, productId)
        .then((res) => {
          setRateHints((prev) => ({ ...prev, [productId]: res.data as RateHint }));
        })
        .catch(() => {});
    });
  }, [customer, lines, rateHints]);

  useEffect(() => {
    if (!customer || productList.length === 0) return;
    const missing = productList.map((p) => p.id).filter((id) => !rateHints[id]);
    if (missing.length === 0) return;
    missing.forEach((productId) => {
      billingApi
        .rateHint(customer.id, productId)
        .then((res) => setRateHints((prev) => ({ ...prev, [productId]: res.data as RateHint })))
        .catch(() => {});
    });
  }, [customer, productList, rateHints]);

  useEffect(() => {
    if (editId) {
      const loadBill = async () => {
        const loadingToast = toast.loading("Loading bill to edit...");
        try {
          const res = await billingApi.get(editId);
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

          // Fetch customer details
          if (bill.customer) {
            try {
              const custRes = await customersApi.get(bill.customer);
              setCustomer(custRes.data as Customer);
            } catch {
              setCustomer({
                id: bill.customer,
                shop_name: bill.customer_name || "",
                code: bill.customer_code || "",
              } as any);
            }
          }

          // Fetch products detail to reconstruct lines
          const mappedLines = await Promise.all(
            (bill.items || []).map(async (item: any) => {
              try {
                const prodRes = await productsApi.get(item.product);
                const prod = prodRes.data as Product;

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
                  purchase_rate: Number(prod.purchase_price ?? item.purchase_rate),
                  mrp: Math.round(Number(prod.sale_price)),
                  pack: prod.unit || "Pc",
                  pieces_per_pack: prod.pieces_per_pack && prod.pieces_per_pack > 0 ? prod.pieces_per_pack : 1,
                  allow_length_sale: Boolean(prod.allow_length_sale),
                  length_per_piece_m: Number(prod.length_per_piece_m || 0),
                  loose_qty: loose,
                  disc_percent: 0,
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
    if (editingLineIdx !== null && lines[editingLineIdx]) {
      const line = lines[editingLineIdx];
      setEditQty(line.quantity);
      setEditRate(line.rate);
      setEditDisc(line.disc_percent || 0);
      setEditLoose(line.loose_qty || 0);
    }
  }, [editingLineIdx, lines]);

  const tableRows = lines.map((l, i) => ({ ...l, _idx: i }));

  const maybePromptSetPartyRate = (productId: number, rate: number) => {
    if (!customer || !Number.isFinite(rate) || rate < 0) return;
    // Use rateHints (stable, fetched when product is added) — not productList which
    // is a live search result and may be empty / not contain this product.
    const hint = rateHints[productId];
    // If hint not yet loaded, skip silently (avoids false triggers before fetch completes)
    if (!hint) return;
    const globalRate = Number(hint.global_rate ?? 0);
    const partyRate = hint.party_rate == null ? null : Number(hint.party_rate);
    if (Math.abs(rate - globalRate) < 0.001) return;  // same as global — no need to save
    if (partyRate != null && Math.abs(rate - partyRate) < 0.001) return;  // already the party rate
    const key = `${customer.id}-${productId}-${roundMoney(rate)}`;
    if (promptedRateKeys[key]) return;
    setPromptedRateKeys((prev) => ({ ...prev, [key]: true }));
    // Use lines array for the product name — it's always present if we are blurring a rate field
    const productName = lines.find((l) => l.product === productId)?.product_name || "Product";
    toast(
      (t) => (
        <Stack spacing={1}>
          <Typography variant="body2">
            Save {formatCurrency(rate)} as party rate for {productName}?
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              onClick={async () => {
                await savePartyRate(productId, rate);
                toast.dismiss(t.id);
              }}
            >
              Yes
            </Button>
            <Button size="small" variant="outlined" onClick={() => toast.dismiss(t.id)}>
              No
            </Button>
          </Stack>
        </Stack>
      ),
      { duration: 10000 }
    );
  };

  if (isMobile) {
    return (
      <Box className="billing-mobile-container">
        {/* Header */}
        <Box className="billing-mobile-header">
          <Box className="billing-mobile-header-top">
            <Typography variant="subtitle1" fontWeight={900}>
              {editingBillId ? `Edit Bill: ${editingBillNumber}` : "Sale Invoice"}
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" color="inherit" onClick={() => setBillFinderOpen(true)}>
                <SearchIcon />
              </IconButton>
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
          <Box className="billing-top-bar__datetime" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BillingDateTimeFields
              billDate={billDate}
              billTime={billTime}
              onDateChange={setBillDate}
              onTimeChange={setBillTime}
            />
          </Box>
        </Box>

        {/* Customer Selector Card */}
        <Box
          className="billing-mobile-party-card"
          onClick={() => setPartyPickerOpen(true)}
        >
          <Box className="billing-mobile-party-info">
            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 0.5 }}>
              PARTY / CUSTOMER
            </Typography>
            <Typography className="billing-mobile-party-name">
              {customer ? `${customer.shop_name} (${customer.code})` : "Select Party / Customer"}
            </Typography>
            {customer && (
              <Typography
                className={`billing-mobile-party-balance ${
                  context?.outstanding_balance && context.outstanding_balance > 0 ? "due" : "clean"
                }`}
              >
                Balance: {formatCurrency(context?.outstanding_balance || 0)}
              </Typography>
            )}
          </Box>
          <IconButton size="small" color="primary">
            <PersonIcon />
          </IconButton>
        </Box>
        {lines.length === 0 || productSearchRowOpen ? (
        <Box className="billing-mobile-search-bar">
          <Autocomplete
            size="small"
            fullWidth
            options={(() => {
              const base = productList.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                stockText: "",
                priceText: formatCurrency(p.sale_price),
              }));
              if (productSearch && productSearch.trim()) {
                const query = productSearch.trim().toLowerCase();
                const exactMatch = productList.some((p) => p.name.toLowerCase() === query);
                if (!exactMatch) {
                  base.push({
                    id: -9999,
                    name: `+ Add "${productSearch.trim()}" as new product`,
                    code: "QUICK_ADD",
                    stockText: "",
                    priceText: "",
                  });
                }
              }
              return base;
            })()}
            getOptionLabel={(option) => option.name}
            inputValue={productSearch}
            onInputChange={(_, value, reason) => {
              if (reason === "reset") return;
              setProductSearch(value);
            }}
            clearOnBlur={false}
            filterOptions={(opts) => opts}
            onChange={(_, option) => {
              if (option) {
                if (option.id === -9999) {
                  setQuickAddName(productSearch);
                  setQuickAddOpen(true);
                } else {
                  const selected = productList.find((p) => p.id === option.id);
                  if (selected) void addProduct(selected);
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
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
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
              const amount = line.quantity * line.rate * (1 - (line.disc_percent || 0) / 100);
              return (
                <Box
                  key={idx}
                  className="billing-mobile-item-card"
                  onClick={() => setEditingLineIdx(idx)}
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
                            updateLine(idx, "quantity", line.quantity - 1);
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
                          updateLine(idx, "quantity", line.quantity + 1);
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
                {totalProfit > 0 && (
                  <Stack direction="row" spacing={2} justifyContent="space-between">
                    <Typography variant="body2" color="success.dark" fontWeight={700}>
                      Est. Profit:
                    </Typography>
                    <Typography variant="body2" color="success.dark" fontWeight={800}>
                      {formatCurrency(totalProfit)}
                    </Typography>
                  </Stack>
                )}
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
                {customer && total > 0 && (
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
                onClick={() => requestSaveBill(false)}
                disabled={saving || !customer || lines.length === 0}
              >
                {saving ? "Saving…" : "Estimate"}
              </Button>
              <Button
                variant="contained"
                className="billing-mobile-btn-primary"
                onClick={() => requestSaveBill(true)}
                disabled={saving || !customer || lines.length === 0}
              >
                {saving ? "Saving…" : "Save & Print"}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Dialogs required inside workspace */}
        <PartyPickerDialog
          open={partyPickerOpen}
          onClose={() => setPartyPickerOpen(false)}
          onSelect={selectParty}
          selectedId={customer?.id}
        />

        <BillFinderDialog open={billFinderOpen} onClose={() => setBillFinderOpen(false)} />

        <BillingPaymentDialog
          open={paymentOpen}
          onClose={() => !saving && setPaymentOpen(false)}
          total={total}
          roundOff={roundOff}
          onRoundOffChange={setRoundOff}
          customerName={customer?.shop_name}
          partyBalance={context?.outstanding_balance}
          initialPaid={paidAmount}
          initialMode={paymentMode}
          onConfirm={handlePaymentConfirm}
          saving={saving}
          saveOnConfirm={false}
        />

        <InvoicePrintPreviewDialog
          open={printPreviewOpen}
          data={printPreviewData}
          onClose={() => {
            setPrintPreviewOpen(false);
            setPrintPreviewData(null);
            if (!customer) setPartyPickerOpen(true);
          }}
        />

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
                  {rateHints[lines[editingLineIdx].product] && (
                    <Box className="billing-mobile-rate-chip-group">
                      <Typography variant="caption" color="text.secondary" fontWeight={800} display="block" sx={{ mb: 1, letterSpacing: 0.5 }}>
                        QUICK PRICE SELECT
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant={editRate === Number(rateHints[lines[editingLineIdx].product].global_rate) ? "contained" : "outlined"}
                          onClick={() => setEditRate(Number(rateHints[lines[editingLineIdx].product].global_rate))}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          Global: {formatCurrency(Number(rateHints[lines[editingLineIdx].product].global_rate))}
                        </Button>
                        {rateHints[lines[editingLineIdx].product].party_rate !== null && (
                          <Button
                            size="small"
                            variant={editRate === Number(rateHints[lines[editingLineIdx].product].party_rate) ? "contained" : "outlined"}
                            onClick={() => setEditRate(Number(rateHints[lines[editingLineIdx].product].party_rate))}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Party: {formatCurrency(Number(rateHints[lines[editingLineIdx].product].party_rate))}
                          </Button>
                        )}
                        {rateHints[lines[editingLineIdx].product].last_sale_rate !== null && (
                          <Button
                            size="small"
                            variant={editRate === Number(rateHints[lines[editingLineIdx].product].last_sale_rate) ? "contained" : "outlined"}
                            onClick={() => setEditRate(Number(rateHints[lines[editingLineIdx].product].last_sale_rate))}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Last: {formatCurrency(Number(rateHints[lines[editingLineIdx].product].last_sale_rate))}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  )}

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
                    const line = lines[editingLineIdx];
                    updateLine(editingLineIdx, "quantity", editQty);
                    updateLine(editingLineIdx, "rate", editRate);
                    updateLine(editingLineIdx, "disc_percent", editDisc);
                    updateLine(editingLineIdx, "loose_qty", editLoose);
                    setEditingLineIdx(null);
                    // Prompt to save custom rate as party rate (same as desktop onRateBlur)
                    if (line && editRate !== line.rate) {
                      maybePromptSetPartyRate(line.product, editRate);
                    }
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
        {whatsappDialog}
      </Box>
    );
  }

  return (
    <Box className={`billing-workspace animate-fade-in-up${isMobile ? " billing-workspace--mobile" : ""}`} sx={{ height: "100%" }}>
      <Box className="billing-top-bar">
        <Stack spacing={isMobile ? 0.75 : 0} className="billing-top-bar__inner">
          <Box className="billing-top-bar__meta-row">
            <Box
              className="billing-top-bar__customer billing-customer-picker-trigger"
              onClick={() => setPartyPickerOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPartyPickerOpen(true);
                }
              }}
            >
              <AppOutlinedField
                id="customer-search"
                label="CUSTOMER"
                placeholder="Select party — F3"
                minWidth={0}
                fullWidth
                readOnly
                value={customer ? `${customer.shop_name} (${customer.code})` : ""}
                onChange={() => {}}
                onClear={
                  customer
                    ? () => {
                        setCustomer(null);
                        setPartyPickerOpen(true);
                      }
                    : undefined
                }
                icon={<PersonIcon fontSize="small" />}
                disableBrowserAutocomplete
              />
            </Box>
            <Box className="billing-top-bar__datetime">
              <BillingDateTimeFields
                billDate={billDate}
                billTime={billTime}
                onDateChange={setBillDate}
                onTimeChange={setBillTime}
              />
            </Box>
            {editingBillId && !isMobile && (
              <Chip
                label={`Editing: ${editingBillNumber}`}
                color="warning"
                onDelete={() => clearAll()}
                sx={{ ml: 1, mr: 1, fontWeight: 700, height: 40, borderRadius: 2 }}
              />
            )}
            {!isMobile && (
              <Box className="billing-top-bar__actions">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SearchIcon />}
                  onClick={() => setBillFinderOpen(true)}
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                >
                  Find bill
                </Button>
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
            )}
          </Box>

          {isMobile && (
            <Stack direction="row" spacing={1} alignItems="center" className="billing-top-bar__actions">
              <Tooltip title="Find bill">
                <IconButton
                  aria-label="Find bill"
                  onClick={() => setBillFinderOpen(true)}
                  sx={{
                    border: "1.5px solid",
                    borderColor: "primary.main",
                    borderRadius: 2,
                    color: "primary.main",
                  }}
                >
                  <SearchIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => lineTableRef.current?.openSearchRow()}
                sx={{ flex: 1, fontWeight: 700, minHeight: 42 }}
              >
                Add product
              </Button>
            </Stack>
          )}

          <Stack direction="row" spacing={0.5} flexWrap="wrap" display={{ xs: "none", lg: "flex" }} sx={{ mt: 1 }}>
            {["F2 Clear", "F3 Party", "F4 Payment", "F6 Find bill", "Ctrl+Enter Add row"].map((k) => (
              <Chip key={k} size="small" label={k} variant="outlined" />
            ))}
          </Stack>
        </Stack>
      </Box>

      {/* Main + sidebar */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <BillingLineTable
            ref={lineTableRef}
            lines={tableRows}
            onUpdateLine={updateLine}
            onRemoveLine={(idx) => setLines(lines.filter((_, i) => i !== idx))}
            onFocusRate={setSelectedProductId}
            productSearch={productSearch}
            onQuickAddProduct={(name) => {
              setQuickAddName(name);
              setQuickAddOpen(true);
            }}
            productOptions={productList.map((p) => ({
              id: p.id,
              name: p.name,
              code: p.code,
              stockText: "",
              priceText: formatCurrency(p.sale_price),
              globalRateText: formatCurrency(Number(rateHints[p.id]?.global_rate ?? p.sale_price)),
              partyRateText:
                rateHints[p.id]?.party_rate == null
                  ? null
                  : formatCurrency(Number(rateHints[p.id]?.party_rate)),
            }))}
            onProductSearchChange={setProductSearch}
            onSelectProduct={(productId) => {
              const selected = productList.find((p) => p.id === productId);
              if (selected) void addProduct(selected);
            }}
            onSelectProductByRate={async (productId, mode) => {
              const selected = productList.find((p) => p.id === productId);
              if (!selected || !customer) return;
              let hint: RateHint | undefined = rateHints[productId];
              if (!hint) {
                try {
                  const { data } = await billingApi.rateHint(customer.id, productId);
                  hint = data as RateHint;
                  setRateHints((prev) => ({ ...prev, [productId]: hint! }));
                } catch {
                  hint = undefined;
                }
              }
              const globalRate = Number(hint?.global_rate ?? selected.sale_price);
              const partyRate =
                hint?.party_rate == null ? null : Number(hint.party_rate ?? hint.last_sale_rate ?? hint.suggested_rate);
              const chosen = mode === "global" ? globalRate : partyRate ?? globalRate;
              void addProduct(selected, chosen);
            }}
            productSearchInputRef={productRef}
            rateChoicesByProduct={Object.fromEntries(
              Object.entries(rateHints).map(([productId, hint]) => [
                Number(productId),
                {
                  globalRate: Number(hint.global_rate),
                  partyRate: hint.party_rate == null ? null : Number(hint.party_rate),
                  lastSaleRate: hint.last_sale_rate == null ? null : Number(hint.last_sale_rate),
                  suggestedRate: Number(hint.suggested_rate),
                },
              ])
            )}
            onApplyRateChoice={(productId, rate) => applyRateToLine(productId, rate)}
            onRateBlur={maybePromptSetPartyRate}
          />
        </Box>
        <BillingFooterBar
          paymentMode={paymentMode}
          paidAmount={paidAmount}
          dueAmount={dueAmount}
          discount={discount}
          onDiscountChange={setDiscount}
          itemCount={lines.length}
          subtotal={subtotal}
          profit={totalProfit}
          total={total}
          partyBalance={context?.outstanding_balance}
          hasCustomer={Boolean(customer)}
          onOpenPayment={openPaymentDialog}
          onSave={() => requestSaveBill(false)}
          onSaveAndPrint={() => requestSaveBill(true)}
          onClear={clearAll}
          saving={saving}
        />
      </Box>

      <PartyPickerDialog
        open={partyPickerOpen}
        onClose={() => setPartyPickerOpen(false)}
        onSelect={selectParty}
        selectedId={customer?.id}
      />

      <BillFinderDialog open={billFinderOpen} onClose={() => setBillFinderOpen(false)} />

      <BillingPaymentDialog
        open={paymentOpen}
        onClose={() => !saving && setPaymentOpen(false)}
        total={total}
        roundOff={roundOff}
        onRoundOffChange={setRoundOff}
        customerName={customer?.shop_name}
        partyBalance={context?.outstanding_balance}
        initialPaid={paidAmount}
        initialMode={paymentMode}
        onConfirm={handlePaymentConfirm}
        saving={saving}
        saveOnConfirm={false}
      />

      <InvoicePrintPreviewDialog
        open={printPreviewOpen}
        data={printPreviewData}
        onClose={() => {
          setPrintPreviewOpen(false);
          setPrintPreviewData(null);
          if (!customer) setPartyPickerOpen(true);
        }}
      />

      <QuickAddProductDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        initialName={quickAddName}
        portal={false}
        onSuccess={handleQuickAddSuccess}
      />
      {whatsappDialog}
    </Box>
  );
}
