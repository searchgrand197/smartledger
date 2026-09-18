import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import LogoutIcon from "@mui/icons-material/Logout";
import toast from "react-hot-toast";
import { authApi } from "@/api/services";
import { SOFTWARE_NAME } from "@/config/app";
import { useAuthStore } from "@/store/authStore";
import { useCustomerPortalStore } from "@/store/customerPortalStore";
import { useModeStore } from "@/store/modeStore";
import { useSettingsStore } from "@/store/settingsStore";

export default function PortalSwitch() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const username = useAuthStore((s) => s.username);
  const organizationName = useAuthStore((s) => s.organizationName);
  const businessName = useSettingsStore((s) => s.business_name);
  const setMode = useModeStore((s) => s.setMode);
  const portalLoginFromToken = useCustomerPortalStore((s) => s.loginFromToken);
  const portalLogout = useCustomerPortalStore((s) => s.logout);
  const [loading, setLoading] = useState<"wholesale" | "quick" | null>(null);

  const shopLabel = organizationName || businessName || SOFTWARE_NAME;

  const openWholesale = () => {
    setLoading("wholesale");
    portalLogout();
    setMode("wholesale");
    navigate("/wholesale/sale", { replace: true });
    setLoading(null);
  };

  const openQuickSale = async () => {
    setLoading("quick");
    try {
      const { data } = await authApi.portalToken();
      portalLoginFromToken(data.token, data.label || "Walk-in / Quick Sale");
      setMode("customer");
      navigate("/customer", { replace: true });
    } catch {
      toast.error("Could not open Quick Sale. Try signing in again.");
    } finally {
      setLoading(null);
    }
  };

  const handleLogout = () => {
    portalLogout();
    logout();
    navigate("/", { replace: true });
  };

  return (
    <Box className="login-page">
      <Box className="login-page-orb login-page-orb--1" aria-hidden />
      <Box className="login-page-orb login-page-orb--2" aria-hidden />

      <Box className="portal-switch-wrap">
        <Typography variant="h6" fontWeight={800} textAlign="center" color="primary.dark" className="login-stagger-1">
          {shopLabel}
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }} className="login-stagger-2">
          Signed in as <strong>{username}</strong> — choose a workspace
        </Typography>

        <Stack spacing={1.5} sx={{ maxWidth: 420, mx: "auto", width: "100%" }}>
          <Card variant="outlined" className="portal-switch-card login-stagger-3">
            <CardActionArea onClick={openWholesale} disabled={loading !== null}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <StorefrontIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box flex={1}>
                    <Typography fontWeight={700}>Wholesale / Parties</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sale, parties, inventory, settings & ledger
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>

          <Card variant="outlined" className="portal-switch-card login-stagger-4">
            <CardActionArea onClick={openQuickSale} disabled={loading !== null}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <PointOfSaleIcon color="secondary" sx={{ fontSize: 40 }} />
                  <Box flex={1}>
                    <Typography fontWeight={700}>Quick Sale</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Walk-in cash billing, history & counter stock view
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Stack>

        <Stack direction="row" justifyContent="center" mt={3} className="login-stagger-6">
          <Button
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            color="inherit"
            sx={{ minHeight: 44, px: 2 }}
          >
            Sign out
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
