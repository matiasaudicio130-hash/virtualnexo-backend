import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  add: (type: ToastType, message: string, durationMs?: number) => void;
  remove: (id: string) => void;
}

const MAX_TOASTS = 4;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  add(type, message, durationMs = 4000) {
    // Deduplicar: si ya existe un toast idéntico activo, no agregar otro
    if (get().toasts.some(t => t.type === type && t.message === message)) return;
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({
      // Limitar a MAX_TOASTS — descartar los más viejos si hay demasiados
      toasts: [...s.toasts.slice(-(MAX_TOASTS - 1)), { id, type, message }],
    }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), durationMs);
  },
  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().add("success", msg),
  error:   (msg: string) => useToastStore.getState().add("error", msg),
  info:    (msg: string) => useToastStore.getState().add("info", msg),
  warning: (msg: string) => useToastStore.getState().add("warning", msg),
};
