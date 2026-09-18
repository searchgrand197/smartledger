import { Box } from "@mui/material";

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
}

export default function SegmentedTabs({ tabs, value, onChange }: Props) {
  return (
    <Box className="cp-segmented" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={`cp-segmented__btn${value === tab.id ? " cp-segmented__btn--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </Box>
  );
}
