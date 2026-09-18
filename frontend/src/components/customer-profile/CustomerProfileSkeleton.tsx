import { Box, Skeleton } from "@mui/material";

export default function CustomerProfileSkeleton() {
  return (
    <Box>
      <Skeleton variant="rounded" className="cp-skeleton-header" animation="wave" />
      <Skeleton variant="rounded" height={48} sx={{ mb: 1.5, borderRadius: 3 }} animation="wave" />
      <Box className="cp-kpi-grid" sx={{ mb: 1.5 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" className="cp-skeleton-kpi" animation="wave" />
        ))}
      </Box>
      <Skeleton variant="rounded" height={400} animation="wave" sx={{ borderRadius: 3 }} />
    </Box>
  );
}
