import { Button, CircularProgress, Stack } from "@mui/material";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import PaymentsIcon from "@mui/icons-material/Payments";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

interface Props {
  onNewSale: () => void;
  onReceivePayment: () => void;
  onAddReturn: () => void;
  onWhatsApp: () => void;
  onExportPdf: () => void;
  pdfLoading?: boolean;
}

export default function ActionToolbar({
  onNewSale,
  onReceivePayment,
  onAddReturn,
  onWhatsApp,
  onExportPdf,
  pdfLoading,
}: Props) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1} className="cp-toolbar">
      <Button
        variant="contained"
        className="gradient-button cp-toolbar__primary"
        startIcon={<AddShoppingCartIcon />}
        onClick={onNewSale}
      >
        New Sale
      </Button>
      <Button variant="outlined" className="cp-toolbar__btn" startIcon={<PaymentsIcon />} onClick={onReceivePayment}>
        Receive Payment
      </Button>
      <Button
        variant="outlined"
        className="cp-toolbar__btn"
        startIcon={<AssignmentReturnIcon />}
        onClick={onAddReturn}
      >
        Add Return
      </Button>
      <Button variant="outlined" className="cp-toolbar__btn" startIcon={<WhatsAppIcon />} onClick={onWhatsApp}>
        WhatsApp Reminder
      </Button>
      <Button
        variant="outlined"
        className="cp-toolbar__btn"
        startIcon={pdfLoading ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
        disabled={pdfLoading}
        onClick={onExportPdf}
      >
        {pdfLoading ? "Exporting…" : "Export PDF"}
      </Button>
    </Stack>
  );
}
