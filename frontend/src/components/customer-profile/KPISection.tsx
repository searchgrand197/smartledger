import { Box } from "@mui/material";
import { formatCurrency, formatDate } from "@/utils/format";

interface Props {
  currentDue: number;
  totalSales: number;
  billCount: number;
  lastPurchaseDate?: string | null;
}

export default function KPISection({ currentDue, totalSales, billCount, lastPurchaseDate }: Props) {
  const dueZero = currentDue <= 0;

  return (
    <Box className="cp-kpi-grid">
      <Box className={`cp-kpi cp-kpi--due${dueZero ? "-zero" : ""}`}>
        <div className="cp-kpi__label">Outstanding Balance</div>
        <div className="cp-kpi__value">{formatCurrency(currentDue)}</div>
      </Box>
      <Box className="cp-kpi cp-kpi--sales">
        <div className="cp-kpi__label">Total Sales</div>
        <div className="cp-kpi__value">{formatCurrency(totalSales)}</div>
      </Box>
      <Box className="cp-kpi cp-kpi--neutral">
        <div className="cp-kpi__label">Total Bills</div>
        <div className="cp-kpi__value">{billCount}</div>
      </Box>
      <Box className="cp-kpi cp-kpi--neutral">
        <div className="cp-kpi__label">Last Purchase</div>
        <div className="cp-kpi__value" style={{ fontSize: "0.9375rem" }}>
          {lastPurchaseDate ? formatDate(lastPurchaseDate) : "—"}
        </div>
      </Box>
    </Box>
  );
}
