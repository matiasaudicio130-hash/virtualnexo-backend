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

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add(type, message, durationMs = 4000) {
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
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
