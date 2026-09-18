import { Card, CardContent, Box, Typography } from "@mui/material";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
}

export default function StatCard({ title, value, icon, color = "var(--color-primary)" }: StatCardProps) {
  return (
    <Card className="stat-card">
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Box display="flex" alignItems="center" gap={2}>
          {icon && (
            <Box
              className="stat-card-icon"
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: color,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {icon}
            </Box>
          )}
          <Box minWidth={0}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} letterSpacing={0.3}>
              {title}
            </Typography>
            <Typography variant="h6" fontWeight={800} noWrap title={String(value)}>
              {value}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
