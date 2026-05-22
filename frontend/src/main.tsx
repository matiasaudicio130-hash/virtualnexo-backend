import React, { Component, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

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
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
