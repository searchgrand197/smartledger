import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import {
  Autocomplete,
  Box,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import { portalApi } from "@/api/portal";
import ReturnBillPickerPanel, { type ReturnBillRow } from "@/components/returns/ReturnBillPickerPanel";
import ReturnFooter from "@/components/returns/ReturnFooter";
import ReturnRefundDialog from "@/components/returns/ReturnRefundDialog";
import ReturnCartPreviewDialog from "@/components/returns/ReturnCartPreviewDialog";
import { useReturnPage } from "@/hooks/useReturnPage";
import { formatCurrency } from "@/utils/format";

type PortalCustomerRow = {
  id: number;
  code: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  current_due: number;
};

export default function SimpleReturn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const billParam = Number(searchParams.get("bill")) || null;
  const customerParam = searchParams.get("customer") || "";
  const billParamLoaded = useRef(false);

  const [customerOptions, setCustomerOptions] = useState<PortalCustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<PortalCustomerRow | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [billOptions, setBillOptions] = useState<ReturnBillRow[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);

  const portalPartyKey = selectedCustomer?.id
    ? `id:${selectedCustomer.id}`
    : customerSearch.trim();

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
  } = useReturnPage({ portal: true, partyKey: portalPartyKey });

  const customerBalance =
    Object.values(sessions)[0]?.eligibility.customer_due != null
      ? Number(Object.values(sessions)[0].eligibility.customer_due)
      : selectedCustomer?.current_due;

  const handleCustomerSearch = async (q: string) => {
    setCustomerSearch(q);
    const { data } = await portalApi.customers({ search: q });
    setCustomerOptions(data as PortalCustomerRow[]);
  };

  const loadBillsForCustomer = useCallback(async () => {
    const searchTerm = selectedCustomer
      ? selectedCustomer.shop_name
      : customerSearch.trim();
    if (!searchTerm) {
      setBillOptions([]);
      return;
    }
    setLoadingBills(true);
    try {
      const { data } = await portalApi.quickSaleHistory(searchTerm);
      setBillOptions(
        (data as ReturnBillRow[]).map((row) => ({
          ...row,
          customer_name: row.walk_in_name,
        }))
      );
    } catch {
      toast.error("Could not load bills");
      setBillOptions([]);
    } finally {
      setLoadingBills(false);
    }
  }, [selectedCustomer, customerSearch]);

  useEffect(() => {
    void handleCustomerSearch("");
  }, []);

  useEffect(() => {
    if (!customerParam) return;
    setCustomerSearch(customerParam);
    void handleCustomerSearch(customerParam);
  }, [customerParam]);

  useEffect(() => {
    if (!billParam || billParamLoaded.current) return;
    billParamLoaded.current = true;
    void (async () => {
      const elig = await loadEligibility(billParam);
      if (!elig) return;
      setExpandedBillId(billParam);
      setBillOptions((prev) => {
        if (prev.some((b) => b.id === billParam)) return prev;
        return [
          {
            id: billParam,
            bill_number: elig.bill_number,
            walk_in_name: elig.customer_name,
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
  }, [billParam, loadEligibility, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedCustomer || customerSearch.trim()) {
      void loadBillsForCustomer();
    } else {
      setBillOptions([]);
    }
  }, [selectedCustomer, customerSearch, loadBillsForCustomer]);

  const handleExpandBill = async (bill: ReturnBillRow) => {
    setExpandedBillId(bill.id);
    const session = await ensureBillSession(bill.id);
    if (!session) setExpandedBillId(null);
  };

  const clearAll = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setBillOptions([]);
    clearReturn();
    setExpandedBillId(null);
    void handleCustomerSearch("");
  };

  const hasCustomer = !!selectedCustomer || !!customerSearch.trim();
  const customerName =
    Object.values(sessions)[0]?.eligibility.customer_name ||
    selectedCustomer?.shop_name ||
    customerSearch.trim();

  return (
    <Box className="billing-workspace portal-billing-workspace animate-fade-in-up" sx={{ height: "100%", minHeight: 0 }}>
      <Box className="billing-top-bar">
        <Stack spacing={0} className="billing-top-bar__inner">
          <Box className="billing-top-bar__meta-row">
            <Box className="billing-top-bar__customer" sx={{ flex: 1, minWidth: 0, maxWidth: 420 }}>
              <Autocomplete
                freeSolo
                size="small"
                openOnFocus
                options={customerOptions}
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  return `${option.shop_name} (${option.phone})`;
                }}
                value={selectedCustomer}
                inputValue={customerSearch}
                onInputChange={(_, newValue) => {
                  void handleCustomerSearch(newValue);
                  clearReturn();
                  setExpandedBillId(null);
                }}
                onChange={(_, newValue) => {
                  if (typeof newValue === "string") {
                    setSelectedCustomer(null);
                  } else if (newValue && typeof newValue === "object") {
                    setSelectedCustomer(newValue);
                    setCustomerPhone(newValue.phone);
                  } else {
                    setSelectedCustomer(null);
                    setCustomerPhone("");
                  }
                  clearReturn();
                  setExpandedBillId(null);
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
                      },
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
          </Box>
          {customerBalance !== undefined && customerBalance > 0 && (
            <Typography variant="body2" fontWeight={700} sx={{ px: 1, color: "warning.dark" }}>
              Customer balance: {formatCurrency(customerBalance)}
            </Typography>
          )}
        </Stack>
      </Box>

      <Box className="billing-main-area" sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {!hasCustomer ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
            <Typography color="text.secondary" textAlign="center">
              Select or type a customer — expand a bill below to enter return items
            </Typography>
          </Box>
        ) : (
          <ReturnBillPickerPanel
            portal
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
            onRefresh={() => void loadBillsForCustomer()}
            partyLabel={selectedCustomer?.shop_name || customerSearch.trim()}
          />
        )}
      </Box>

      <ReturnFooter
        returnType={returnType}
        refundMode={refundMode}
        itemCount={itemCount}
        billCount={billCount}
        total={returnTotal}
        partyBalance={customerBalance}
        hasItems={itemCount > 0}
        notes={notes}
        onNotesChange={setNotes}
        onOpenSettlement={openSettlement}
        onPreview={() => setCartPreviewOpen(true)}
        onSave={() => requestSave(false)}
        onSaveAndPrint={() => requestSave(true)}
        onClear={clearAll}
        saving={saving}
      />

      <ReturnRefundDialog
        open={settlementOpen}
        onClose={closeSettlement}
        total={returnTotal}
        customerName={customerName}
        partyBalance={customerBalance}
        isPartyBill={isPartyBill}
        returnType={returnType}
        refundMode={refundMode}
        onConfirm={confirmSettlement}
        saving={saving}
        portal
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
