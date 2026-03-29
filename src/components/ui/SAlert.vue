<template>
  <Transition name="v-slide">
    <div v-if="visible" :class="['s-alert', `s-alert--${variant}`]" role="alert"
      :aria-live="variant === 'error' ? 'assertive' : 'polite'">
      <!-- Ícono -->
      <span class="s-alert__icon" aria-hidden="true">
        <svg v-if="variant === 'success'" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd" />
        </svg>
        <svg v-else-if="variant === 'error'" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd" />
        </svg>
        <svg v-else-if="variant === 'warning'" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd" />
        </svg>
        <svg v-else viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
          <path fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clip-rule="evenodd" />
        </svg>
      </span>

      <!-- Contenido -->
      <div class="s-alert__content">
        <p v-if="title" class="s-alert__title">{{ title }}</p>
        <p class="s-alert__message">
          <slot />
        </p>
      </div>

      <!-- Botón cerrar -->
      <button v-if="dismissible" type="button" class="s-alert__dismiss" aria-label="Cerrar alerta" @click="dismiss">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type Variant = 'info' | 'success' | 'warning' | 'error'

const props = withDefaults(defineProps<{
  variant?: Variant
  title?: string
  dismissible?: boolean
}>(), { variant: 'info' })

const emit = defineEmits<{ dismiss: [] }>()
const visible = ref(true)
function dismiss() { visible.value = false; emit('dismiss') }
</script>

<style scoped>
.s-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
}

/* Variants */
.s-alert--info {
  background: var(--color-info-50);
  border-color: var(--color-info-100);
  color: var(--color-info-600);
}

.s-alert--success {
  background: var(--color-success-50);
  border-color: var(--color-success-100);
  color: var(--color-success-700);
}

.s-alert--warning {
  background: var(--color-warning-50);
  border-color: var(--color-warning-100);
  color: var(--color-warning-700);
}

.s-alert--error {
  background: var(--color-error-50);
  border-color: var(--color-error-100);
  color: var(--color-error-700);
}

.s-alert__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.s-alert__content {
  flex: 1;
  min-width: 0;
}

.s-alert__title {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  margin-bottom: 0.2rem;
}

.s-alert__message {
  font-size: var(--text-sm);
  opacity: 0.9;
}

.s-alert__dismiss {
  display: flex;
  align-items: center;
  padding: 0.25rem;
  border: none;
  background: none;
  cursor: pointer;
  color: currentColor;
  border-radius: var(--radius-sm);
  opacity: 0.6;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.s-alert__dismiss:hover {
  opacity: 1;
}
</style>