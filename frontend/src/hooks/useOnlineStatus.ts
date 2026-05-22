import { useEffect, useState } from "react";
import { chatMediaApi } from "@/lib/api";

/** Mantiene el heartbeat de presencia del usuario actual */
export function usePresenceHeartbeat() {
  useEffect(() => {
    chatMediaApi.updateOnline().catch(() => {});
    const interval = setInterval(() => {
      chatMediaApi.updateOnline().catch(() => {});
    }, 25000); // cada 25 segundos
    return () => clearInterval(interval);
  }, []);
}

/** Obtiene el estado online de otro usuario */
export function useOnlineStatus(userId: string | undefined) {
  const [status, setStatus] = useState<{
    online: boolean;
    minutes_ago: number | null;
  }>({ online: false, minutes_ago: null });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function fetch() {
      try {
        const { data } = await chatMediaApi.getOnline(userId!);
        if (!cancelled) setStatus(data);
      } catch { /* ignore */ }
    }

    fetch();
    const interval = setInterval(fetch, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userId]);

  return status;
}

export function formatLastSeen(minutes_ago: number | null): string {
  if (minutes_ago === null) return "";
  if (minutes_ago < 2)  return "En línea";
  if (minutes_ago < 60) return `Hace ${minutes_ago} min`;
  const h = Math.floor(minutes_ago / 60);
  if (h < 24) return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}
