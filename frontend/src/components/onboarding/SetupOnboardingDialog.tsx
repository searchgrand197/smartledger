import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PhoneIcon from "@mui/icons-material/Phone";
import { businessApi } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  shopName?: string;
  onDismissed: () => void;
}

export default function SetupOnboardingDialog({ open, shopName, onDismissed }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const organizationId = useAuthStore((s) => s.organizationId);
  const [dismissing, setDismissing] = useState(false);

  const goSettings = () => {
    navigate("/wholesale/settings");
  };

  const dismissForever = async () => {
    setDismissing(true);
    try {
      await businessApi.dismissSetup();
      if (organizationId != null) {
        localStorage.setItem(`setup_dismissed_org_${organizationId}`, "1");
      }
      onDismissed();
      await useAuthStore.getState().refreshMe();
    } catch {
      toast.error("Could not save preference");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <Dialog
      open={open}
      fullWidth
      fullScreen={isMobile}
      maxWidth="sm"
      scroll="paper"
      disableEscapeKeyDown
      sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
      PaperProps={{
        className: "setup-onboarding-dialog",
        sx: {
          borderRadius: isMobile ? 0 : 3,
          maxHeight: isMobile ? "100dvh" : "calc(100dvh - 48px)",
          m: isMobile ? 0 : 2,
        },
      }}
    >
      <Box className="setup-onboarding-hero" sx={{ flexShrink: 0 }}>
        <StorefrontIcon sx={{ fontSize: 44, opacity: 0.95 }} />
        <Typography variant="h5" fontWeight={800} mt={1.5}>
          Welcome to your ledger
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.5, px: 1 }}>
          {shopName ? (
            <>
              <strong>{shopName}</strong> — add your shop details in Settings before billing.
            </>
          ) : (
            <>Add your shop details in Settings before you start billing.</>
          )}
        </Typography>
      </Box>

      <DialogContent dividers sx={{ py: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
          Your ledger only (not shared with other logins):
        </Typography>
        <List dense disablePadding>
          <ListItem disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <StorefrontIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Shop & owner name" secondary="On bills and reports" />
          </ListItem>
          <ListItem disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <PhoneIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Mobile & address" secondary="Printed on invoices" />
          </ListItem>
          <ListItem disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <ReceiptLongIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Invoice footer" secondary="Terms / thank-you line" />
          </ListItem>
        </List>
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            bgcolor: "#fff7ed",
            border: "1px solid #fdba74",
          }}
        >
          <Typography variant="body2" color="#9a3412" fontWeight={600}>
            Each username has its own empty ledger. Parties and inventory from another login will not
            appear here once you use your own account.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ flexDirection: "column", alignItems: "stretch", px: 2.5, pb: 2.5, pt: 0, gap: 1 }}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          className="gradient-button"
          startIcon={<SettingsIcon />}
          onClick={goSettings}
        >
          Go to Settings
        </Button>
        <Button fullWidth variant="text" color="inherit" disabled={dismissing} onClick={dismissForever}>
          {dismissing ? "Saving…" : "Don’t show again"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
