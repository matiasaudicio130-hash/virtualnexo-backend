import { Link } from "react-router-dom";
import { APP_CONFIG } from "@/config/app";
import { Card } from "@/components/ui/Card";
import { Ban } from "lucide-react";

export default function AccessDenied() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 animate-fade-in">
      <Link to="/" className="mb-8 brand-eyebrow">
        {APP_CONFIG.name}
      </Link>
      <Card className="w-full max-w-sm p-8 text-center">
        <Ban size={48} className="text-status-error mx-auto mb-4" />
        <h1 className="brand-title" style={{ fontSize: "var(--fs-display-m)" }}>Acceso denegado</h1>
        <p className="text-text-secondary text-sm mb-6">
          Tu cuenta fue suspendida o rechazada. Si creés que es un error, contactá a soporte.
        </p>
        <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-accent-purple hover:underline text-sm">
          {APP_CONFIG.supportEmail}
        </a>
      </Card>
    </div>
  );
}
