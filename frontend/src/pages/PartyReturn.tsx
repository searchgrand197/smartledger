import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { useQuery } from "@tanstack/react-query";
import { billingApi, customersApi } from "@/api/services";
import PartyPickerDialog from "@/components/billing/PartyPickerDialog";
import { AppOutlinedField } from "@/components/ui";
import ReturnBillPickerPanel, { type ReturnBillRow } from "@/components/returns/ReturnBillPickerPanel";
import ReturnFooter from "@/components/returns/ReturnFooter";
import ReturnRefundDialog from "@/components/returns/ReturnRefundDialog";
import ReturnCartPreviewDialog from "@/components/returns/ReturnCartPreviewDialog";
import { useReturnPage } from "@/hooks/useReturnPage";
import { formatCurrency } from "@/utils/format";
import type { Customer } from "@/types";

const LAST_PARTY_KEY = "return_last_customer_id";

export default function PartyReturn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const billParam = Number(searchParams.get("bill")) || null;
  const customerParam = Number(searchParams.get("customer")) || null;
  const billParamLoaded = useRef(false);
  const customerParamLoaded = useRef(false);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [billOptions, setBillOptions] = useState<ReturnBillRow[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [customerRestored, setCustomerRestored] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);
  const reloadBillsRef = useRef<() => void>(() => {});

  const {
    sessions,
    cartBills,
    refundMode,
    returnType,
    notes,
    setNotes,
    loadingBillId,
    settlementOpen,
    isPartyBill,
    returnTotal,
    itemCount,
    billCount,
    expandedBillId,
    setExpandedBillId,
    ensureBillSession,
    getLinesForBill,
    billHasReturnItems,
    loadEligibility,
    updateQty,
    removeLine,
    clearAll: clearReturn,
    requestSave,
    openSettlement,
    confirmSettlement,
    closeSettlement,
    saving,
  } = useReturnPage({
    portal: false,
    partyKey: customer?.id ?? "",
    onReturnSaved: () => reloadBillsRef.current(),
  });

  const { data: context } = useQuery({
    queryKey: ["billing-context-return", customer?.id],
    queryFn: () => billingApi.context(customer!.id).then((r) => r.data),
    enabled: !!customer,
  });

  const selectParty = (c: Customer) => {
    setCustomer(c);
    localStorage.setItem(LAST_PARTY_KEY, String(c.id));
    setPartyPickerOpen(false);
    clearReturn();
    setExpandedBillId(null);
  };

  useEffect(() => {
    if (!customerParam || customerParamLoaded.current) return;
    customerParamLoaded.current = true;
    customersApi
      .get(customerParam)
      .then((r) => {
        const c = r.data as Customer;
        setCustomer(c);
        localStorage.setItem(LAST_PARTY_KEY, String(c.id));
        setCustomerRestored(true);
      })
      .catch(() => setCustomerRestored(true));
  }, [customerParam]);

  useEffect(() => {
    const saved = localStorage.getItem(LAST_PARTY_KEY);
    if (customerParam) return;
    if (!saved) {
      setCustomerRestored(true);
      return;
    }
    customersApi
      .get(Number(saved))
      .then((r) => setCustomer(r.data as Customer))
      .catch(() => localStorage.removeItem(LAST_PARTY_KEY))
      .finally(() => setCustomerRestored(true));
  }, [customerParam]);

  useEffect(() => {
    if (!billParam || billParamLoaded.current) return;
    billParamLoaded.current = true;
    void (async () => {
      if (!customer && customerParam) {
        try {
          const custRes = await customersApi.get(customerParam);
          const c = custRes.data as Customer;
          setCustomer(c);
          localStorage.setItem(LAST_PARTY_KEY, String(c.id));
          setCustomerRestored(true);
        } catch {
          /* load bill anyway */
        }
      }
      if (!customer) {
        try {
          const billRes = await billingApi.get(billParam);
          const bill = billRes.data as { customer?: number };
          if (bill.customer) {
            const custRes = await customersApi.get(bill.customer);
            const c = custRes.data as Customer;
            setCustomer(c);
            localStorage.setItem(LAST_PARTY_KEY, String(c.id));
            setCustomerRestored(true);
          }
        } catch {
          /* continue */
        }
      }
      const elig = await loadEligibility(billParam);
      if (!elig) return;
      setExpandedBillId(billParam);
      setBillOptions((prev) => {
        if (prev.some((b) => b.id === billParam)) return prev;
        return [
          {
            id: billParam,
            bill_number: elig.bill_number,
            customer_name: elig.customer_name,
            total: 0,
            created_at: "",
          },
          ...prev,
        ];
      });
      if (searchParams.get("bill")) {
        const next = new URLSearchParams(searchParams);
        next.delete("bill");
        setSearchParams(next, { replace: true });
      }
    })();
  }, [billParam, customer, customerParam, loadEligibility, searchParams, setSearchParams]);

  const loadBillsForParty = useCallback(async () => {
    if (!customer) {
      toast.error("Select party first (F3)");
      return;
    }
    setLoadingBills(true);
    try {
      const { data } = await billingApi.list({ customer: String(customer.id), for_return: "1" });
      const rows = (data.results || data) as ReturnBillRow[];
      setBillOptions(rows);
    } catch {
      toast.error("Could not load bills for party");
      setBillOptions([]);
    } finally {
      setLoadingBills(false);
    }
  }, [customer]);

  reloadBillsRef.current = () => {
    if (customer) void loadBillsForParty();
  };

  useEffect(() => {
    if (customer) void loadBillsForParty();
    else setBillOptions([]);
  }, [customer, loadBillsForParty]);

  useEffect(() => {
    if (!customerRestored) return;
    if (!customer) setPartyPickerOpen(true);
  }, [customerRestored, customer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        setPartyPickerOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleExpandBill = async (bill: ReturnBillRow) => {
    setExpandedBillId(bill.id);
    const session = await ensureBillSession(bill.id);
    if (!session) setExpandedBillId(null);
  };

  const clearAll = () => {
    setCustomer(null);
    localStorage.removeItem(LAST_PARTY_KEY);
    setBillOptions([]);
    clearReturn();
    setExpandedBillId(null);
    setPartyPickerOpen(true);
  };

  const partyBalance = context?.outstanding_balance as number | undefined;
  const customerName =
    customer?.shop_name || Object.values(sessions)[0]?.eligibility.customer_name || "";

  return (
    <Box className="billing-workspace animate-fade-in-up" sx={{ height: "100%", minHeight: 0 }}>
      <Box className="billing-top-bar">
        <Stack spacing={0} className="billing-top-bar__inner">
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
                id="return-party-search"
                label="PARTY"
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
                        localStorage.removeItem(LAST_PARTY_KEY);
                        clearReturn();
                        setBillOptions([]);
                        setExpandedBillId(null);
                        setPartyPickerOpen(true);
                      }
                    : undefined
                }
                icon={<PersonIcon fontSize="small" />}
                disableBrowserAutocomplete
              />
            </Box>
          </Box>
          {partyBalance !== undefined && customer && (
            <Typography variant="body2" fontWeight={700} sx={{ px: 1 }}>
              Party balance: {formatCurrency(partyBalance)}
            </Typography>
          )}
        </Stack>
      </Box>

      <Box className="billing-main-area" sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {!customer ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
            <Typography color="text.secondary" textAlign="center">
              Select a party (F3) — expand a bill below to enter return items
            </Typography>
          </Box>
        ) : (
          <ReturnBillPickerPanel
            bills={billOptions}
            loading={loadingBills}
            expandedBillId={expandedBillId}
            loadingBillId={loadingBillId}
            getLinesForBill={getLinesForBill}
            hasSession={(id) => !!sessions[id]}
            billHasReturnItems={billHasReturnItems}
            onExpandedBillChange={setExpandedBillId}
            onExpandBill={(bill) => void handleExpandBill(bill)}
            onUpdateQty={updateQty}
            onRemoveLine={removeLine}
            onRefresh={() => void loadBillsForParty()}
            partyLabel={customer.shop_name}
          />
        )}
      </Box>

      <ReturnFooter
        returnType={returnType}
        refundMode={refundMode}
        itemCount={itemCount}
        billCount={billCount}
        total={returnTotal}
        partyBalance={partyBalance}
        hasItems={itemCount > 0}
        notes={notes}
        onNotesChange={setNotes}
        onOpenSettlement={() => {
          if (!customer) {
            toast.error("Select party first");
            return;
          }
          openSettlement();
        }}
        onPreview={() => setCartPreviewOpen(true)}
        onSave={() => requestSave(false)}
        onSaveAndPrint={() => requestSave(true)}
        onClear={clearAll}
        saving={saving}
      />

      <PartyPickerDialog
        open={partyPickerOpen}
        onClose={() => setPartyPickerOpen(false)}
        onSelect={selectParty}
        selectedId={customer?.id}
      />

      <ReturnRefundDialog
        open={settlementOpen}
        onClose={closeSettlement}
        total={returnTotal}
        customerName={customerName}
        partyBalance={partyBalance}
        isPartyBill={isPartyBill}
        returnType={returnType}
        refundMode={refundMode}
        onConfirm={confirmSettlement}
        saving={saving}
      />

      <ReturnCartPreviewDialog
        open={cartPreviewOpen}
        onClose={() => setCartPreviewOpen(false)}
        bills={cartBills}
        total={returnTotal}
        itemCount={itemCount}
      />
    </Box>
  );
}
