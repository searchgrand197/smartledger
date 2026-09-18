import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { useNavigate } from "react-router-dom";
import { billingApi } from "@/api/services";
import { portalApi } from "@/api/portal";

type StatusPayload = { connected?: boolean; message?: string };

/** Returns true when WhatsApp sender reports connected. On check failure → treat as disconnected. */
export async function isWhatsAppConnected(portal = false): Promise<boolean> {
  try {
    const { data } = portal
      ? await portalApi.whatsappStatus()
      : await billingApi.whatsappStatus();
    const payload = (data || {}) as StatusPayload;
    return Boolean(payload.connected);
  } catch {
    return false;
  }
}

type Props = {
  open: boolean;
  onContinue: () => void;
  onClose: () => void;
  connectPath?: string;
};

/** Warn that WhatsApp is offline; bill can still be saved. */
export default function WhatsAppDisconnectedDialog({
  open,
  onContinue,
  onClose,
  connectPath = "/wholesale/whatsapp",
}: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <WhatsAppIcon sx={{ color: "#25D366" }} />
        WhatsApp not connected
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
          WhatsApp is disconnected or not running. The bill will still be saved, but the PDF will
          not be sent to the customer until you connect WhatsApp again.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
        <Button onClick={onContinue} color="inherit" sx={{ fontWeight: 700, textTransform: "none" }}>
          Save without WhatsApp
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<WhatsAppIcon />}
          onClick={() => {
            onClose();
            navigate(connectPath);
          }}
          sx={{ fontWeight: 800, textTransform: "none" }}
        >
          Connect WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Guard: if WhatsApp is down, open dialog; otherwise run save immediately. */
export function useWhatsAppSendGuard(portal = false, connectPath = "/wholesale/whatsapp") {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<null | (() => void)>(null);

  const runWithWhatsAppCheck = async (saveFn: () => void) => {
    const connected = await isWhatsAppConnected(portal);
    if (connected) {
      saveFn();
      return;
    }
    setPending(() => saveFn);
    setOpen(true);
  };

  const dialog = (
    <WhatsAppDisconnectedDialog
      open={open}
      connectPath={connectPath}
      onClose={() => {
        setOpen(false);
        setPending(null);
      }}
      onContinue={() => {
        const fn = pending;
        setOpen(false);
        setPending(null);
        fn?.();
      }}
    />
  );

  return { runWithWhatsAppCheck, whatsappDialog: dialog };
}
