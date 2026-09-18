import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Toolbar,
  AppBar,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import GroupsIcon from "@mui/icons-material/Groups";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import { useAuthStore } from "@/store/authStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useModeStore } from "@/store/modeStore";
import SetupOnboardingDialog from "@/components/onboarding/SetupOnboardingDialog";

const navItems = [
  { path: "/wholesale/sale", label: "Sale", icon: <PointOfSaleIcon />, match: (p: string) => p.startsWith("/wholesale/sale") || p.includes("/billing") || p.includes("/quick-bill") },
  { path: "/wholesale/history", label: "Sale History", icon: <HistoryIcon />, match: (p: string) => p.startsWith("/wholesale/history") },
  { path: "/wholesale/return", label: "Return", icon: <AssignmentReturnIcon />, match: (p: string) => p === "/wholesale/return" || p === "/wholesale/return/" },

  { path: "/wholesale/return-history", label: "Return History", icon: <HistoryIcon />, match: (p: string) => p.startsWith("/wholesale/return-history") },
  { path: "/wholesale/parties", label: "Parties", icon: <GroupsIcon />, match: (p: string) => p.startsWith("/wholesale/parties") || p.startsWith("/wholesale/customers") },
  { path: "/wholesale/inventory", label: "Products", icon: <Inventory2Icon />, match: (p: string) => p.startsWith("/wholesale/inventory") || p.startsWith("/wholesale/products") },
  { path: "/wholesale/whatsapp", label: "WhatsApp", icon: <WhatsAppIcon />, match: (p: string) => p.startsWith("/wholesale/whatsapp") },
  { path: "/wholesale/settings", label: "Settings", icon: <SettingsIcon />, match: (p: string) => p.startsWith("/wholesale/settings") },
];

const drawerWidth = 252;
const drawerCollapsedWidth = 72;
const SIDEBAR_COLLAPSE_DELAY_MS = 180;

