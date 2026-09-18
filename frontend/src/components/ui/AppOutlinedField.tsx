import { useState } from "react";
import { IconButton, InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  onClear?: () => void;
  id?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  /** Blocks Chrome/Edge "Saved info" autofill on search-style fields. */
  disableBrowserAutocomplete?: boolean;
  flex?: number | string;
  minWidth?: number;
  fullWidth?: boolean;
  inputProps?: TextFieldProps["inputProps"];
}

/** Outlined field — same clean style as billing CUSTOMER bar. */
export default function AppOutlinedField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  onClear,
  id,
  disabled,
  readOnly,
  autoComplete,
  disableBrowserAutocomplete,
  flex,
  minWidth = 200,
  fullWidth,
  inputProps,
}: Props) {
  const [autocompleteReady, setAutocompleteReady] = useState(!disableBrowserAutocomplete);
  const blockAutocomplete = Boolean(disableBrowserAutocomplete);
  const inputReadOnly = readOnly || (blockAutocomplete && !autocompleteReady);
  const showClear = Boolean(onClear && value && !disabled && !readOnly);

  return (
    <TextField
      id={id}
      size="small"
      variant="outlined"
      label={label}
      className={`app-outlined-field${value ? " app-outlined-field--has-value" : ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      InputLabelProps={{ shrink: true }}
      InputProps={{
        readOnly: inputReadOnly,
        onFocus: blockAutocomplete
          ? () => {
              if (!autocompleteReady) setAutocompleteReady(true);
            }
          : undefined,
        startAdornment: icon ? (
          <InputAdornment position="start" className="app-outlined-field__icon">
            {icon}
          </InputAdornment>
        ) : undefined,
        endAdornment: showClear ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              edge="end"
              aria-label={`Clear ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onClear?.();
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
      inputProps={{
        ...inputProps,
        ...(blockAutocomplete
          ? {
              autoComplete: "off",
              name: inputProps?.name ?? `search-${id ?? label.replace(/\s+/g, "-").toLowerCase()}`,
              role: "combobox",
              "aria-autocomplete": "list",
              "data-1p-ignore": "true",
              "data-lpignore": "true",
              "data-form-type": "other",
            }
          : {}),
      }}
      autoComplete={blockAutocomplete ? "off" : autoComplete}
      fullWidth={fullWidth}
      sx={{
        flex: fullWidth ? undefined : flex,
        minWidth: fullWidth ? undefined : { xs: 0, sm: minWidth },
        width: fullWidth ? "100%" : { xs: "100%", sm: "auto" },
      }}
    />
  );
}
