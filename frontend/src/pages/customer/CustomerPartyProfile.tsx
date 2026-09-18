import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import toast from "react-hot-toast";
import { portalApi } from "@/api/portal";
import { PageShell, PageHeader, StatCard, LoadingState } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { downloadPdfResponse } from "@/utils/pdf";
import LedgerStatement, { type LedgerEntry, type LedgerSummary } from "@/components/ledger/LedgerStatement";
import PaymentCard from "@/components/customer-profile/PaymentCard";
import { SegmentedTabs, ReturnsDashboard } from "@/components/customer-profile";
import "@/styles/customer-profile.css";

import EditIcon from "@mui/icons-material/Edit";
import { AppDialog } from "@/components/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@mui/material";

export default function CustomerPartyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const customerId = Number(id);
  const qc = useQueryClient();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [mainTab, setMainTab] = useState<"ledger" | "returns">("ledger");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    shop_name: "",
    owner_name: "",
    phone: "",
    area: "",
    opening_balance: "" as string | number,
    credit_limit: "" as string | number,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["customer-portal-profile", customerId],
    queryFn: () => portalApi.customerProfile(customerId).then((r) => r.data),
    enabled: !!customerId,
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (payload: typeof editForm) => portalApi.updateCustomer(customerId, payload),
    onSuccess: () => {
      toast.success("Party / Customer updated successfully");
      qc.invalidateQueries({ queryKey: ["customer-portal-profile", customerId] });
      qc.invalidateQueries({ queryKey: ["customer-portal-customers"] });
      setEditOpen(false);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: Record<string, unknown> } };
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

  const handleOpenEdit = () => {
    if (!data?.customer) return;
    const cust = data.customer;
    setEditForm({
      shop_name: cust.shop_name || "",
      owner_name: cust.owner_name || "",
      phone: cust.phone || "",
      area: cust.area || "",
      opening_balance: cust.opening_balance == null ? "" : String(cust.opening_balance),
      credit_limit: cust.credit_limit == null ? "" : String(cust.credit_limit),
    });
    setEditOpen(true);
  };

  const handleSaveCustomer = () => {
    if (!editForm.shop_name.trim() || !editForm.owner_name.trim() || !editForm.phone.trim()) {
      toast.error("Name, Owner and Phone are required");
      return;
    }
    const cleanPhone = editForm.phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    const payload = {
      ...editForm,
      phone: cleanPhone,
      opening_balance: editForm.opening_balance === "" ? 0 : Number(editForm.opening_balance) || 0,
      credit_limit: editForm.credit_limit === "" ? 0 : Number(editForm.credit_limit) || 0,
    };
    updateCustomerMutation.mutate(payload);
  };

  const downloadLedger = async () => {
    if (!customerId || pdfLoading) return;
    setPdfLoading(true);
    try {
      const res = await portalApi.customerLedgerPdf(customerId);
      await downloadPdfResponse(res, `ledger_${data?.customer?.code || "customer"}.pdf`);
      toast.success("Ledger PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const sendReminder = async () => {
    if (!customerId) return;
    const loadToast = toast.loading("Sending reminder...");
    try {
      const { data: r } = await portalApi.sendReminder(customerId);
      if (r && r.whatsapp) {
        const wa = r.whatsapp;
        if (wa.sent_via) {
          toast.success(`Ledger PDF sent automatically to +${wa.phone} via ${wa.sent_via.toUpperCase()}!`, { id: loadToast, icon: "💬" });
        } else if (wa.whatsapp_url) {
          toast.success("Opening WhatsApp link...", { id: loadToast });
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
          toast(`WhatsApp skipped: ${wa.reason}`, { id: loadToast, icon: "ℹ️" });
        } else if (wa.status === "error") {
          toast.error(`WhatsApp Error: ${wa.detail}`, { id: loadToast });
        }
      } else {
        toast.success("Reminder generated", { id: loadToast });
      }
    } catch {
      toast.error("Could not open WhatsApp reminder", { id: loadToast });
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <LoadingState message="Loading customer profile…" />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell>
        <Box textAlign="center" py={4}>
          <Button variant="contained" className="gradient-button" onClick={() => refetch()}>
            Retry
          </Button>
        </Box>
      </PageShell>
    );
  }

  const c = data.customer;
  const ledger = (data.ledger as LedgerEntry[]) || [];
  const returns = data.returns || [];
  const summary = (data.ledger_summary as LedgerSummary) || {
    opening_balance: 0,
    total_debit: 0,
    total_credit: 0,
    closing_balance: data.current_due,
  };

  const creditLimit = Number(c?.credit_limit || 0);
  const currentDue = Number(data.current_due || 0);
  const creditAvailable = Math.max(0, creditLimit - currentDue);

  return (
    <PageShell>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/customer/customers")}
        sx={{ mb: 1.5, alignSelf: "flex-start", fontWeight: 700 }}
      >
        Back to Customers
      </Button>
      <PageHeader
        title={c?.shop_name || "Customer Profile"}
        subtitle={`${c?.code || ""} · Owner: ${c?.owner_name || ""} · Phone: ${c?.phone || ""}`}
      />
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          className="gradient-button"
          startIcon={<EditIcon />}
          onClick={handleOpenEdit}
          sx={{ fontWeight: 700 }}
        >
          Edit Party / Customer Name
        </Button>
        <Button
          variant="outlined"
          startIcon={pdfLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
          disabled={pdfLoading}
          onClick={downloadLedger}
          sx={{ fontWeight: 700 }}
        >
          {pdfLoading ? "Downloading..." : "Ledger PDF"}
        </Button>
        <Button
          variant="outlined"
          color="success"
          startIcon={<WhatsAppIcon />}
          onClick={sendReminder}
          sx={{
            fontWeight: 700,
            borderColor: "var(--color-success)",
            color: "var(--color-success)",
            "&:hover": {
              borderColor: "var(--color-success-dark)",
              backgroundColor: "rgba(34, 197, 94, 0.04)",
            },
          }}
        >
          WhatsApp Reminder
        </Button>
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Closing Balance (Due)"
            value={formatCurrency(currentDue)}
            color={currentDue > 0 ? "var(--color-warning)" : "var(--color-success)"}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Credit Limit"
            value={formatCurrency(creditLimit)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Available Credit"
            value={formatCurrency(creditAvailable)}
            color={creditAvailable > 0 ? "var(--color-success)" : "text.secondary"}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
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
              <LedgerStatement
                party={{
                  name: c?.shop_name || "",
                  code: c?.code,
                  owner: c?.owner_name,
                  phone: c?.phone,
                  address: c?.address,
                }}
                summary={summary}
                entries={ledger}
                onRefresh={refetch}
                compact
                portal
              />
            ) : (
              <ReturnsDashboard returns={returns} />
            )}
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <PaymentCard
            customerId={customerId}
            customerName={c?.shop_name || ""}
            closingBalance={currentDue}
            onRecorded={refetch}
            portal
          />
        </Grid>
      </Grid>

      <AppDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Party / Customer Details"
        actions={
          <Button
            type="button"
            variant="contained"
            className="gradient-button"
            disabled={updateCustomerMutation.isPending}
            onClick={handleSaveCustomer}
            startIcon={
              updateCustomerMutation.isPending ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
          >
            {updateCustomerMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        }
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Party Name / Customer Shop Name"
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
            label="Phone Number"
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
            label="Opening Balance (₹)"
            fullWidth
            value={editForm.opening_balance}
            onChange={(e) => setEditForm({ ...editForm, opening_balance: e.target.value })}
          />
          <TextField
            type="number"
            label="Credit Limit (₹)"
            fullWidth
            value={editForm.credit_limit}
            onChange={(e) => setEditForm({ ...editForm, credit_limit: e.target.value })}
          />
        </Stack>
      </AppDialog>
    </PageShell>
  );
}
