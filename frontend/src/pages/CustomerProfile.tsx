import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { customersApi, paymentsApi, productsApi } from "@/api/services";
import { formatCurrency } from "@/utils/format";
import { downloadPdfResponse } from "@/utils/pdf";
import { PageShell, AppDialog } from "@/components/ui";
import type { LedgerEntry } from "@/components/ledger/LedgerStatement";
import {
  ActionToolbar,
  CustomerHeader,
  CustomerLedgerTable,
  CustomerProfileSkeleton,
  KPISection,
  PaymentCard,
  ReturnsDashboard,
  SegmentedTabs,
} from "@/components/customer-profile";
import type { PartyProductRateRow, Product } from "@/types";
import toast from "react-hot-toast";
import { wholesaleReturnUrl } from "@/utils/returnNavigation";
import "@/styles/customer-profile.css";

const LAST_CUSTOMER_KEY = "billing_last_customer_id";

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const customerId = Number(id);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [partyRate, setPartyRate] = useState("");
  const [mainTab, setMainTab] = useState<"ledger" | "returns">("ledger");
  const paymentRef = useRef<HTMLDivElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    shop_name: "",
    owner_name: "",
    phone: "",
    area: "",
    opening_balance: "" as string | number,
    credit_limit: "" as string | number,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: typeof editForm) => customersApi.update(customerId, payload),
    onSuccess: () => {
      toast.success("Party updated");
      refetch();
      setEditOpen(false);
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

  const handleEditClick = () => {
    if (c) {
      setEditForm({
        shop_name: c.shop_name,
        owner_name: c.owner_name,
        phone: c.phone,
        area: c.area || "",
        opening_balance: c.opening_balance == null ? "" : String(c.opening_balance),
        credit_limit: c.credit_limit == null ? "" : String(c.credit_limit),
      });
      setEditOpen(true);
    }
  };

  const handleEditSave = () => {
    if (!editForm.shop_name.trim() || !editForm.owner_name.trim() || !editForm.phone.trim()) {
      toast.error("Shop name, owner name and phone are required");
      return;
    }
    const cleanPhone = editForm.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    updateMutation.mutate({
      ...editForm,
      phone: cleanPhone,
      opening_balance: editForm.opening_balance === "" ? 0 : Number(editForm.opening_balance) || 0,
      credit_limit: editForm.credit_limit === "" ? 0 : Number(editForm.credit_limit) || 0,
    });
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["customer-profile", customerId],
    queryFn: () => customersApi.profile(customerId).then((r) => r.data),
    enabled: !!customerId,
  });

  const { data: partyRates, refetch: refetchRates } = useQuery({
    queryKey: ["party-rates", customerId],
    queryFn: () => customersApi.partyRates(customerId).then((r) => r.data as PartyProductRateRow[]),
    enabled: !!customerId,
  });

  const { data: productResults } = useQuery({
    queryKey: ["products-rate-pick", productSearch],
    queryFn: () => productsApi.list({ search: productSearch }).then((r) => r.data.results || r.data),
    enabled: productSearch.length >= 1,
  });

  const saveRate = useMutation({
    mutationFn: () =>
      customersApi.setPartyRate(customerId, {
        product: selectedProduct!.id,
        rate: Number(partyRate),
      }),
    onSuccess: () => {
      toast.success("Party rate saved");
      refetchRates();
      setRateOpen(false);
      setSelectedProduct(null);
      setPartyRate("");
      setProductSearch("");
    },
    onError: () => toast.error("Could not save party rate"),
  });

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await customersApi.ledgerPdf(customerId);
      await downloadPdfResponse(res, `ledger_${data?.customer?.code || customerId}.pdf`);
      toast.success("Ledger PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const sendReminder = async () => {
    try {
      const { data: r } = await paymentsApi.reminder(customerId);
      if (r && r.whatsapp) {
        const wa = r.whatsapp;
        if (wa.sent_via) {
          toast.success(`Ledger PDF sent automatically to +${wa.phone} via ${wa.sent_via.toUpperCase()}!`, { icon: "💬" });
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
                    WhatsApp page opened for +${wa.phone}!
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
      } else {
        toast.success("Reminder generated");
      }
    } catch {
      toast.error("Could not open WhatsApp reminder");
    }
  };

  useEffect(() => {
    if (window.location.hash === "#receive-payment") {
      paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [data]);

  if (isLoading) {
    return (
      <PageShell className="customer-profile-page">
        <CustomerProfileSkeleton />
      </PageShell>
    );
  }
  if (!data) return null;

  const c = data.customer;
  const ledger = (data.ledger as LedgerEntry[]) || [];
  const returns = data.returns || [];

  const handleNewSale = () => {
    localStorage.setItem(LAST_CUSTOMER_KEY, String(customerId));
    navigate("/wholesale/sale");
  };

  const scrollToPayment = () => {
    paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PageShell className="customer-profile-page">
      <CustomerHeader
        name={c.shop_name}
        code={c.code}
        ownerName={c.owner_name}
        phone={c.phone}
        currentDue={Number(data.current_due)}
        lastPurchaseDate={data.last_purchase_date}
        billCount={data.bill_count}
        onBack={() => navigate("/wholesale/parties")}
        onEdit={handleEditClick}
      />

      <ActionToolbar
        onNewSale={handleNewSale}
        onReceivePayment={scrollToPayment}
        onAddReturn={() => navigate(wholesaleReturnUrl(undefined, customerId))}
        onWhatsApp={() => void sendReminder()}
        onExportPdf={() => void exportPdf()}
        pdfLoading={pdfLoading}
      />

      <KPISection
        currentDue={Number(data.current_due)}
        totalSales={Number(data.total_sales)}
        billCount={data.bill_count}
        lastPurchaseDate={data.last_purchase_date}
      />

      <Box className="cp-main-grid">
        <Box className="cp-panel">
          <SegmentedTabs
            tabs={[
              { id: "ledger", label: "Ledger" },
              { id: "returns", label: "Returns" },
            ]}
            value={mainTab}
            onChange={(v) => setMainTab(v as "ledger" | "returns")}
          />
          {mainTab === "ledger" ? (
            <CustomerLedgerTable entries={ledger} onRefresh={() => void refetch()} />
          ) : (
            <ReturnsDashboard returns={returns} />
          )}
        </Box>

        <Box ref={paymentRef}>
          <PaymentCard
            customerId={customerId}
            customerName={c.shop_name}
            closingBalance={Number(data.current_due)}
            onRecorded={() => void refetch()}
          />
        </Box>
      </Box>

      <Box className="cp-insights-grid">
        <Box className="cp-insight-card">
          <Typography className="cp-insight-card__title">Party product rates</Typography>
          <Button variant="outlined" size="small" sx={{ mb: 1, fontWeight: 700, textTransform: "none" }} onClick={() => setRateOpen(true)}>
            Set party rate
          </Button>
          {(partyRates || []).length === 0 ? (
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              No party rates yet
            </Typography>
          ) : (
            (partyRates || []).slice(0, 6).map((row) => (
              <Box key={row.id} className="cp-insight-row">
                <span>{row.product_name}</span>
                <Chip label={formatCurrency(row.rate)} size="small" color="primary" />
              </Box>
            ))
          )}
        </Box>

        <Box className="cp-insight-card">
          <Typography className="cp-insight-card__title">Top items</Typography>
          {(data.frequent_items || []).length === 0 ? (
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              No purchase history yet
            </Typography>
          ) : (
            (data.frequent_items || []).slice(0, 6).map((item: { product__name: string; qty: number }, i: number) => (
              <Box key={i} className="cp-insight-row">
                <span>{item.product__name}</span>
                <strong>{item.qty} units</strong>
              </Box>
            ))
          )}
        </Box>

        <Box className="cp-insight-card">
          <Typography className="cp-insight-card__title">Recent bills</Typography>
          {(data.bills || []).length === 0 ? (
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              No bills yet
            </Typography>
          ) : (
            (data.bills || []).slice(0, 6).map((b: { bill_number: string; total: number }, i: number) => (
              <Box key={i} className="cp-insight-row">
                <span>{b.bill_number}</span>
                <strong>{formatCurrency(b.total)}</strong>
              </Box>
            ))
          )}
        </Box>
      </Box>

      <AppDialog
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="Set party rate"
        actions={
          <Button
            variant="contained"
            className="gradient-button"
            disabled={!selectedProduct || !partyRate}
            onClick={() => saveRate.mutate()}
          >
            Save
          </Button>
        }
      >
        <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
          <TextField
            label="Search product"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            fullWidth
            size="small"
          />
          {productSearch && (productResults as Product[])?.length > 0 && (
            <TextField
              select
              label="Product"
              fullWidth
              size="small"
              value={selectedProduct?.id || ""}
              onChange={(e) => {
                const p = (productResults as Product[]).find((x) => x.id === Number(e.target.value));
                setSelectedProduct(p || null);
                if (p) setPartyRate(String(p.sale_price));
              }}
            >
              {(productResults as Product[]).map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} — global {formatCurrency(p.sale_price)}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Party rate (inclusive)"
            type="number"
            fullWidth
            size="small"
            value={partyRate}
            onChange={(e) => setPartyRate(e.target.value)}
          />
        </Stack>
      </AppDialog>

      <AppDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Party"
        actions={
          <Button
            variant="contained"
            className="gradient-button"
            disabled={updateMutation.isPending}
            onClick={handleEditSave}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        }
      >
        <Stack spacing={2} sx={{ pt: 1, minWidth: 320 }}>
          <TextField
            label="Shop Name"
            fullWidth
            required
            value={editForm.shop_name}
            onChange={(e) => setEditForm({ ...editForm, shop_name: e.target.value })}
          />
          <TextField
            label="Owner Name"
            fullWidth
            required
            value={editForm.owner_name}
            onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
          />
          <TextField
            label="Phone"
            fullWidth
            required
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <TextField
            label="Area"
            fullWidth
            value={editForm.area}
            onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
          />
          <TextField
            type="number"
            label="Opening Balance"
            fullWidth
            value={editForm.opening_balance}
            onChange={(e) => setEditForm({ ...editForm, opening_balance: e.target.value })}
          />
        </Stack>
      </AppDialog>
    </PageShell>
  );
}
