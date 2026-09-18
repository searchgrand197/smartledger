import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import DownloadIcon from "@mui/icons-material/Download";
import InvoicePrintLayout from "@/components/invoice/InvoicePrintLayout";
import { billingApi } from "@/api/services";
import { portalApi } from "@/api/portal";
import { downloadPdfResponse } from "@/utils/pdf";
import toast from "react-hot-toast";
import type { InvoicePrintData } from "@/types/invoice";
import "@/styles/invoice-print.css";

interface Props {
  portal?: boolean;
}

export default function InvoicePrintPage({ portal = false }: Props) {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const [data, setData] = useState<InvoicePrintData | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const autoprint = search.get("autoprint") === "1";

  useEffect(() => {
    const billId = Number(id);
    if (!billId) {
      setError("Invalid bill id");
      return;
    }
    const load = portal ? portalApi.billPrintData(billId) : billingApi.printData(billId);
    load
      .then((res) => setData(res.data as InvoicePrintData))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(msg || "Could not load invoice");
      });
  }, [id, portal]);

  useEffect(() => {
    if (!autoprint || !data) return;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [autoprint, data]);

  const handleDownloadPdf = async () => {
    const billId = Number(id);
    if (!billId || !data) return;
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

  if (error) {
    return (
      <Box p={4} textAlign="center">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className="invoice-print-screen">
      <div className="invoice-print-toolbar no-print">
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
          Print
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadPdf}
          disabled={downloading}
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
        <Button variant="outlined" onClick={() => window.close()}>
          Cancel
        </Button>
      </div>
      <div className="invoice-print-stage">
        <InvoicePrintLayout data={data} />
      </div>
    </div>
  );
}
