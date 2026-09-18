import { Box, Button, Stack, Typography } from "@mui/material";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export default function ListPagination({ page, pageSize, total, onPageChange, label = "entries" }: Props) {
  if (total <= pageSize) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const from = safePage * pageSize + 1;
  const to = Math.min((safePage + 1) * pageSize, total);

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        py: 1.5,
        px: { xs: 1, sm: 2 },
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary">
        {total} {label} · Showing {from}–{to} · Page {safePage + 1} of {pageCount}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" disabled={safePage <= 0} onClick={() => onPageChange(safePage - 1)}>
          Previous
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={safePage >= pageCount - 1}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </Button>
      </Stack>
    </Box>
  );
}
