<template>
  <component :is="tag" :type="tag === 'button' ? type : undefined" :href="tag === 'a' ? href : undefined"
    :disabled="disabled || loading" :aria-busy="loading" :aria-disabled="disabled || loading" :class="classes"
    v-bind="$attrs" @click="handleClick">
    <!-- Spinner de carga -->
    <span v-if="loading" class="s-btn__spinner" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
          stroke-dasharray="31.416" stroke-dashoffset="10" />
      </svg>
    </span>

    <!-- Ícono izquierdo -->
    <span v-if="iconLeft && !loading" class="s-btn__icon s-btn__icon--left" aria-hidden="true">
      <slot name="icon-left">
        <component :is="iconLeft" />
      </slot>
    </span>

    <!-- Texto del botón -->
    <span class="s-btn__label">
      <slot />
    </span>

    <!-- Ícono derecho -->
    <span v-if="iconRight" class="s-btn__icon s-btn__icon--right" aria-hidden="true">
      <slot name="icon-right">
        <component :is="iconRight" />
      </slot>
    </span>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'outline'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type Tag = 'button' | 'a' | 'router-link'

interface Props {
  variant?: Variant
  size?: Size
  tag?: Tag
  type?: 'button' | 'submit' | 'reset'
  href?: string
  disabled?: boolean
  loading?: boolean
  full?: boolean
  iconLeft?: object
  iconRight?: object
  iconOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  tag: 'button',
  type: 'button',
})

const emit = defineEmits<{ click: [e: MouseEvent] }>()

const classes = computed(() => [
  's-btn',
  `s-btn--${props.variant}`,
  `s-btn--${props.size}`,
  props.full && 's-btn--full',
  props.loading && 's-btn--loading',
  props.disabled && 's-btn--disabled',
  props.iconOnly && 's-btn--icon-only',
])

function handleClick(e: MouseEvent) {
  if (!props.disabled && !props.loading) emit('click', e)
}
</script>

<style scoped>
/* ── Base ── */
.s-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-weight: var(--font-semibold);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  border: 1.5px solid transparent;
  border-radius: var(--radius-lg);
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast),
    opacity var(--transition-fast);
  text-decoration: none;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.s-btn:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  transform: translateY(-1px);
}

.s-btn:active:not(.s-btn--disabled):not(.s-btn--loading) {
  transform: translateY(0) scale(0.98);
}

/* ── Sizes ── */
.s-btn--xs {
  padding: 0.25rem 0.625rem;
  font-size: var(--text-xs);
  border-radius: var(--radius-md);
}

.s-btn--sm {
  padding: 0.375rem 0.875rem;
  font-size: var(--text-sm);
}

.s-btn--md {
  padding: 0.5625rem 1.25rem;
  font-size: var(--text-sm);
}

.s-btn--lg {
  padding: 0.75rem 1.625rem;
  font-size: var(--text-base);
}

.s-btn--xl {
  padding: 0.9375rem 2rem;
  font-size: var(--text-lg);
}

/* Icon only adjustments */
.s-btn--icon-only.s-btn--xs {
  padding: 0.25rem;
  width: 1.75rem;
  height: 1.75rem;
}

.s-btn--icon-only.s-btn--sm {
  padding: 0.375rem;
  width: 2.125rem;
  height: 2.125rem;
}

.s-btn--icon-only.s-btn--md {
  padding: 0.5625rem;
  width: 2.5rem;
  height: 2.5rem;
}

.s-btn--icon-only.s-btn--lg {
  padding: 0.75rem;
  width: 3rem;
  height: 3rem;
}

/* ── Variants ── */
/* Primary */
.s-btn--primary {
  background: var(--color-primary-600);
  color: var(--color-neutral-0);
  border-color: var(--color-primary-600);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .1);
}

.s-btn--primary:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  background: var(--color-primary-700);
  border-color: var(--color-primary-700);
  box-shadow: var(--shadow-primary);
}

/* Secondary */
.s-btn--secondary {
  background: var(--color-neutral-100);
  color: var(--color-neutral-800);
  border-color: var(--color-neutral-200);
}

.s-btn--secondary:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  background: var(--color-neutral-200);
  border-color: var(--color-neutral-300);
}

/* Ghost */
.s-btn--ghost {
  background: transparent;
  color: var(--color-neutral-700);
  border-color: transparent;
}

.s-btn--ghost:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  background: var(--color-neutral-100);
  color: var(--color-neutral-900);
}

/* Outline */
.s-btn--outline {
  background: transparent;
  color: var(--color-primary-600);
  border-color: var(--color-primary-300);
}

.s-btn--outline:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  background: var(--color-primary-50);
  border-color: var(--color-primary-500);
}

/* Danger */
.s-btn--danger {
  background: var(--color-error-600);
  color: #fff;
  border-color: var(--color-error-600);
}

.s-btn--danger:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  background: var(--color-error-700);
  border-color: var(--color-error-700);
  box-shadow: 0 4px 14px rgba(239, 68, 68, .35);
}

/* Success */
.s-btn--success {
  background: var(--color-success-600);
  color: #fff;
  border-color: var(--color-success-600);
}

.s-btn--success:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  background: var(--color-success-700);
}

/* Warning */
.s-btn--warning {
  background: var(--color-warning-500);
  color: #fff;
  border-color: var(--color-warning-500);
}

.s-btn--warning:hover:not(.s-btn--disabled):not(.s-btn--loading) {
  background: var(--color-warning-600);
}

/* ── States ── */
.s-btn--full {
  width: 100%;
}

.s-btn--disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

.s-btn--loading {
  cursor: wait;
  pointer-events: none;
}

/* ── Spinner ── */
.s-btn__spinner {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.s-btn__spinner svg {
  animation: spin 0.75s linear infinite;
}

.s-btn--xs .s-btn__spinner svg {
  width: 12px;
  height: 12px;
}

.s-btn--sm .s-btn__spinner svg {
  width: 14px;
  height: 14px;
}

.s-btn--md .s-btn__spinner svg {
  width: 16px;
  height: 16px;
}

.s-btn--lg .s-btn__spinner svg {
  width: 18px;
  height: 18px;
}

/* ── Icons ── */
.s-btn__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.s-btn--xs .s-btn__icon :deep(svg),
.s-btn--xs .s-btn__icon :deep(img) {
  width: 12px;
  height: 12px;
}

.s-btn--sm .s-btn__icon :deep(svg),
.s-btn--sm .s-btn__icon :deep(img) {
  width: 14px;
  height: 14px;
}

.s-btn--md .s-btn__icon :deep(svg),
.s-btn--md .s-btn__icon :deep(img) {
  width: 16px;
  height: 16px;
}

.s-btn--lg .s-btn__icon :deep(svg),
.s-btn--lg .s-btn__icon :deep(img) {
  width: 18px;
  height: 18px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>