function NavList({
  location,
  navigate,
  onNavigate,
  collapsed = false,
}: {
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <List sx={{ flex: 1, px: collapsed ? 0.5 : 1, py: 1 }}>
      {navItems.map((item) => {
        const active = item.match(location.pathname);
        return (
          <ListItemButton
            key={item.path}
            selected={active}
            onClick={() => {
              navigate(item.path);
              onNavigate?.();
            }}
            className={active ? "nav-item-active" : undefined}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              transition: "all 0.2s ease",
              "&.Mui-selected": { bgcolor: "transparent" },
              "&:not(.nav-item-active):hover": { bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: collapsed ? 0 : 40, justifyContent: "center" }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 500 }}
              sx={{
                ml: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                maxWidth: collapsed ? 0 : 140,
                opacity: collapsed ? 0 : 1,
                transition: "max-width 0.2s ease, opacity 0.2s ease",
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export default function WholesaleLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const clearMode = useModeStore((s) => s.clearMode);
  const organizationId = useAuthStore((s) => s.organizationId);
  const organizationName = useAuthStore((s) => s.organizationName);
  const setupCompleted = useAuthStore((s) => s.setupCompleted);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const businessName = useSettingsStore((s) => s.business_name);
  const [setupDismissedLocal, setSetupDismissedLocal] = useState(false);

  useEffect(() => {
    if (organizationId == null) {
      setSetupDismissedLocal(false);
      return;
    }
    setSetupDismissedLocal(localStorage.getItem(`setup_dismissed_org_${organizationId}`) === "1");
  }, [organizationId]);
  const showSetupWelcome =
    !setupCompleted &&
    !setupDismissedLocal &&
    !location.pathname.startsWith("/wholesale/settings");

  const isBilling = location.pathname.includes("/sale") || location.pathname.includes("/return") || location.pathname.includes("/billing") || location.pathname.includes("/quick-bill");

  const handleLogout = () => {
    logout();
    clearMode();
    navigate("/", { replace: true });
  };

  const handleSwitchPortal = () => {
    navigate("/switch");
  };

  const desktopDrawerWidth = sidebarExpanded ? drawerWidth : drawerCollapsedWidth;

  const handleSidebarEnter = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    if (!isMobile) setSidebarExpanded(true);
  };

  const handleSidebarLeave = () => {
    if (isMobile) return;
    collapseTimerRef.current = setTimeout(() => {
      setSidebarExpanded(false);
      collapseTimerRef.current = null;
    }, SIDEBAR_COLLAPSE_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    },
    []
  );

  const drawer = (
    <>
      <Toolbar sx={{ px: 2, flexDirection: "column", alignItems: sidebarExpanded ? "flex-start" : "center", py: 2.5, overflow: "hidden" }}>
        <Typography
          variant="subtitle1"
          fontWeight={800}
          letterSpacing={-0.3}
          noWrap
          sx={{ maxWidth: sidebarExpanded ? 220 : 0, opacity: sidebarExpanded ? 1 : 0, transition: "max-width 0.2s ease, opacity 0.2s ease" }}
        >
          {businessName || "Smart Ledger"}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{ opacity: sidebarExpanded ? 0.75 : 1, transition: "opacity 0.2s ease" }}
        >
          {sidebarExpanded ? "Wholesale" : "W"}
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <NavList
        location={location}
        navigate={navigate}
        onNavigate={() => setMobileOpen(false)}
        collapsed={!isMobile && !sidebarExpanded}
      />
      <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />
      <List sx={{ px: !isMobile && !sidebarExpanded ? 0.5 : 1, pb: 2 }}>
        <ListItemButton onClick={handleSwitchPortal} sx={{ borderRadius: 2, mb: 0.5 }}>
          <ListItemIcon sx={{ color: "inherit", minWidth: !isMobile && !sidebarExpanded ? 0 : 40, justifyContent: "center" }}><HomeIcon /></ListItemIcon>
          <ListItemText
            primary="Switch portal"
            primaryTypographyProps={{ fontSize: 14 }}
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxWidth: isMobile || sidebarExpanded ? 120 : 0,
              opacity: isMobile || sidebarExpanded ? 1 : 0,
              transition: "max-width 0.2s ease, opacity 0.2s ease",
            }}
          />
        </ListItemButton>
        <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2 }}>
          <ListItemIcon sx={{ color: "inherit", minWidth: !isMobile && !sidebarExpanded ? 0 : 40, justifyContent: "center" }}><LogoutIcon /></ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{ fontSize: 14 }}
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxWidth: isMobile || sidebarExpanded ? 120 : 0,
              opacity: isMobile || sidebarExpanded ? 1 : 0,
              transition: "max-width 0.2s ease, opacity 0.2s ease",
            }}
          />
        </ListItemButton>
      </List>
    </>
  );

  return (
    <Box display="flex" minHeight="100dvh">
      <SetupOnboardingDialog
        open={showSetupWelcome}
        shopName={organizationName || businessName}
        onDismissed={() => {
          setSetupDismissedLocal(true);
          void refreshMe();
        }}
      />
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: "var(--color-bg-sidebar)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            zIndex: theme.zIndex.drawer + 1,
            pt: "env(safe-area-inset-top)",
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="menu"
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1 }}>
              {businessName || "Smart Ledger"}
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          onMouseEnter: handleSidebarEnter,
          onMouseLeave: handleSidebarLeave,
        }}
        sx={{
          width: isMobile ? drawerWidth : drawerCollapsedWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: isMobile ? drawerWidth : desktopDrawerWidth,
            boxSizing: "border-box",
            bgcolor: "var(--color-bg-sidebar)",
            color: "var(--color-text-inverse)",
            borderRight: "none",
            overflowX: "hidden",
            transition: "width 0.22s ease, box-shadow 0.22s ease",
            ...(isMobile
              ? {}
              : {
                  position: "fixed",
                  top: 0,
                  left: 0,
                  height: "100vh",
                  zIndex: sidebarExpanded ? theme.zIndex.drawer + 2 : theme.zIndex.drawer,
                  boxShadow: sidebarExpanded ? "4px 0 24px rgba(0, 0, 0, 0.22)" : "none",
                }),
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        flexGrow={1}
        minWidth={0}
        bgcolor="var(--color-bg)"
        sx={{
          mt: { xs: "calc(56px + env(safe-area-inset-top))", md: 0 },
          height: { xs: "calc(100dvh - 56px - env(safe-area-inset-top))", md: "100dvh" },
          minHeight: 0,
          overflow: isBilling ? "hidden" : { xs: "auto", md: "auto" },
          display: "flex",
          flexDirection: "column",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Box
          className={isBilling ? "billing-page-container" : "page-container"}
          sx={isBilling ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" } : undefined}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
