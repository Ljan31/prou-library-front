import { reactive } from "vue";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // ms, 0 = no auto-dismiss
}

const toasts = reactive<Toast[]>([]);
const DEFAULT_DURATION = 4000;

function show(
  type: ToastType,
  message: string,
  title?: string,
  duration = DEFAULT_DURATION,
) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  toasts.push({ id, type, message, title, duration });

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: string) {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx !== -1) toasts.splice(idx, 1);
}

export function useToast() {
  return {
    toasts,
    dismiss,
    info: (msg: string, title?: string, duration?: number) =>
      show("info", msg, title, duration),
    success: (msg: string, title?: string, duration?: number) =>
      show("success", msg, title, duration),
    warning: (msg: string, title?: string, duration?: number) =>
      show("warning", msg, title, duration),
    error: (msg: string, title?: string, duration?: number) =>
      show("error", msg, title, duration),
  };
}
