<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  icon?: 'book' | 'search' | 'inbox' | 'chart'
}>(), {
  title: 'Sin resultados',
  description: 'No se encontraron datos para mostrar.',
  icon: 'inbox'
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
      <svg class="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <template v-if="icon === 'book'">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </template>
        <template v-else-if="icon === 'search'">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </template>
        <template v-else-if="icon === 'chart'">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
          <line x1="2" y1="20" x2="22" y2="20" />
        </template>
        <template v-else>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path
            d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
        </template>
      </svg>
    </div>
    <h3 class="text-sm font-semibold text-slate-700 mb-1">{{ title }}</h3>
    <p class="text-sm text-slate-400 max-w-xs leading-relaxed">{{ description }}</p>
    <slot />
  </div>
</template>
