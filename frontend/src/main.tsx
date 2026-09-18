import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import AppThemeProvider from "./components/theme/ThemeProvider";
import ResponsiveToaster from "./components/ui/ResponsiveToaster";
import { queryClient } from "@/lib/queryClient";
import "./styles/global.css";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Unexpected app error" };
  }

  componentDidCatch(error: Error) {
    console.error("App crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "#f3f4f6",
            color: "#111827",
            fontFamily: "Inter, Arial, sans-serif",
          }}
        >
          <div style={{ maxWidth: 640, width: "100%", background: "#fff", borderRadius: 12, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
            <p style={{ marginBottom: 8 }}>The app hit a runtime error instead of rendering a blank page.</p>
            <pre
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {this.state.message}
            </pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: "8px 12px" }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
        <ResponsiveToaster />
      </QueryClientProvider>
    </AppThemeProvider>
  </React.StrictMode>
);
