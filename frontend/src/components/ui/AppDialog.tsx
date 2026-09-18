import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg";
}

export default function AppDialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = "sm",
}: AppDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={isMobile}
      scroll="paper"
      PaperProps={{
        className: isMobile ? "app-dialog app-dialog--mobile" : "app-dialog",
        sx: {
          borderRadius: isMobile ? 0 : "var(--radius-lg)",
          m: isMobile ? 0 : 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--gradient-header)",
          color: "#fff",
          py: 1.5,
        }}
      >
        <Typography fontWeight={700}>{title}</Typography>
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{ color: "#fff", minWidth: 44, minHeight: 44 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        {children}
      </DialogContent>
      {actions && (
        <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1, justifyContent: "flex-end" }}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}
