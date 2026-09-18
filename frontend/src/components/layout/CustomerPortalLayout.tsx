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
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import HistoryIcon from "@mui/icons-material/History";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import axios from "axios";
import { useCustomerPortalStore } from "@/store/customerPortalStore";
import { useModeStore } from "@/store/modeStore";
import { SOFTWARE_NAME } from "@/config/app";

const navItems = [
  { path: "/customer", label: "Sale", icon: <PointOfSaleIcon />, match: (p: string) => p === "/customer" || p === "/customer/" },
  { path: "/customer/return", label: "Return", icon: <AssignmentReturnIcon />, match: (p: string) => p.startsWith("/customer/return") && !p.startsWith("/customer/returns") },
  { path: "/customer/customers", label: "Customers", icon: <PeopleIcon />, match: (p: string) => p.startsWith("/customer/customers") },
  { path: "/customer/inventory", label: "Products", icon: <Inventory2Icon />, match: (p: string) => p.startsWith("/customer/inventory") },
  { path: "/customer/history", label: "History", icon: <HistoryIcon />, match: (p: string) => p.startsWith("/customer/history") },
  { path: "/customer/returns", label: "Return History", icon: <AssignmentReturnIcon />, match: (p: string) => p.startsWith("/customer/returns") },
];

const drawerWidth = 252;
const drawerCollapsedWidth = 72;
const SIDEBAR_COLLAPSE_DELAY_MS = 180;

interface NavListProps {
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  onNavigate?: () => void;
  collapsed?: boolean;
}

function NavList({ location, navigate, onNavigate, collapsed = false }: NavListProps) {
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

export default function CustomerPortalLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useCustomerPortalStore((s) => s.logout);
  const restore = useCustomerPortalStore((s) => s.restore);
  const clearMode = useModeStore((s) => s.clearMode);
  const [shopName, setShopName] = useState("");

  useEffect(() => {
    restore();
  }, [restore]);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL || "/api"}/business/settings/public/`)
      .then((r) => setShopName(r.data.business_name || SOFTWARE_NAME))
      .catch(() => setShopName(SOFTWARE_NAME));
  }, []);

  const handleSwitchPortal = () => {
    navigate("/switch");
  };

  const handleLogout = () => {
    logout();
    clearMode();
    navigate("/", { replace: true });
  };

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

  const isBilling =
    location.pathname === "/customer" ||
    location.pathname === "/customer/" ||
    location.pathname === "/customer/return";
  const desktopDrawerWidth = sidebarExpanded ? drawerWidth : drawerCollapsedWidth;

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
          {shopName || "Smart Ledger"}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{ opacity: sidebarExpanded ? 0.75 : 1, transition: "opacity 0.2s ease" }}
        >
          {sidebarExpanded ? "Quick Sale" : "Q"}
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
          <ListItemIcon sx={{ color: "inherit", minWidth: !isMobile && !sidebarExpanded ? 0 : 40, justifyContent: "center" }}>
            <HomeIcon />
          </ListItemIcon>
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
          <ListItemIcon sx={{ color: "inherit", minWidth: !isMobile && !sidebarExpanded ? 0 : 40, justifyContent: "center" }}>
            <LogoutIcon />
          </ListItemIcon>
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
              {shopName || "Smart Ledger"}
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
          className={isBilling ? "billing-page-container billing-page-container--portal" : "page-container"}
          sx={isBilling ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" } : undefined}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
