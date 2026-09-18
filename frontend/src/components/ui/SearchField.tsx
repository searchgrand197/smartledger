import { TextField, InputAdornment, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  fullWidth?: boolean;
  /** When true, no bottom margin (use inside PageToolbar). */
  noMargin?: boolean;
}

export default function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  label = "SEARCH",
  fullWidth,
  noMargin,
}: Props) {
  return (
    <TextField
      size="small"
      variant="outlined"
      label={label}
      className={`app-outlined-field search-field${value ? " app-outlined-field--has-value" : ""}`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth={fullWidth ?? !noMargin}
      sx={{
        mb: noMargin ? 0 : 2,
        maxWidth: fullWidth || noMargin ? undefined : { xs: "100%", sm: 480 },
        minWidth: 0,
        flex: noMargin ? { xs: "0 0 auto", sm: "1 1 200px" } : undefined,
        width: noMargin ? "100%" : undefined,
      }}
      InputLabelProps={{ shrink: true }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" className="app-outlined-field__icon">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" edge="end" aria-label="Clear search" onClick={() => onChange("")}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
      autoComplete="off"
      inputProps={{
        autoComplete: "off",
        name: "app-search-query",
        role: "searchbox",
        "data-1p-ignore": "true",
        "data-lpignore": "true",
        "data-form-type": "other",
      }}
    />
  );
}
