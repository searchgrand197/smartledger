import { Box, Button, Typography } from "@mui/material";
import { formatCurrency } from "@/utils/format";

interface Props {
  totalCustomers: number;
  outstandingCount: number;
  totalOutstanding: number;
  pageStart: number;
  pageEnd: number;
  totalFiltered: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export default function PartyFooterStats({
  totalCustomers,
  outstandingCount,
  totalOutstanding,
  pageStart,
  pageEnd,
  totalFiltered,
  page,
  pageCount,
  onPageChange,
}: Props) {
  return (
    <Box className="party-modal-footer">
      <Box className="party-footer-stats">
        <Box className="party-footer-stat">
          <div className="party-footer-stat__label">Total Customers</div>
          <div className="party-footer-stat__value">{totalCustomers}</div>
        </Box>
        <Box className="party-footer-stat party-footer-stat--warn">
          <div className="party-footer-stat__label">Outstanding Parties</div>
          <div className="party-footer-stat__value">{outstandingCount}</div>
        </Box>
        <Box className="party-footer-stat party-footer-stat--danger">
          <div className="party-footer-stat__label">Total Outstanding</div>
          <div className="party-footer-stat__value">{formatCurrency(totalOutstanding)}</div>
        </Box>
      </Box>

      <Box className="party-footer-pagination">
        <Typography component="span" variant="caption" fontWeight={700}>
          Showing {totalFiltered === 0 ? 0 : pageStart}–{pageEnd} of {totalFiltered}
        </Typography>
        {pageCount > 1 && (
          <>
            <Button size="small" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
              Prev
            </Button>
            <Button size="small" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>
              Next
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
