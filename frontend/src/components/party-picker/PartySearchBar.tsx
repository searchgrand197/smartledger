import { forwardRef } from "react";
import { InputAdornment, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const PartySearchBar = forwardRef<HTMLInputElement, Props>(function PartySearchBar(
  { value, onChange, onKeyDown },
  ref
) {
  return (
    <div className="party-search">
      <TextField
        inputRef={ref}
        fullWidth
        size="small"
        placeholder="Search by party name, mobile, or customer code…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 20, color: "text.secondary" }} />
            </InputAdornment>
          ),
        }}
        aria-label="Search parties"
      />
      <div className="party-search__hint" aria-hidden>
        <span className="party-search__kbd">Ctrl</span>
        <span className="party-search__kbd">K</span>
      </div>
    </div>
  );
});

export default PartySearchBar;
