import { Button, Typography } from "@mui/material";

interface RoleSelectButtonProps {
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export default function RoleSelectButton({ selected, icon, label, onClick }: RoleSelectButtonProps) {
  return (
    <Button
      fullWidth
      onClick={onClick}
      sx={{
        flexDirection: "column",
        py: 2,
        gap: 1,
        borderRadius: 2,
        textTransform: "none",
        bgcolor: selected ? undefined : "var(--color-bg)",
        background: selected ? "var(--gradient-button)" : undefined,
        color: selected ? "#fff" : "var(--color-text-secondary)",
        border: selected ? "none" : "1px solid var(--color-border)",
        transition: "all 0.25s ease",
        transform: selected ? "scale(1.02)" : "scale(1)",
        boxShadow: selected ? "var(--shadow-md)" : "none",
        "&:hover": {
          background: selected ? "var(--gradient-button)" : "var(--color-border)",
          transform: "scale(1.02)",
        },
      }}
    >
      {icon}
      <Typography variant="caption" fontWeight={600} textAlign="center">
        {label}
      </Typography>
    </Button>
  );
}
