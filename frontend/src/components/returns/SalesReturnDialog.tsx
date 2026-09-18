import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { returnsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { AppDialog, LoadingState } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { openReturnPrintWindow } from "@/utils/print";

type EligibilityItem = {
  bill_item_id: number;
  product_id: number;
  product_name: string;
  sold_quantity: number;
  returned_quantity: number;
  returnable_quantity: number;
  rate: number | string;
};

type Eligibility = {
  bill_id: number;
  bill_number: string;
  customer_name: string;
  customer_due?: number | string;
  bill_type: string;
  is_cancelled: boolean;
  items: EligibilityItem[];
};

interface Props {
  billId: number | null;
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  portal?: boolean;
}

const RETURN_TYPES = [
  { value: "refund", label: "Refund" },
  { value: "credit_note", label: "Credit Note" },
  { value: "exchange", label: "Exchange" },
];

const REFUND_MODES_PARTY = [
  { value: "ledger_credit", label: "Ledger Credit" },
  { value: "cash", label: "Cash Refund" },
  { value: "upi", label: "UPI Refund" },
];
const REFUND_MODES_RETAIL = [
  { value: "cash", label: "Cash Refund" },
  { value: "upi", label: "UPI Refund" },
  { value: "store_credit", label: "Store Credit" },
];

export default function SalesReturnDialog({ billId, open, onClose, onCreated, portal = false }: Props) {
  const queryClient = useQueryClient();
  const [returnType, setReturnType] = useState("refund");
  const [refundMode, setRefundMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [reasonMap, setReasonMap] = useState<Record<number, string>>({});

  const { data: eligibility, isLoading, error, refetch } = useQuery({
    queryKey: ["return-eligibility", billId, portal ? "portal" : "wholesale"],
    queryFn: () => {
      if (portal) {
        return portalApi.billReturnEligibility(billId!).then((r) => r.data as Eligibility);
      }
      return returnsApi.eligibility(billId!).then((r) => r.data as Eligibility);
    },
    enabled: open && !!billId,
  });

  useEffect(() => {
    if (!open) {
      setReturnType("refund");
      setRefundMode("cash");
      setNotes("");
      setQtyMap({});
      setReasonMap({});
    }
  }, [open]);

  useEffect(() => {
    if (eligibility?.bill_type === "party") {
      setRefundMode("ledger_credit");
      if (returnType === "refund") setReturnType("credit_note");
    }
  }, [eligibility?.bill_type, returnType]);

  const returnTotal = useMemo(() => {
    if (!eligibility) return 0;
    return eligibility.items.reduce((sum, item) => {
      const q = Number(qtyMap[item.bill_item_id] || 0);
      return sum + q * Number(item.rate);
    }, 0);
  }, [eligibility, qtyMap]);

  const createReturn = useMutation({
    mutationFn: (variables?: { overrideRefundMode?: string }) => {
      const items = (eligibility?.items || [])
        .map((item) => ({
          bill_item_id: item.bill_item_id,
          quantity: Number(qtyMap[item.bill_item_id] || 0),
          reason: reasonMap[item.bill_item_id] || "",
        }))
        .filter((row) => row.quantity > 0);

      const payload = {
        bill_id: billId,
        return_type: returnType,
        refund_mode: variables?.overrideRefundMode || refundMode,
        notes,
        items,
      };

      if (portal) {
        return portalApi.createReturn(payload);
      }
      return returnsApi.create(payload);
    },
    onSuccess: (res) => {
      toast.success(`Return ${res.data.return_number} created`);
      void queryClient.invalidateQueries({ queryKey: ["bill", billId] });
      void queryClient.invalidateQueries({ queryKey: ["return-eligibility", billId] });
      void queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onCreated?.();
      const opened = openReturnPrintWindow(res.data.id, { portal });
      if (!opened) toast.error("Allow pop-ups to print return receipt");
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Could not create return");
    },
  });

  const refundModes =
    eligibility?.bill_type === "party" ? REFUND_MODES_PARTY : REFUND_MODES_RETAIL;

  const hasReturnable = (eligibility?.items || []).some((i) => i.returnable_quantity > 0);

  const handleSave = () => {
    if (
      eligibility?.bill_type === "party" &&
      refundMode !== "ledger_credit" &&
      Number(eligibility.customer_due || 0) > 0
    ) {
      const confirmAdjust = window.confirm(
        `This party has pending dues of ${formatCurrency(Number(eligibility.customer_due))}.\n\nDo you want to adjust this return against their pending dues (Ledger Credit) instead of paying Cash/UPI?\n\nClick "OK" to adjust (Ledger Credit)\nClick "Cancel" to continue with Cash/UPI refund.`
      );
      if (confirmAdjust) {
        createReturn.mutate({ overrideRefundMode: "ledger_credit" });
        return;
      }
    }
    createReturn.mutate(undefined);
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={eligibility ? `Create Return — ${eligibility.bill_number}` : "Create Return"}
      maxWidth="md"
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            className="gradient-button"
            disabled={!hasReturnable || createReturn.isPending || returnTotal <= 0}
            onClick={handleSave}
          >
            {createReturn.isPending ? "Saving…" : "Save Return"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading bill items…" />
      ) : error || !eligibility ? (
        <Typography color="error">Could not load return eligibility</Typography>
      ) : eligibility.is_cancelled ? (
        <Typography color="error">This bill is cancelled — returns are not allowed.</Typography>
      ) : !hasReturnable ? (
        <Typography color="text.secondary">All items on this bill have already been returned.</Typography>
      ) : (
        <Stack spacing={2}>
          <Typography variant="body2">
            <strong>Customer:</strong> {eligibility.customer_name}
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Return type"
              size="small"
              fullWidth
              value={returnType}
              onChange={(e) => setReturnType(e.target.value)}
            >
              {RETURN_TYPES.filter((t) =>
                eligibility.bill_type === "party" ? t.value !== "refund" : true
              ).map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            {returnType !== "exchange" && (
              <TextField
                select
                label="Settlement"
                size="small"
                fullWidth
                value={refundMode}
                onChange={(e) => setRefundMode(e.target.value)}
              >
                {refundModes.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>

          {returnType === "exchange" && (
            <Typography variant="body2" color="text.secondary">
              Exchange difference is calculated automatically. Save this return first, then create a new sale for
              replacement items if needed.
            </Typography>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">Sold</TableCell>
                  <TableCell align="right">Returned</TableCell>
                  <TableCell align="right">Returnable</TableCell>
                  <TableCell align="right">Return Qty</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {eligibility.items.map((item) => (
                  <TableRow key={item.bill_item_id}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell align="right">{item.sold_quantity}</TableCell>
                    <TableCell align="right">{item.returned_quantity}</TableCell>
                    <TableCell align="right">{item.returnable_quantity}</TableCell>
                    <TableCell align="right" sx={{ width: 90 }}>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, max: item.returnable_quantity }}
                        disabled={item.returnable_quantity <= 0}
                        value={qtyMap[item.bill_item_id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const n = v === "" ? "" : String(Math.min(Number(v), item.returnable_quantity));
                          setQtyMap((m) => ({ ...m, [item.bill_item_id]: n }));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Optional"
                        fullWidth
                        value={reasonMap[item.bill_item_id] ?? ""}
                        onChange={(e) =>
                          setReasonMap((m) => ({ ...m, [item.bill_item_id]: e.target.value }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TextField
            label="Notes"
            multiline
            minRows={2}
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Box textAlign="right">
            <Typography variant="h6" fontWeight={800}>
              Return total: {formatCurrency(returnTotal)}
            </Typography>
          </Box>

          <Button size="small" onClick={() => void refetch()}>
            Refresh returnable qty
          </Button>
        </Stack>
      )}
    </AppDialog>
  );
}
