import { createTheme, type PaletteMode } from "@mui/material/styles";

export function createAppTheme(mode: PaletteMode = "light") {
  const isDark = mode === "dark";

  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: isDark ? "#2dd4bf" : "#0d9488",
        dark: isDark ? "#14b8a6" : "#0f766e",
        light: isDark ? "#5eead4" : "#14b8a6",
      },
      secondary: {
        main: isDark ? "#38bdf8" : "#0284c7",
      },
      success: { main: isDark ? "#34d399" : "#059669" },
      warning: { main: isDark ? "#fbbf24" : "#d97706" },
      error: { main: isDark ? "#f87171" : "#dc2626" },
      background: {
        default: isDark ? "#0a1210" : "#f2f8f7",
        paper: isDark ? "#152420" : "#ffffff",
      },
      text: {
        primary: isDark ? "#ecfdf5" : "#0f2420",
        secondary: isDark ? "#94a3b8" : "#5f7168",
      },
      divider: isDark ? "#2a4038" : "#cce8e4",
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
      h4: { fontWeight: 700, letterSpacing: -0.02 },
      h5: { fontWeight: 700, letterSpacing: -0.01 },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600, borderRadius: 10 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: "var(--shadow-sm)",
            border: "1px solid var(--color-border)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 700, backgroundColor: "var(--color-table-header)" },
        },
      },
      MuiTextField: {
        defaultProps: { size: "small" },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: "none" },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDark ? "#2a4038 #0a1210" : "#cce8e4 #f2f8f7",
          },
        },
      },
    },
  });
}

/** @deprecated use createAppTheme */
export const muiTheme = createAppTheme("light");
