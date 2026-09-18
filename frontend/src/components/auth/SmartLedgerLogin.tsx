import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import axios from "axios";
import toast from "react-hot-toast";
import { DEFAULT_LOGIN, SOFTWARE_NAME } from "@/config/app";
import { useAuthStore } from "@/store/authStore";
import LoginField from "@/components/auth/LoginField";

export default function SmartLedgerLogin() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState(DEFAULT_LOGIN.username);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [subtitle, setSubtitle] = useState("Billing & ledger for your shop");

  useEffect(() => {
    setMounted(true);
    const apiBase = import.meta.env.VITE_API_URL || "/api";
    axios
      .get(`${apiBase}/business/settings/public/`)
      .then((r) => {
        if (r.data.home_subtitle) setSubtitle(r.data.home_subtitle);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Enter username and password");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      toast.success("Welcome!");
      navigate("/switch", { replace: true });
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(
        typeof detail === "string" && detail
          ? detail
          : "Invalid username or password"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <Box className="login-page">
      <Box className="login-page-orb login-page-orb--1" aria-hidden />
      <Box className="login-page-orb login-page-orb--2" aria-hidden />

      <Card className="login-shell login-shell--smart" elevation={0}>
        <CardContent className="login-form-panel login-form-panel--centered">
          <Box className="login-smart-header">
            <Box className="login-smart-icon" aria-hidden>
              <AccountBalanceWalletIcon />
            </Box>
            <Typography variant="h5" fontWeight={800} color="primary.dark" textAlign="center" className="login-stagger-1">
              {SOFTWARE_NAME}
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" className="login-stagger-2">
              {subtitle}
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.25}>
              <Box className="login-stagger-3">
                <LoginField
                  label="USERNAME"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  placeholder="Enter username"
                />
              </Box>
              <Box className="login-stagger-4">
                <LoginField
                  label="PASSWORD"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
              </Box>
              <Button
                type="submit"
                fullWidth
                size="large"
                className={`gradient-button login-btn-animated login-stagger-5${loading ? " is-loading" : ""}`}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
                disabled={loading}
                sx={{ mt: 0.5, py: 1.25 }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </Stack>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            textAlign="center"
            mt={2.5}
            className="login-stagger-6"
          >
            After sign-in, choose Wholesale or Quick Sale on the portal switch.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
