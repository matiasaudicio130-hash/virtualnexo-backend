/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// ── Precache todos los assets generados por Vite ─────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime cache: Supabase Storage (imágenes/videos) ───────────────────────
registerRoute(
  ({ url }) => url.hostname.includes(".supabase.co"),
  new NetworkFirst({ cacheName: "supabase-media-cache", plugins: [] })
);

// ── Push event: mostrar la notificación ─────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  interface PushPayload {
    title: string;
    body:  string;
    icon?: string;
    url?:  string;
    tag?:  string;
  }

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: "Aura SW", body: event.data.text() };
  }

  // Cast to any — las propiedades vibrate/renotify/badge/silent son válidas en
  // la Web Notifications API pero faltan en las definiciones de TypeScript estándar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    body:     payload.body || "",
    icon:     payload.icon || "/icons/icon-192.png",
    badge:    "/icons/icon-192.png",
    data:     { url: payload.url || "/feed" },
    vibrate:  [120, 60, 120],
    tag:      payload.tag  || "aura-notif",
    renotify: true,
    silent:   false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Aura SW", options)
  );
});

// ── Notification click: abrir o enfocar la app ───────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl: string =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/feed";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta de Aura, enfocarla y navegar
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            (client as WindowClient).focus();
            (client as WindowClient).navigate(targetUrl);
            return;
          }
        }
        // Si no hay ventana, abrir una nueva
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ── Skip waiting inmediato al instalar ───────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
