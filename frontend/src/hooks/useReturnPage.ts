import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { returnsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import type { ReturnLineItem } from "@/components/returns/ReturnLineTable";
import { openReturnPrintWindow } from "@/utils/print";

export type ReturnEligibility = {
  bill_id: number;
  bill_number: string;
  customer_name: string;
  customer_due?: number | string;
  bill_type: string;
  is_cancelled: boolean;
  items: {
    bill_item_id: number;
    product_id: number;
    product_name: string;
    product_code?: string;
    sold_quantity: number;
    returned_quantity: number;
    returnable_quantity: number;
    rate: number | string;
  }[];
};

export type BillReturnSession = {
  eligibility: ReturnEligibility;
  lines: ReturnLineItem[];
};

export type ReturnCartBill = {
  billId: number;
  billNumber: string;
  subtotal: number;
  items: ReturnLineItem[];
};

type ReturnDraft = {
  partyKey: string | number;
  sessions: Record<number, BillReturnSession>;
  notes: string;
  returnType: string;
  refundMode: string;
  expandedBillId: number | null;
};

function eligibilityToLines(
  eligibility: ReturnEligibility,
  previous?: ReturnLineItem[]
): ReturnLineItem[] {
  const prevMap = new Map((previous || []).map((l) => [l.bill_item_id, l]));
  return eligibility.items.map((item) => {
    const prev = prevMap.get(item.bill_item_id);
    const return_qty = prev
      ? Math.min(prev.return_qty, item.returnable_quantity)
      : 0;
    return {
      ...item,
      return_qty,
      reason: prev?.reason || "",
    };
  });
}

function applySettlementFromEligibility(elig: ReturnEligibility) {
  if (Number(elig.customer_due || 0) > 0 || elig.bill_type === "party") {
    return { returnType: "credit_note", refundMode: "ledger_credit" };
  }
  return { returnType: "refund", refundMode: "cash" };
}

function hasReturnWork(sessions: Record<number, BillReturnSession>, notes: string) {
  if (notes.trim()) return true;
  return Object.values(sessions).some((s) => s.lines.some((l) => l.return_qty > 0));
}

export function useReturnPage({
  portal = false,
  partyKey = "",
  onReturnSaved,
}: {
  portal?: boolean;
  partyKey?: string | number;
  onReturnSaved?: () => void;
}) {
  const draftKey = portal ? "return_draft_portal_v1" : "return_draft_wholesale_v1";
  const [sessions, setSessions] = useState<Record<number, BillReturnSession>>({});
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const [refundMode, setRefundMode] = useState("ledger_credit");
  const [returnType, setReturnType] = useState("refund");
  const [notes, setNotes] = useState("");
  const [loadingBillId, setLoadingBillId] = useState<number | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [pendingSaveWithPrint, setPendingSaveWithPrint] = useState<boolean | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);
  const partyKeyRef = useRef(partyKey);
  partyKeyRef.current = partyKey;

  const cartBills = useMemo((): ReturnCartBill[] => {
    return Object.values(sessions)
      .map((session) => {
        const items = session.lines.filter((l) => l.return_qty > 0);
        if (!items.length) return null;
        const subtotal = items.reduce((sum, l) => sum + l.return_qty * Number(l.rate), 0);
        return {
          billId: session.eligibility.bill_id,
          billNumber: session.eligibility.bill_number,
          subtotal,
          items,
        };
      })
      .filter((b): b is ReturnCartBill => b != null);
  }, [sessions]);

  const returnTotal = useMemo(
    () => cartBills.reduce((sum, b) => sum + b.subtotal, 0),
    [cartBills]
  );

  const itemCount = useMemo(
    () => cartBills.reduce((sum, b) => sum + b.items.length, 0),
    [cartBills]
  );

  const billCount = cartBills.length;

  const isPartyBill = useMemo(
    () => cartBills.some((b) => sessions[b.billId]?.eligibility.bill_type === "party"),
    [cartBills, sessions]
  );

  const clearDraftStorage = useCallback(() => {
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  const clearAll = useCallback(() => {
    setSessions({});
    setRefundMode("ledger_credit");
    setReturnType("refund");
    setNotes("");
    setSettlementOpen(false);
    setPendingSaveWithPrint(null);
    setExpandedBillId(null);
    clearDraftStorage();
  }, [clearDraftStorage]);

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) {
      setDraftRestored(true);
      return;
    }
    try {
      const d = JSON.parse(raw) as ReturnDraft;
      if (partyKey && String(d.partyKey) !== String(partyKey)) {
        setSessions({});
        setNotes("");
        setExpandedBillId(null);
      } else {
        setSessions(d.sessions || {});
        setNotes(d.notes || "");
        setReturnType(d.returnType || "refund");
        setRefundMode(d.refundMode || "ledger_credit");
        setExpandedBillId(d.expandedBillId ?? null);
      }
    } catch {
      clearDraftStorage();
    }
    setDraftRestored(true);
  }, [draftKey, partyKey, clearDraftStorage]);

  useEffect(() => {
    if (!draftRestored || !partyKey) return;
    if (!hasReturnWork(sessions, notes)) {
      clearDraftStorage();
      return;
    }
    const draft: ReturnDraft = {
      partyKey,
      sessions,
      notes,
      returnType,
      refundMode,
      expandedBillId,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    draftRestored,
    partyKey,
    sessions,
    notes,
    returnType,
    refundMode,
    expandedBillId,
    draftKey,
    clearDraftStorage,
  ]);

  const ensureBillSession = useCallback(
    async (billId: number): Promise<BillReturnSession | null> => {
      setLoadingBillId(billId);
      try {
        const { data } = portal
          ? await portalApi.billReturnEligibility(billId)
          : await returnsApi.eligibility(billId);
        const elig = data as ReturnEligibility;
        if (elig.is_cancelled) {
          toast.error("This bill is cancelled — returns are not allowed");
          return null;
        }
        const hasReturnable = elig.items.some((i) => i.returnable_quantity > 0);
        if (!hasReturnable) {
          toast.error("All items on this bill have already been returned");
          setSessions((prev) => {
            const next = { ...prev };
            delete next[billId];
            return next;
          });
          return null;
        }
        const previous = sessionsRef.current[billId]?.lines;
        const session: BillReturnSession = {
          eligibility: elig,
          lines: eligibilityToLines(elig, previous),
        };
        setSessions((prev) => ({ ...prev, [billId]: session }));
        const settlement = applySettlementFromEligibility(elig);
        if (Object.keys(sessionsRef.current).length <= 1) {
          setReturnType(settlement.returnType);
          setRefundMode(settlement.refundMode);
        }
        return session;
      } catch {
        toast.error("Could not load bill for return");
        return null;
      } finally {
        setLoadingBillId(null);
      }
    },
    [portal]
  );

  const getLinesForBill = useCallback(
    (billId: number) => sessions[billId]?.lines || [],
    [sessions]
  );

  const billHasReturnItems = useCallback(
    (billId: number) => (sessions[billId]?.lines || []).some((l) => l.return_qty > 0),
    [sessions]
  );

  const updateQty = (billId: number, billItemId: number, qty: number) => {
    setSessions((prev) => {
      const session = prev[billId];
      if (!session) return prev;
      return {
        ...prev,
        [billId]: {
          ...session,
          lines: session.lines.map((l) =>
            l.bill_item_id === billItemId ? { ...l, return_qty: qty } : l
          ),
        },
      };
    });
  };

  const removeLine = (billId: number, billItemId: number) => {
    setSessions((prev) => {
      const session = prev[billId];
      if (!session) return prev;
      return {
        ...prev,
        [billId]: {
          ...session,
          lines: session.lines.map((l) =>
            l.bill_item_id === billItemId ? { ...l, return_qty: 0, reason: "" } : l
          ),
        },
      };
    });
  };

  const createReturns = useMutation({
    mutationFn: async ({
      withPrint,
      mode,
      type,
      bills,
    }: {
      withPrint: boolean;
      mode: string;
      type: string;
      bills: ReturnCartBill[];
    }) => {
      const payload = {
        return_type: type,
        refund_mode: mode,
        notes,
        bills: bills.map((bill) => ({
          bill_id: bill.billId,
          items: bill.items.map((l) => ({
            bill_item_id: l.bill_item_id,
            quantity: l.return_qty,
            reason: l.reason,
          })),
        })),
      };
      const apiCall = portal ? portalApi.createReturn(payload) : returnsApi.create(payload);
      const res = await apiCall;
      return { res, withPrint };
    },
    onSuccess: ({ res, withPrint }) => {
      const data = res.data as { return_number: string; id: number; whatsapp?: { status?: string; sent_via?: string; reason?: string; detail?: string } };
      toast.success(`Return ${data.return_number} created`);
      if (data.whatsapp?.status === "success" || data.whatsapp?.sent_via) {
        toast.success("Return receipt queued for WhatsApp");
      } else if (data.whatsapp?.status === "skipped") {
        toast(`WhatsApp skipped: ${data.whatsapp.reason || "No phone"}`, { icon: "ℹ️" });
      }
      if (withPrint) {
        const opened = openReturnPrintWindow(data.id, { portal });
        if (!opened) toast.error("Allow pop-ups to print return receipt");
      }
      clearAll();
      onReturnSaved?.();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Could not create return");
    },
  });

  const validateCart = () => {
    if (cartBills.length === 0) {
      toast.error("Enter return quantity for at least one item");
      return false;
    }
    for (const session of Object.values(sessions)) {
      const exceeds = session.lines.some((l) => l.return_qty > l.returnable_quantity);
      if (exceeds) {
        toast.error(`Return quantity exceeds limit on bill ${session.eligibility.bill_number}`);
        return false;
      }
    }
    return true;
  };

  const requestSave = (withPrint: boolean) => {
    if (!validateCart()) return;
    setPendingSaveWithPrint(withPrint);
    setSettlementOpen(true);
  };

  const openSettlement = () => {
    if (!validateCart()) return;
    setPendingSaveWithPrint(null);
    setSettlementOpen(true);
  };

  const confirmSettlement = (type: string, mode: string) => {
    setReturnType(type);
    setRefundMode(mode);
    setSettlementOpen(false);
    const withPrint = pendingSaveWithPrint ?? false;
    setPendingSaveWithPrint(null);
    createReturns.mutate({ withPrint, mode, type, bills: cartBills });
  };

  const closeSettlement = () => {
    if (createReturns.isPending) return;
    setSettlementOpen(false);
    setPendingSaveWithPrint(null);
  };

  const loadEligibility = useCallback(
    async (billId: number) => {
      const session = await ensureBillSession(billId);
      return session?.eligibility ?? null;
    },
    [ensureBillSession]
  );

  return {
    sessions,
    cartBills,
    refundMode,
    setRefundMode,
    returnType,
    setReturnType,
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
    draftRestored,
    ensureBillSession,
    getLinesForBill,
    billHasReturnItems,
    loadEligibility,
    updateQty,
    removeLine,
    clearAll,
    requestSave,
    openSettlement,
    confirmSettlement,
    closeSettlement,
    saving: createReturns.isPending,
  };
}
