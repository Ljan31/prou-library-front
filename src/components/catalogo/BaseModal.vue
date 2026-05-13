<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}>(), { size: 'md', title: '', })

const emit = defineEmits<{ close: [] }>()

const maxWidths: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-7xl',
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <!-- Overlay -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel -->
      <div :class="['relative w-full bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]', maxWidths[size]]"
        @click.stop>
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div class="flex-1 min-w-0">
            <slot name="header">
              <h2 v-if="title" class="text-base font-semibold text-slate-900 truncate pr-4">
                {{ title }}
              </h2>
            </slot>
          </div>

          <button @click="emit('close')"
            class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <!-- <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 class="text-base font-semibold text-slate-900 truncate pr-4">{{ title }}</h2>
          <button @click="emit('close')"
            class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div> -->

        <!-- Body -->
        <div class="overflow-y-auto flex-1 px-6 py-5">
          <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer"
          class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>