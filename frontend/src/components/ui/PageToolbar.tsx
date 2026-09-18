import { Box, Button } from "@mui/material";
import SearchField from "./SearchField";

interface PageToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
}

/** Search + primary action on one row (list pages). */
export default function PageToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  action,
}: PageToolbarProps) {
  return (
    <Box className="page-toolbar">
      <SearchField
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        fullWidth
        noMargin
      />
      {action && (
        <Button
          variant="contained"
          className="gradient-button"
          startIcon={action.icon}
          onClick={action.onClick}
          sx={{ flexShrink: 0, whiteSpace: "nowrap", alignSelf: { xs: "stretch", sm: "center" } }}
        >
          {action.label}
        </Button>
      )}
    </Box>
  );
}
