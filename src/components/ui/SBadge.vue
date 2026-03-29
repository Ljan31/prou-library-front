<!-- ============================================
     SBadge.vue – Etiqueta/chip de estado
     ============================================ -->
<template>
  <span :class="['s-badge', `s-badge--${variant}`, `s-badge--${size}`, dot && 's-badge--dot']">
    <span v-if="dot" class="s-badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<script setup lang="ts">
type Variant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
type Size = 'sm' | 'md' | 'lg'

withDefaults(defineProps<{ variant?: Variant; size?: Size; dot?: boolean }>(), {
  variant: 'default', size: 'md',
})
</script>

<style scoped>
.s-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-weight: var(--font-semibold);
  border-radius: var(--radius-full);
  white-space: nowrap;
  line-height: 1;
}

/* Sizes */
.s-badge--sm {
  padding: 0.2em 0.55em;
  font-size: 0.6875rem;
}

.s-badge--md {
  padding: 0.3em 0.7em;
  font-size: var(--text-xs);
}

.s-badge--lg {
  padding: 0.4em 0.9em;
  font-size: var(--text-sm);
}

/* Variants */
.s-badge--default {
  background: var(--color-neutral-100);
  color: var(--color-neutral-700);
}

.s-badge--primary {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}

.s-badge--secondary {
  background: var(--color-secondary-100);
  color: var(--color-secondary-700);
}

.s-badge--success {
  background: var(--color-success-100);
  color: var(--color-success-700);
}

.s-badge--warning {
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}

.s-badge--error {
  background: var(--color-error-100);
  color: var(--color-error-700);
}

.s-badge--info {
  background: var(--color-info-100);
  color: var(--color-info-600);
}

/* Dot */
.s-badge__dot {
  width: 0.45em;
  height: 0.45em;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
</style>