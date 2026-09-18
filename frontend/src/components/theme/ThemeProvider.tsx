import { useMemo, useEffect } from "react";
import { CssBaseline, ThemeProvider as MuiThemeProvider } from "@mui/material";
import { createAppTheme } from "@/theme/muiTheme";
import { useThemeStore } from "@/store/themeStore";

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const init = useThemeStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
