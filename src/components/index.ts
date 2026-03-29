// ============================================
// SIGEB – Design System Component Index
// Equipo 2 UI/UX – Exportaciones centralizadas
// ============================================

// ── UI Base ──────────────────────────────────
export { default as SButton } from "./ui/SButton.vue";
export { default as SInput } from "./ui/SInput.vue";
export { default as SSelect } from "./ui/SSelect.vue";
export { default as SCard } from "./ui/SCard.vue";
export { default as STable } from "./ui/STable.vue";
export { default as SModal } from "./ui/SModal.vue";
export { default as SBadge } from "./ui/SBadge.vue";
export { default as SAlert } from "./ui/SAlert.vue";
export { default as STooltip } from "./ui/STooltip.vue";
export { default as SToastContainer } from "./ui/SToastContainer.vue";

// ── Feedback ─────────────────────────────────
export { default as SSkeleton } from "./feedback/SSkeleton.vue";
export { default as SSpinner } from "./feedback/SSpinner.vue";
export { default as SEmptyState } from "./feedback/SEmptyState.vue";

// ── Composables ──────────────────────────────
export { useToast } from "../composables/useToast";
export type { Toast, ToastType } from "../composables/useToast";
