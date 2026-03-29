<!-- SSpinner.vue -->
<template>
  <span :class="['s-spinner', `s-spinner--${size}`, `s-spinner--${variant}`]" role="status" :aria-label="label">
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
        stroke-dasharray="31.416" stroke-dashoffset="10" />
    </svg>
    <span class="sr-only">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type Variant = 'primary' | 'white' | 'neutral'

withDefaults(defineProps<{ size?: Size; variant?: Variant; label?: string }>(), {
  size: 'md', variant: 'primary', label: 'Cargando...',
})
</script>

<style scoped>
.s-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.s-spinner svg {
  animation: spin 0.75s linear infinite;
}

.s-spinner--xs svg {
  width: 12px;
  height: 12px;
}

.s-spinner--sm svg {
  width: 16px;
  height: 16px;
}

.s-spinner--md svg {
  width: 24px;
  height: 24px;
}

.s-spinner--lg svg {
  width: 36px;
  height: 36px;
}

.s-spinner--xl svg {
  width: 48px;
  height: 48px;
}

.s-spinner--primary {
  color: var(--color-primary-600);
}

.s-spinner--white {
  color: white;
}

.s-spinner--neutral {
  color: var(--color-neutral-400);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>