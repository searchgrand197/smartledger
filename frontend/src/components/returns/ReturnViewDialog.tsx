import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import { returnsApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { AppDialog, LoadingState } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { openReturnPrintWindow } from "@/utils/print";
import toast from "react-hot-toast";

type ReturnDetail = {
  id: number;
  return_number: string;
  return_date: string;
  original_bill_number: string;
  customer_name: string;
  return_type_label: string;
  refund_mode_label: string;
  refund_detail?: string;
  total: number | string;
  refund_paid?: number | string;
  notes?: string;
  created_by_name?: string;
  is_cancelled?: boolean;
  items?: {
    product_name?: string;
    quantity: number;
    original_rate: number | string;
    amount?: number | string;
    reason?: string;
  }[];
};

interface Props {
  returnId: number | null;
  open: boolean;
  onClose: () => void;
  portal?: boolean;
}

export default function ReturnViewDialog({ returnId, open, onClose, portal = false }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["return", returnId, portal ? "portal" : "wholesale"],
    queryFn: () => {
      if (portal) {
        return portalApi.getReturn(returnId!).then((r) => r.data as ReturnDetail);
      }
      return returnsApi.get(returnId!).then((r) => r.data as ReturnDetail);
    },
    enabled: open && !!returnId,
  });

  const handlePrint = () => {
    if (!returnId) return;
    const opened = openReturnPrintWindow(returnId, { portal });
    if (!opened) toast.error("Allow pop-ups to print the return receipt");
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={data ? `Return ${data.return_number}` : "Return details"}
      maxWidth="md"
      actions={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="contained"
            className="gradient-button"
            startIcon={<PrintIcon />}
            disabled={!data}
            onClick={handlePrint}
          >
            Print
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading return…" />
      ) : error || !data ? (
        <Typography color="error">Could not load return</Typography>
      ) : (
        <Stack spacing={2}>
          {data.is_cancelled ? <Chip label="Cancelled" color="error" size="small" sx={{ alignSelf: "flex-start" }} /> : null}
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={1}>
            <Typography variant="body2">
              <strong>Customer:</strong> {data.customer_name}
            </Typography>
            <Typography variant="body2">
              <strong>Date:</strong> {formatDate(data.return_date)}
            </Typography>
            <Typography variant="body2">
              <strong>Original bill:</strong> {data.original_bill_number}
            </Typography>
            <Typography variant="body2">
              <strong>Type:</strong> {data.return_type_label}
            </Typography>
            <Typography variant="body2">
              <strong>Settlement:</strong> {data.refund_mode_label}
            </Typography>
            {data.created_by_name ? (
              <Typography variant="body2">
                <strong>Processed by:</strong> {data.created_by_name}
              </Typography>
            ) : null}
          </Box>
          {data.notes ? (
            <Typography variant="body2" color="text.secondary">
              {data.notes}
            </Typography>
          ) : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.items || []).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(item.original_rate)}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.amount ?? Number(item.original_rate) * item.quantity)}
                    </TableCell>
                    <TableCell>{item.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack alignItems="flex-end" spacing={0.5}>
            <Typography variant="h6" fontWeight={800}>
              Return total: {formatCurrency(data.total)}
            </Typography>
            {Number(data.refund_paid) > 0 && (
              <Typography variant="body2" color="error.main">
                Refund paid: {formatCurrency(data.refund_paid)}
              </Typography>
            )}
          </Stack>
        </Stack>
      )}
    </AppDialog>
  );
}
