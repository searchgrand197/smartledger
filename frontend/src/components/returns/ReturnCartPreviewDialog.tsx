import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AppDialog } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import type { ReturnCartBill } from "@/hooks/useReturnPage";

interface Props {
  open: boolean;
  onClose: () => void;
  bills: ReturnCartBill[];
  total: number;
  itemCount: number;
}

export default function ReturnCartPreviewDialog({ open, onClose, bills, total, itemCount }: Props) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Return preview"
      maxWidth="md"
      actions={<Button onClick={onClose}>Close</Button>}
    >
      {bills.length === 0 ? (
        <Typography color="text.secondary" py={2}>
          No return items selected yet. Expand bills above and enter quantities.
        </Typography>
      ) : (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {itemCount} item(s) across {bills.length} bill(s)
          </Typography>
          {bills.map((bill) => (
            <Box key={bill.billId}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75 }}>
                {bill.billNumber}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  {formatCurrency(bill.subtotal)}
                </Typography>
              </Typography>
              <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      {bills.length > 1 && <TableCell>Invoice</TableCell>}
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bill.items.map((item) => (
                      <TableRow key={`${bill.billId}-${item.bill_item_id}`}>
                        <TableCell>{item.product_name}</TableCell>
                        {bills.length > 1 && <TableCell>{bill.billNumber}</TableCell>}
                        <TableCell align="right">{item.return_qty}</TableCell>
                        <TableCell align="right">{formatCurrency(Number(item.rate))}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatCurrency(item.return_qty * Number(item.rate))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
          <Stack direction="row" justifyContent="flex-end">
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "#fff",
                minWidth: 120,
                textAlign: "center",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9 }}>
                TOTAL
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
                {formatCurrency(total)}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      )}
    </AppDialog>
  );
}
