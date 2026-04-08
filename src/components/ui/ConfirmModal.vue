<script setup lang="ts">
/**
 * ConfirmModal — Modal de confirmación reutilizable.
 *
 * Uso:
 * <ConfirmModal
 *   v-model="showConfirm"
 *   title="¿Eliminar usuario?"
 *   message="Esta acción no se puede deshacer."
 *   confirm-label="Sí, eliminar"
 *   variant="danger"
 *   :loading="deleteLoading"
 *   @confirm="handleDelete"
 * />
 */

defineProps<{
  modelValue: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' = rojo, 'warning' = ámbar, 'info' = índigo */
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Transition name="fade">
    <div v-if="modelValue"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      @click.self="$emit('update:modelValue', false)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div class="p-6 text-center">

          <!-- Icon -->
          <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" :class="{
            'bg-red-100': variant === 'danger' || !variant,
            'bg-amber-100': variant === 'warning',
            'bg-indigo-100': variant === 'info',
          }">
            <!-- danger / default -->
            <svg v-if="variant !== 'warning' && variant !== 'info'" class="w-6 h-6 text-red-500" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <!-- warning -->
            <svg v-else-if="variant === 'warning'" class="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <!-- info -->
            <svg v-else class="w-6 h-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>

          <h3 class="text-base font-semibold text-slate-900 mb-2">{{ title }}</h3>

          <!-- Message slot (for rich content) or plain prop -->
          <div class="text-sm text-slate-500 leading-relaxed">
            <slot>{{ message }}</slot>
          </div>
        </div>

        <div class="px-6 pb-6 flex gap-3">
          <button
            class="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors font-medium"
            @click="$emit('update:modelValue', false)">{{ cancelLabel ?? 'Cancelar' }}</button>

          <button
            class="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            :class="{
              'bg-red-500 hover:bg-red-600': variant === 'danger' || !variant,
              'bg-amber-500 hover:bg-amber-600': variant === 'warning',
              'bg-indigo-600 hover:bg-indigo-500': variant === 'info',
            }" :disabled="loading" @click="$emit('confirm')">
            <svg v-if="loading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? 'Procesando…' : (confirmLabel ?? 'Confirmar') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>