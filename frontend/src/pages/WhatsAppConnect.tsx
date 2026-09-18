import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
} from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import RefreshIcon from "@mui/icons-material/Refresh";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import toast from "react-hot-toast";
import { PageShell, PageHeader } from "@/components/ui";
import { billingApi } from "@/api/services";

interface ConnectionStatus {
  connected: boolean;
  qr: string | null;
  message: string;
  initializing?: boolean;
  error?: string | null;
}

export default function WhatsAppConnect() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const fetchStatus = async (showToast = false) => {
    try {
      const response = await billingApi.whatsappStatus();
      setStatus(response.data);
      setError(null);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        "WhatsApp sender is not running. Restart the backend on port 8000 — it starts automatically.";
      setError(msg);
      setStatus(null);
      if (showToast) {
        toast.error("Could not connect to WhatsApp sender service");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    void fetchStatus();

    // Setup polling every 2 seconds
    const interval = setInterval(() => {
      void fetchStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await billingApi.whatsappRestart();
      toast.success("WhatsApp sender restarted — wait for QR code");
      void fetchStatus();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Restart failed";
      toast.error(msg);
    } finally {
      setRestarting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await billingApi.whatsappDisconnect();
      toast.success("Disconnected WhatsApp session");
      void fetchStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Disconnect failed";
      toast.error("Failed to disconnect: " + msg);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="WhatsApp Integration"
        subtitle="Manage your local WhatsApp Web connection to automate invoice delivery"
      />

      <Stack spacing={3} maxWidth={640} sx={{ width: "100%", mt: 2 }}>
        {error && (
          <Alert
            severity="warning"
            action={
              <Button
                id="btn-retry-whatsapp-service"
                color="inherit"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setLoading(true);
                  void fetchStatus(true);
                }}
              >
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading && !status && !error && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress color="success" size={40} />
          </Box>
        )}

        {status && (
          <Card
            elevation={0}
            sx={{
              border: "1px solid var(--color-border)",
              borderRadius: 3,
              overflow: "hidden",
              background: "var(--color-bg-card, #ffffff)",
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Stack spacing={3} alignItems="center">
                {/* Header Badge */}
                <Box
                  display="flex"
                  alignItems="center"
                  gap={1.5}
                  sx={{
                    px: 3,
                    py: 1,
                    borderRadius: 5,
                    bgcolor: status.connected ? "rgba(37, 211, 102, 0.12)" : "rgba(25, 118, 210, 0.08)",
                    color: status.connected ? "#1e7e34" : "#1976d2",
                    fontWeight: 700,
                  }}
                >
                  <WhatsAppIcon />
                  <Typography variant="subtitle2" fontWeight={700}>
                    {status.connected ? "CONNECTED" : "SETUP REQUIRED"}
                  </Typography>
                </Box>

                <Typography variant="body1" align="center" color="text.secondary" sx={{ maxWidth: 460 }}>
                  {status.connected
                    ? "Your WhatsApp account is linked successfully. The system will automatically attach the bill PDF and send messages to the customers."
                    : "Scan the QR code below to connect your WhatsApp account. Your session will be saved locally so you don't need to link it again."}
                </Typography>

                {status.connected ? (
                  // Connected UI
                  <Box
                    sx={{
                      p: 4,
                      width: "100%",
                      borderRadius: 2.5,
                      bgcolor: "var(--color-bg-alert, #f4fbf7)",
                      border: "1px solid rgba(37, 211, 102, 0.2)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        bgcolor: "#25D366",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 14px rgba(37, 211, 102, 0.3)",
                      }}
                    >
                      <WhatsAppIcon sx={{ color: "#ffffff", fontSize: 32 }} />
                    </Box>

                    <Typography variant="h6" fontWeight={700} color="text.primary">
                      Ready to send messages!
                    </Typography>

                    <Button
                      id="btn-disconnect-whatsapp"
                      variant="outlined"
                      color="error"
                      size="large"
                      startIcon={<PowerSettingsNewIcon />}
                      disabled={disconnecting}
                      onClick={handleDisconnect}
                      sx={{ mt: 1, textTransform: "none", borderRadius: 2, fontWeight: 700 }}
                    >
                      {disconnecting ? "Disconnecting..." : "Disconnect WhatsApp"}
                    </Button>
                  </Box>
                ) : (
                  // Disconnected/QR Code UI
                  <Stack spacing={3} alignItems="center" sx={{ width: "100%" }}>
                    {status.error ? (
                      <Alert severity="warning" sx={{ width: "100%" }}>
                        {status.error}
                      </Alert>
                    ) : null}

                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<RefreshIcon />}
                      disabled={restarting}
                      onClick={() => void handleRestart()}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      {restarting ? "Restarting…" : "Restart WhatsApp sender"}
                    </Button>

                    {status.qr ? (
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: "#ffffff",
                          borderRadius: 3,
                          boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <img
                          id="whatsapp-qr-code"
                          src={status.qr}
                          alt="WhatsApp Link QR Code"
                          style={{ width: 256, height: 256, display: "block" }}
                        />
                      </Box>
                    ) : (
                      <Box display="flex" flexDirection="column" alignItems="center" gap={2} sx={{ py: 4 }}>
                        <CircularProgress color="success" size={32} />
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                          {status.initializing
                            ? "Starting WhatsApp browser…"
                            : status.error
                              ? "Restart the sender to generate a new QR code."
                              : "Generating new QR code…"}
                        </Typography>
                      </Box>
                    )}

                    <Box
                      sx={{
                        p: 3,
                        borderRadius: 2,
                        bgcolor: "var(--color-bg-hover, #f8fafc)",
                        border: "1px solid var(--color-border)",
                        width: "100%",
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                        Instructions:
                      </Typography>
                      <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0, lineHeight: 1.8, color: "text.secondary" }}>
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap <b>Menu</b> (Android) or <b>Settings</b> (iPhone)</li>
                        <li>Select <b>Linked Devices</b> and tap <b>Link a Device</b></li>
                        <li>Point your phone camera to this screen to scan the QR code</li>
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </PageShell>
  );
}
