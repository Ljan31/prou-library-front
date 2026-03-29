<!-- SToastContainer.vue – Montar una sola vez en App.vue -->
<template>
  <Teleport to="body">
    <div class="s-toast-container" role="region" aria-label="Notificaciones" aria-live="polite">
      <TransitionGroup name="toast-group" tag="div" class="s-toast-list">
        <div v-for="toast in toasts" :key="toast.id" :class="['s-toast', `s-toast--${toast.type}`]" role="status">
          <!-- Ícono -->
          <span class="s-toast__icon" aria-hidden="true">
            <svg v-if="toast.type === 'success'" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd" />
            </svg>
            <svg v-else-if="toast.type === 'error'" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd" />
            </svg>
            <svg v-else-if="toast.type === 'warning'" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
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
          <div class="s-toast__content">
            <p v-if="toast.title" class="s-toast__title">{{ toast.title }}</p>
            <p class="s-toast__message">{{ toast.message }}</p>
          </div>

          <!-- Progress bar -->
          <div v-if="toast.duration" class="s-toast__progress">
            <div class="s-toast__progress-bar" :style="{ animationDuration: `${toast.duration}ms` }" />
          </div>

          <!-- Dismiss -->
          <button type="button" class="s-toast__dismiss" aria-label="Cerrar" @click="dismiss(toast.id)">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../../composables/useToast'
const { toasts, dismiss } = useToast()
</script>

<style scoped>
.s-toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  pointer-events: none;
  max-width: 24rem;
  width: calc(100vw - 3rem);
}

.s-toast-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.s-toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1rem 1rem 1rem;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  pointer-events: all;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);
  border: 1px solid transparent;
  animation: toastSlideIn 300ms cubic-bezier(.34, 1.56, .64, 1) both;
}

.s-toast--info {
  background: white;
  border-color: var(--color-info-100);
}

.s-toast--success {
  background: white;
  border-color: var(--color-success-100);
}

.s-toast--warning {
  background: white;
  border-color: var(--color-warning-100);
}

.s-toast--error {
  background: white;
  border-color: var(--color-error-100);
}

.s-toast__icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.s-toast--info .s-toast__icon {
  color: var(--color-info-500);
}

.s-toast--success .s-toast__icon {
  color: var(--color-success-500);
}

.s-toast--warning .s-toast__icon {
  color: var(--color-warning-500);
}

.s-toast--error .s-toast__icon {
  color: var(--color-error-500);
}

.s-toast__content {
  flex: 1;
  min-width: 0;
}

.s-toast__title {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--color-neutral-900);
  margin-bottom: 0.125rem;
}

.s-toast__message {
  font-size: var(--text-sm);
  color: var(--color-neutral-600);
  line-height: 1.4;
}

.s-toast__dismiss {
  display: flex;
  align-items: center;
  padding: 0.25rem;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-neutral-400);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
  flex-shrink: 0;
  margin-top: -0.125rem;
}

.s-toast__dismiss:hover {
  color: var(--color-neutral-700);
}

/* Progress bar */
.s-toast__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.s-toast__progress-bar {
  height: 100%;
  border-radius: 2px;
  animation: progress-shrink linear forwards;
  transform-origin: left;
}

.s-toast--info .s-toast__progress-bar {
  background: var(--color-info-400);
}

.s-toast--success .s-toast__progress-bar {
  background: var(--color-success-400);
}

.s-toast--warning .s-toast__progress-bar {
  background: var(--color-warning-400);
}

.s-toast--error .s-toast__progress-bar {
  background: var(--color-error-400);
}

@keyframes progress-shrink {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

/* TransitionGroup */
.toast-group-enter-active {
  animation: toastSlideIn 300ms cubic-bezier(.34, 1.56, .64, 1) both;
}

.toast-group-leave-active {
  transition: all 200ms ease;
  position: absolute;
  width: 100%;
}

.toast-group-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-group-move {
  transition: transform 200ms ease;
}
</style>