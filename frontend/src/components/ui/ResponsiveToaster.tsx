import { useMediaQuery, useTheme } from "@mui/material";
import { Toaster } from "react-hot-toast";

/** Toasts at top — always above dialogs; never clipped at bottom of screen */
export default function ResponsiveToaster() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Toaster
      position="top-center"
      containerClassName="app-toaster"
      containerStyle={{
        top: "max(16px, env(safe-area-inset-top))",
        bottom: "auto",
        left: 16,
        right: 16,
        zIndex: 14000,
      }}
      toastOptions={{
        duration: 4000,
        style: {
          maxWidth: isMobile ? "min(360px, calc(100vw - 32px))" : "min(420px, calc(100vw - 32px))",
          zIndex: 14001,
        },
      }}
    />
  );
}