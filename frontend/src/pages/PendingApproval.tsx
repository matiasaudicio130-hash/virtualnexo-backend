import { Link } from "react-router-dom";
import { APP_CONFIG } from "@/config/app";
import { Card } from "@/components/ui/Card";
import { Clock } from "@phosphor-icons/react";

export default function PendingApproval() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
      <Link to="/" className="mb-8 brand-eyebrow">
        {APP_CONFIG.name}
      </Link>

      <Card glow className="w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-status-warning/10 flex items-center justify-center mx-auto mb-6">
          <Clock size={32} className="text-status-warning" />
        </div>
        <h1 className="brand-title" style={{ fontSize: "var(--fs-display-m)" }}>Revisión en proceso</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Usaste un código de acceso especial. Tu cuenta está en revisión manual por nuestro equipo.
          Recibirás una respuesta por email en las próximas <strong className="text-text-primary">24-48 horas</strong>.
        </p>
        <p className="text-text-muted text-xs mt-6">
          ¿Dudas? Contactá a{" "}
          <a href={`mailto:${APP_CONFIG.supportEmail}`} className="text-accent-purple hover:underline">
            {APP_CONFIG.supportEmail}
          </a>
        </p>
      </Card>
    </div>
  );
}
