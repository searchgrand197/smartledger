import { Box, CircularProgress } from "@mui/material";
import { Navigate } from "react-router-dom";
import SmartLedgerLogin from "@/components/auth/SmartLedgerLogin";
import { useAuthStore } from "@/store/authStore";
import { useModeStore } from "@/store/modeStore";

export default function Home() {
  const authReady = useAuthStore((s) => s.authReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin);
  const supportAccess = useAuthStore((s) => s.supportAccess);
  const mode = useModeStore((s) => s.mode);

  if (!authReady) {
    return (
      <Box display="flex" height="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <SmartLedgerLogin />;
  }

  // Platform operators land on admin console (unless supporting a shop)
  if (isPlatformAdmin && !supportAccess) {
    return <Navigate to="/platform/shops" replace />;
  }

  if (mode === "wholesale") {
    return <Navigate to="/wholesale/sale" replace />;
  }
  if (mode === "customer") {
    return <Navigate to="/customer" replace />;
  }

  return <Navigate to="/switch" replace />;
}
