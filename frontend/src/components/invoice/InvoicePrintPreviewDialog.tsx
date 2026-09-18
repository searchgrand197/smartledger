import { useState } from "react";
import { Dialog, Button, Box } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import { billingApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { downloadPdfResponse } from "@/utils/pdf";
import toast from "react-hot-toast";
import InvoicePrintLayout from "@/components/invoice/InvoicePrintLayout";
import type { InvoicePrintData } from "@/types/invoice";
import "@/styles/invoice-print.css";

interface Props {
  open: boolean;
  data: InvoicePrintData | null;
  onClose: () => void;
  portal?: boolean;
}

/** Full-screen bill preview with Print and Cancel (after Save and Print). */
export default function InvoicePrintPreviewDialog({ open, data, onClose, portal = false }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handlePrint = () => {
    document.body.classList.add("invoice-preview-printing");
    const cleanup = () => {
      document.body.classList.remove("invoice-preview-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 4000);
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    const billId = data.id;
    if (!billId) {
      toast.error("Bill ID not found in print data");
      return;
    }
    setDownloading(true);
    const loadToast = toast.loading("Generating PDF...");
    try {
      const res = portal ? await portalApi.billPdf(billId) : await billingApi.pdf(billId);
      await downloadPdfResponse(res, `bill_${data.bill_number.replace(/\//g, "_")}.pdf`);
      toast.success("PDF downloaded successfully!", { id: loadToast });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Could not download PDF";
      toast.error(msg, { id: loadToast });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      className="invoice-print-preview-dialog"
      PaperProps={{ className: "invoice-print-preview-paper" }}
    >
      <Box className="invoice-print-screen invoice-print-screen--preview">
        <Box className="invoice-print-toolbar no-print">
          <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!data}>
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPdf}
            disabled={!data || downloading}
            sx={{
              color: "#0f766e",
              borderColor: "#0f766e",
              "&:hover": {
                borderColor: "#0d9488",
                backgroundColor: "#f0fdfa",
              },
            }}
          >
            PDF
          </Button>
          <Button variant="outlined" startIcon={<CloseIcon />} onClick={onClose}>
            Cancel
          </Button>
        </Box>
        <Box className="invoice-print-stage">
          {data ? <InvoicePrintLayout data={data} /> : null}
        </Box>
      </Box>
    </Dialog>
  );
}
