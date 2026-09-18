import { Box, Typography, Button } from "@mui/material";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
  size?: "page" | "section";
}

export default function PageHeader({ title, subtitle, action, size = "page" }: PageHeaderProps) {
  const isPage = size === "page";

  return (
    <Box
      display="flex"
      flexDirection={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", sm: "center" }}
      gap={1.5}
      mb={isPage ? 2 : 1.5}
      className="page-header"
      sx={{ width: "100%", minWidth: 0, maxWidth: "100%" }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant={isPage ? "h5" : "subtitle1"} fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Box mt={0.5}>
            {typeof subtitle === "string" ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : (
              subtitle
            )}
          </Box>
        )}
      </Box>
      {action && (
        <Button
          variant="contained"
          className="gradient-button"
          startIcon={action.icon}
          onClick={action.onClick}
          sx={{ alignSelf: { xs: "stretch", sm: "center" }, flexShrink: 0 }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
