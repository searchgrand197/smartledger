import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import toast from "react-hot-toast";
import { portalApi } from "@/api/portal";
import { returnsApi } from "@/api/services";

interface Props {
  returnId: number;
  returnNumber?: string;
  portal?: boolean;
}

function handleWhatsAppResult(wa: {
  status?: string;
  reason?: string;
  detail?: string;
  sent_via?: string;
  phone?: string;
}) {
  if (wa.status === "success" || wa.sent_via) {
    toast.success(
      wa.phone
        ? `Return receipt queued for WhatsApp (+${wa.phone})`
        : "Return receipt queued for WhatsApp"
    );
    return;
  }
  if (wa.status === "skipped") {
    toast(`WhatsApp skipped: ${wa.reason || "No phone on file"}`, { icon: "ℹ️" });
    return;
  }
  toast.error(wa.detail || "Could not send return on WhatsApp");
}

export default function ReturnWhatsAppAction({ returnId, returnNumber, portal = false }: Props) {
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    try {
      const { data } = portal
        ? await portalApi.returnWhatsApp(returnId)
        : await returnsApi.whatsapp(returnId);
      handleWhatsAppResult(data?.whatsapp || data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Could not send return on WhatsApp";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip title={returnNumber ? `WhatsApp return ${returnNumber}` : "Send return on WhatsApp"}>
      <IconButton
        size="small"
        aria-label="whatsapp return"
        disabled={loading}
        onClick={() => void send()}
        sx={{ color: "#166534", bgcolor: "#dcfce7", border: "1px solid #86efac" }}
      >
        <WhatsAppIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
