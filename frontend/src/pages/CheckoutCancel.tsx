import { useNavigate } from "react-router-dom";

export default function CheckoutCancel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-20 h-20 bg-bg-card border border-border rounded-full flex items-center justify-center mx-auto">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold mb-2">Pago cancelado</h1>
          <p className="text-text-secondary text-sm">No se realizó ningún cargo. Podés intentarlo de nuevo cuando quieras.</p>
        </div>
        <button
          onClick={() => navigate("/checkout")}
          className="w-full py-4 rounded-2xl font-bold text-white bg-accent-purple hover:bg-accent-purple/90 transition-all"
        >
          Volver a planes
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-2 text-text-muted text-sm hover:text-text-primary transition-colors"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  );
}
