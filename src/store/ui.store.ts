import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface Breadcrumb {
  label: string;
  to?: string;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration: number;
}

export const useUiStore = defineStore("ui", () => {
  // ─── Sidebar ────────────────────────────────────────────────────────────
  const sidebarCollapsed = ref(false);
  const sidebarMobileOpen = ref(false);

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function toggleMobileSidebar() {
    sidebarMobileOpen.value = !sidebarMobileOpen.value;
  }

  function closeMobileSidebar() {
    sidebarMobileOpen.value = false;
  }

  // ─── Breadcrumbs ────────────────────────────────────────────────────────
  const breadcrumbs = ref<Breadcrumb[]>([]);

  function setBreadcrumbs(items: Breadcrumb[]) {
    breadcrumbs.value = items;
  }

  // ─── Toasts ─────────────────────────────────────────────────────────────
  const toasts = ref<Toast[]>([]);

  function addToast(toast: Omit<Toast, "id">) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    toasts.value.push({ ...toast, id });

    setTimeout(() => removeToast(id), toast.duration);
  }

  function removeToast(id: string) {
    const idx = toasts.value.findIndex((t) => t.id === id);
    if (idx !== -1) toasts.value.splice(idx, 1);
  }

  // Convenience helpers
  const toast = {
    success: (title: string, message?: string) =>
      addToast({ type: "success", title, message, duration: 4000 }),
    error: (title: string, message?: string) =>
      addToast({ type: "error", title, message, duration: 6000 }),
    warning: (title: string, message?: string) =>
      addToast({ type: "warning", title, message, duration: 5000 }),
    info: (title: string, message?: string) =>
      addToast({ type: "info", title, message, duration: 4000 }),
  };

  // ─── Page title ─────────────────────────────────────────────────────────
  const pageTitle = ref("Dashboard");

  function setPageTitle(title: string) {
    pageTitle.value = title;
    document.title = `${title} – SIGEB`;
  }

  // ─── Global loading overlay ──────────────────────────────────────────────
  const globalLoading = ref(false);

  return {
    // Sidebar
    sidebarCollapsed,
    sidebarMobileOpen,
    toggleSidebar,
    toggleMobileSidebar,
    closeMobileSidebar,
    // Breadcrumbs
    breadcrumbs,
    setBreadcrumbs,
    // Toasts
    toasts,
    addToast,
    removeToast,
    toast,
    // Page
    pageTitle,
    setPageTitle,
    globalLoading,
  };
});
