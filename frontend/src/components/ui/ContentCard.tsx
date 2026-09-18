import { Card, CardContent, Stack, Typography, Box } from "@mui/material";

interface Props {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}

export default function ContentCard({ title, subtitle, action, children, noPadding }: Props) {
  return (
    <Card className="content-card">
      {(title || action) && (
        <CardContent sx={{ pb: subtitle ? 0.5 : 1.5, pt: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box>
              {title && (
                <Typography variant="subtitle1" fontWeight={700}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action}
          </Stack>
        </CardContent>
      )}
      <CardContent sx={noPadding ? { p: 0, "&:last-child": { pb: 0 } } : { pt: title ? 0 : 2 }}>
        {children}
      </CardContent>
    </Card>
  );
}
