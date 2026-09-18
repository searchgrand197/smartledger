import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import { useCustomerPortalStore } from "@/store/customerPortalStore";
import { useModeStore } from "@/store/modeStore";
import { SOFTWARE_NAME } from "@/config/app";

export default function CustomerLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const customer = useCustomerPortalStore((s) => s.customer);
  const logout = useCustomerPortalStore((s) => s.logout);
  const restore = useCustomerPortalStore((s) => s.restore);
  const clearMode = useModeStore((s) => s.clearMode);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    restore();
    setMounted(true);
  }, [restore]);

  const handleLogout = () => {
    logout();
    clearMode();
    navigate("/");
  };

  return (
    <Box minHeight="100vh" bgcolor="var(--color-bg)">
      <AppBar
        position="sticky"
        elevation={0}
        className="gradient-header animate-fade-in"
        sx={{ borderRadius: 0 }}
      >
        <Toolbar sx={{ gap: 1, flexWrap: isMobile ? "wrap" : "nowrap", py: isMobile ? 1 : 0 }}>
          <PersonIcon />
          <Box flex={1} minWidth={0}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {SOFTWARE_NAME} — Customer
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }} noWrap>
              {customer?.shop_name} ({customer?.code})
            </Typography>
          </Box>
          {isMobile ? (
            <>
              <IconButton color="inherit" size="small" onClick={() => { clearMode(); navigate("/"); }} aria-label="home">
                <HomeIcon />
              </IconButton>
              <IconButton color="inherit" size="small" onClick={handleLogout} aria-label="logout">
                <LogoutIcon />
              </IconButton>
            </>
          ) : (
            <>
              <Button color="inherit" size="small" startIcon={<HomeIcon />} onClick={() => { clearMode(); navigate("/"); }}>
                Home
              </Button>
              <Button color="inherit" size="small" startIcon={<LogoutIcon />} onClick={handleLogout}>
                Logout
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" className="page-container">
        {mounted && <Outlet />}
      </Container>
    </Box>
  );
}
