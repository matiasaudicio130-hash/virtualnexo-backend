import React, { Component, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRegisterSW } from "virtual:pwa-register/react";
import App from "./App";
import "./index.css";

function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Revisar actualizaciones cada 60 segundos
      r && setInterval(() => r.update(), 60_000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div
      style={{
        position: "fixed", bottom: 88, left: 16, right: 16, zIndex: 9999,
        background: "#C9A227", color: "#020207", borderRadius: 14,
        padding: "12px 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>Nueva versión disponible</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: "#020207", color: "#C9A227", border: "none",
          borderRadius: 8, padding: "6px 14px", fontSize: 12,
          fontWeight: 700, cursor: "pointer",
        }}
      >
        Actualizar
      </button>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#020207", color: "#fff", padding: 32, fontFamily: "monospace", minHeight: "100vh" }}>
          <p style={{ color: "#C9A227", fontSize: 16, marginBottom: 12 }}>Error detectado:</p>
          <pre style={{ color: "#f87171", fontSize: 12, whiteSpace: "pre-wrap", background: "#1a0000", padding: 16, borderRadius: 8, marginBottom: 16 }}>
            {this.state.error.message}{"\n\n"}{this.state.error.stack?.split("\n").slice(0, 6).join("\n")}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{ padding: "8px 20px", background: "#C9A227", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <UpdateBanner />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
