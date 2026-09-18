import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import PaymentPrintLayout from "@/components/payments/PaymentPrintLayout";
import { paymentsApi } from "@/api/services";
import type { PaymentPrintData } from "@/types/payment";
import "@/styles/invoice-print.css";
import "@/styles/return-print.css";

export default function PaymentPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const [data, setData] = useState<PaymentPrintData | null>(null);
  const [error, setError] = useState("");
  const autoprint = search.get("autoprint") === "1";

  useEffect(() => {
    const paymentId = Number(id);
    if (!paymentId) {
      setError("Invalid payment id");
      return;
    }
    paymentsApi
      .printData(paymentId)
      .then((res) => setData(res.data as PaymentPrintData))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(msg || "Could not load receipt");
      });
  }, [id]);

  useEffect(() => {
    if (!autoprint || !data) return;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [autoprint, data]);

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
      <Box className="invoice-print-toolbar no-print" display="flex" justifyContent="center" gap={1} p={2}>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
          Print
        </Button>
      </Box>
      <PaymentPrintLayout data={data} />
    </div>
  );
}
