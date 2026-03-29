<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

defineProps<{ class?: string }>()

const route = useRoute()

const crumbs = computed(() => {
  const parts = route.path.split('/').filter(Boolean)
  const items = [{ label: 'Inicio', to: '/dashboard' }]

  let built = ''
  for (const part of parts) {
    built += '/' + part
    const matched = route.matched.find(r => r.path === built)
    const label = matched?.meta?.breadcrumb as string | undefined
    if (label && label !== 'Dashboard') {
      items.push({ label, to: built })
    }
  }

  return items
})
</script>

<template>
  <nav :class="$props.class" aria-label="Breadcrumb">
    <ol class="flex items-center gap-1.5 text-sm min-w-0">
      <li v-for="(crumb, i) in crumbs" :key="crumb.to" class="flex items-center gap-1.5 min-w-0">
        <svg v-if="i > 0" class="w-3.5 h-3.5 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <RouterLink v-if="i < crumbs.length - 1" :to="crumb.to"
          class="text-slate-400 hover:text-slate-700 transition-colors truncate">
          {{ crumb.label }}
        </RouterLink>
        <span v-else class="text-slate-800 font-medium truncate">
          {{ crumb.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>
