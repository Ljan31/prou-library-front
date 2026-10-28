<script setup lang="ts">
type IconName =
  | 'search' | 'check' | 'check-circle' | 'warning' | 'ban' | 'x' | 'info'
  | 'exclamation' | 'cash' | 'chevron-right' | 'arrow-right' | 'clipboard' | 'spinner'

withDefaults(defineProps<{ name: IconName; strokeWidth?: number }>(), { strokeWidth: 2 })

const PATHS: Record<Exclude<IconName, 'spinner'>, string> = {
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  check: 'M5 13l4 4L19 7',
  'check-circle': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  ban: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  x: 'M6 18L18 6M6 6l12 12',
  info: 'M13 16h-1v-4h-1m1-4h.01',
  exclamation: 'M12 9v2m0 4h.01',
  cash: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'chevron-right': 'M9 5l7 7-7 7',
  'arrow-right': 'M17 8l4 4m0 0l-4 4m4-4H3',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
}
</script>

<template>
  <svg v-if="name === 'spinner'" class="animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
  <svg v-else fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="strokeWidth" :d="PATHS[name]" />
  </svg>
</template>
