<template>
  <Teleport to="body">
    <Transition name="v-modal">
      <div v-if="modelValue" class="s-modal-overlay" :aria-modal="true" role="dialog" :aria-labelledby="titleId"
        :aria-describedby="descriptionId" @mousedown.self="closeOnBackdrop && close()"
        @keydown.esc="closeOnEsc && close()">
        <div :class="['s-modal', `s-modal--${size}`, 'modal-panel']" ref="panelRef" tabindex="-1">
          <!-- Header -->
          <div class="s-modal__header">
            <div class="s-modal__header-content">
              <!-- Ícono de variante -->
              <span v-if="variant !== 'default'" :class="['s-modal__icon', `s-modal__icon--${variant}`]"
                aria-hidden="true">
                <svg v-if="variant === 'danger'" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fill-rule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd" />
                </svg>
                <svg v-else-if="variant === 'success'" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd" />
                </svg>
                <svg v-else-if="variant === 'info'" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd" />
                </svg>
                <svg v-else-if="variant === 'warning'" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fill-rule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd" />
                </svg>
              </span>
              <h2 v-if="title" :id="titleId" class="s-modal__title">{{ title }}</h2>
            </div>
            <button v-if="showClose" type="button" class="s-modal__close" aria-label="Cerrar modal" @click="close">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div :id="descriptionId" class="s-modal__body">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="s-modal__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount, computed } from 'vue'

type Size = 'sm' | 'md' | 'lg' | 'xl' | 'full'
type Variant = 'default' | 'danger' | 'success' | 'info' | 'warning'

interface Props {
  modelValue?: boolean
  title?: string
  size?: Size
  variant?: Variant
  showClose?: boolean
  closeOnBackdrop?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default',
  showClose: true,
  closeOnBackdrop: true,
  closeOnEsc: true,
})

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  close: []
}>()

const panelRef = ref<HTMLElement>()
const uid = Math.random().toString(36).slice(2, 8)
const titleId = computed(() => `s-modal-title-${uid}`)
const descriptionId = computed(() => `s-modal-desc-${uid}`)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    await nextTick()
    panelRef.value?.focus()
  } else {
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => { document.body.style.overflow = '' })
</script>

<style scoped>
/* ── Overlay ────────────────────────────────────────────────────────────── */
.s-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(9, 14, 26, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

/* ── Panel ──────────────────────────────────────────────────────────────── */
.s-modal {
  background: #ffffff;
  border-radius: 1rem;
  /* rounded-2xl */
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  outline: none;
  width: 100%;
}

/* Tamaños */
.s-modal--sm {
  max-width: 24rem;
}

.s-modal--md {
  max-width: 36rem;
}

.s-modal--lg {
  max-width: 52rem;
}

.s-modal--xl {
  max-width: 72rem;
}

.s-modal--full {
  max-width: calc(100vw - 2rem);
  max-height: calc(100vh - 2rem);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.s-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1.25rem;
  gap: 1rem;
  border-bottom: 1px solid #f1f5f9;
  /* slate-100 */
}

.s-modal__header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Íconos de variante */
.s-modal__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  /* rounded-xl */
  flex-shrink: 0;
}

.s-modal__icon--danger {
  background: #fee2e2;
  color: #dc2626;
}

/* red-100 / red-600 */
.s-modal__icon--success {
  background: #d1fae5;
  color: #059669;
}

/* emerald-100 / emerald-600 */
.s-modal__icon--info {
  background: #dbeafe;
  color: #2563eb;
}

/* blue-100 / blue-600 */
.s-modal__icon--warning {
  background: #fef3c7;
  color: #d97706;
}

/* amber-100 / amber-600 */

.s-modal__title {
  font-family: "DM Sans", system-ui, sans-serif;
  font-size: 1.125rem;
  /* text-lg */
  font-weight: 600;
  color: #0f172a;
  /* slate-900 */
  margin: 0;
  line-height: 1.3;
}

.s-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: none;
  color: #94a3b8;
  /* slate-400 */
  cursor: pointer;
  border-radius: 0.5rem;
  /* rounded-lg */
  transition: color 150ms ease, background 150ms ease;
  flex-shrink: 0;
  margin-top: -0.25rem;
  margin-right: -0.25rem;
}

.s-modal__close:hover {
  color: #334155;
  /* slate-700 */
  background: #f1f5f9;
  /* slate-100 */
}

/* ── Body ───────────────────────────────────────────────────────────────── */
.s-modal__body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  font-size: 0.875rem;
  /* text-sm */
  color: #334155;
  /* slate-700 */
  line-height: 1.6;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */
.s-modal__footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #f1f5f9;
  /* slate-100 */
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: #f8fafc;
  /* slate-50 */
}
</style>

<style>
/* ── Vue Transition — fuera de scoped para afectar .modal-panel ──────────── */
.v-modal-enter-active {
  transition: opacity 200ms ease;
}

.v-modal-leave-active {
  transition: opacity 150ms ease;
}

.v-modal-enter-from,
.v-modal-leave-to {
  opacity: 0;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.v-modal-enter-active .modal-panel {
  animation: scaleIn 250ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.v-modal-leave-active .modal-panel {
  animation: scaleIn 150ms ease reverse both;
}
</style>
