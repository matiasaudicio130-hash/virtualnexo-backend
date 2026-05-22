import { useState, useEffect } from "react";
import { pushApi } from "@/lib/api";

export type PushState = "unsupported" | "denied" | "granted" | "default" | "loading";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  const arr     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [vapidKey, setVapidKey] = useState<string>("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PushState);
    // Cargar clave pública VAPID
    pushApi.getVapidKey()
      .then(r => setVapidKey(r.data.public_key))
      .catch(() => {});
  }, []);

  async function requestPermission(): Promise<boolean> {
    if (!vapidKey) return false;
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      setState(permission as PushState);
      if (permission !== "granted") return false;

      const sw  = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const key    = sub.getKey("p256dh");
      const auth   = sub.getKey("auth");
      const p256dh = key  ? btoa(String.fromCharCode(...new Uint8Array(key)))  : "";
      const authStr = auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : "";

      await pushApi.subscribe({
        endpoint:   sub.endpoint,
        p256dh:     p256dh,
        auth:       authStr,
        user_agent: navigator.userAgent,
      });
      return true;
    } catch (e) {
      setState(Notification.permission as PushState);
      return false;
    }
  }

  async function unsubscribe() {
    try {
      const sw  = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.getSubscription();
      await sub?.unsubscribe();
      await pushApi.unsubscribe();
      setState("default");
    } catch { /* ignore */ }
  }

  return { state, requestPermission, unsubscribe };
}
