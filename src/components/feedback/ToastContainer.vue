<script setup lang="ts">
import { useUiStore } from '@/store/ui.store'

const ui = useUiStore()

const icons = {
  success: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  error: `<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>`,
  warning: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  info: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`
}

const colors = {
  success: 'border-l-emerald-500 bg-white',
  error: 'border-l-red-500 bg-white',
  warning: 'border-l-amber-500 bg-white',
  info: 'border-l-blue-500 bg-white'
}

const iconColors = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="slide-up" tag="div" class="flex flex-col gap-2">
        <div v-for="toast in ui.toasts" :key="toast.id"
          class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 shadow-lg min-w-[280px] max-w-[360px]"
          :class="colors[toast.type]" style="box-shadow: 0 4px 20px rgba(0,0,0,0.12)">
          <svg class="w-4 h-4 mt-0.5 shrink-0" :class="iconColors[toast.type]" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" v-html="icons[toast.type]" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800">{{ toast.title }}</p>
            <p v-if="toast.message" class="text-xs text-slate-500 mt-0.5 leading-snug">{{ toast.message }}</p>
          </div>
          <button class="shrink-0 text-slate-300 hover:text-slate-500 transition-colors ml-1"
            @click="ui.removeToast(toast.id)">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
