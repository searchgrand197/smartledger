import {
  Box,
  IconButton,
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
import DeleteIcon from "@mui/icons-material/Delete";
import { formatCurrency } from "@/utils/format";
import { integerNumberFieldProps } from "@/utils/numberField";

export type ReturnLineItem = {
  bill_item_id: number;
  product_id: number;
  product_name: string;
  product_code?: string;
  sold_quantity: number;
  returned_quantity: number;
  returnable_quantity: number;
  rate: number | string;
  return_qty: number;
  reason: string;
};

interface Props {
  items: ReturnLineItem[];
  onUpdateQty: (billItemId: number, qty: number) => void;
  onRemoveLine: (billItemId: number) => void;
  /** Nested inside bill accordion — no outer flex stretch */
  embedded?: boolean;
}

export default function ReturnLineTable({ items, onUpdateQty, onRemoveLine, embedded }: Props) {
  const activeItems = items.filter((i) => i.returnable_quantity > 0);

  if (!activeItems.length) {
    return (
      <Box className="billing-line-table billing-line-table--empty" sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">No returnable items on this bill</Typography>
      </Box>
    );
  }

  return (
    <TableContainer
      className="billing-line-table billing-erp-table-wrap"
      sx={embedded ? { maxHeight: 320, overflow: "auto" } : { flex: 1, minHeight: 0 }}
    >
      <Table size="small" stickyHeader={!embedded} className="billing-erp-table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40 }}>#</TableCell>
            <TableCell>PRODUCT</TableCell>
            <TableCell align="right">SOLD</TableCell>
            <TableCell align="right">RETURNED</TableCell>
            <TableCell align="right">RETURNABLE</TableCell>
            <TableCell align="right" sx={{ width: 100 }}>
              QTY
            </TableCell>
            <TableCell align="right">RATE</TableCell>
            <TableCell align="right">AMOUNT</TableCell>
            <TableCell sx={{ width: 48 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {activeItems.map((item, idx) => {
            const amount = item.return_qty * Number(item.rate);
            const hasQty = item.return_qty > 0;
            return (
              <TableRow
                key={item.bill_item_id}
                className={hasQty ? "billing-erp-table__row--active" : undefined}
                sx={{ "&:hover": { bgcolor: "action.hover" } }}
              >
                <TableCell>{idx + 1}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {item.product_name}
                  </Typography>
                  {item.product_code && (
                    <Typography variant="caption" color="text.secondary">
                      {item.product_code}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{item.sold_quantity}</TableCell>
                <TableCell align="right">{item.returned_quantity}</TableCell>
                <TableCell align="right">{item.returnable_quantity}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                    <TextField
                      type="number"
                      size="small"
                      value={item.return_qty || ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          onUpdateQty(item.bill_item_id, 0);
                          return;
                        }
                        const n = Math.min(Math.max(0, parseInt(raw, 10) || 0), item.returnable_quantity);
                        onUpdateQty(item.bill_item_id, n);
                      }}
                      {...integerNumberFieldProps(0, item.returnable_quantity)}
                      sx={{ width: 72, "& .MuiInputBase-input": { textAlign: "center", py: 0.75 } }}
                    />
                  </Stack>
                </TableCell>
                <TableCell align="right">{formatCurrency(Number(item.rate))}</TableCell>
                <TableCell align="right">
                  <Typography fontWeight={800} color={hasQty ? "primary.main" : "text.secondary"}>
                    {formatCurrency(amount)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {hasQty && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onRemoveLine(item.bill_item_id)}
                      aria-label="clear return qty"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
