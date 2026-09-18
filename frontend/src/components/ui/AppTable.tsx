import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  Box,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";

export interface TableColumn<T> {
  id: string;
  label: string;
  align?: "left" | "right" | "center";
  minWidth?: number;
  render?: (row: T, index: number) => React.ReactNode;
}

interface AppTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  getRowKey?: (row: T, index: number) => string | number;
  /** When set, shows pagination with this many rows per page (e.g. 10). */
  pageSize?: number;
}

export default function AppTable<T extends object>({
  columns,
  rows,
  emptyMessage = "No data",
  onRowClick,
  getRowKey,
  pageSize,
}: AppTableProps<T>) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [rows, pageSize]);

  const visibleRows = useMemo(() => {
    if (!pageSize || pageSize <= 0) return rows;
    const start = page * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const pageCount = pageSize && pageSize > 0 ? Math.ceil(rows.length / pageSize) : 1;

  useEffect(() => {
    if (page > 0 && page >= pageCount) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  const showPagination = Boolean(pageSize && pageSize > 0 && rows.length > 0);

  return (
    <Paper
      elevation={0}
      className="app-table"
      sx={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}
    >
      <TableContainer sx={{ overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.align || "left"}
                  sx={{
                    minWidth: col.minWidth,
                    bgcolor: "var(--color-table-header)",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    color: "var(--color-primary-dark)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Box py={5} textAlign="center" className="empty-state">
                    <InboxIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                    <Typography color="text.secondary">{emptyMessage}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row, index) => (
                <TableRow
                  key={getRowKey ? getRowKey(row, index) : index}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{
                    cursor: onRowClick ? "pointer" : "default",
                    transition: "background-color 0.15s ease",
                    "&:nth-of-type(even)": { bgcolor: "rgba(37, 99, 235, 0.02)" },
                  }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align || "left"}>
                      {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.id] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {showPagination && pageSize && (
        <TablePagination
          component="div"
          className="app-table-pagination"
          count={rows.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
          labelRowsPerPage="Per page"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
          sx={{
            borderTop: "1px solid var(--color-border)",
            ".MuiTablePagination-toolbar": { flexWrap: "wrap", gap: 0.5, px: { xs: 1, sm: 2 } },
            ".MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows": {
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
            },
          }}
        />
      )}
    </Paper>
  );
}
