import { CheckCircle, XCircle, Info, Warning, X } from "@phosphor-icons/react";
import { useToastStore, type ToastType } from "@/store/toastStore";

const CONFIG: Record<ToastType, { icon: typeof CheckCircle; color: string; bg: string }> = {
  success: { icon: CheckCircle,  color: "text-emerald-400", bg: "border-emerald-500/30 bg-emerald-500/8"  },
  error:   { icon: XCircle,       color: "text-red-400",     bg: "border-red-500/30 bg-red-500/8"         },
  info:    { icon: Info,          color: "text-sky-400",     bg: "border-sky-500/30 bg-sky-500/8"         },
  warning: { icon: Warning, color: "text-amber-400",   bg: "border-amber-500/30 bg-amber-500/8"     },
};

export function Toaster() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{ position: "fixed", bottom: 88, left: 16, right: 16, zIndex: 9998 }}
      className="flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const { icon: Icon, color, bg } = CONFIG[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg animate-slide-up ${bg}`}
            style={{ background: "rgba(2,2,7,0.92)" }}
          >
            <Icon size={16} className={`flex-shrink-0 mt-0.5 ${color}`} />
            <p className="flex-1 text-sm text-text-primary leading-snug">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
