<script setup lang="ts">
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'

withDefaults(defineProps<{
  title: string
  description?: string
  loading?: boolean
  empty?: boolean
}>(), { loading: false, empty: false })
</script>

<template>
  <SCard variant="bordered" padding="lg" class="h-full">
    <header class="mb-4">
      <h3 class="text-sm font-semibold text-slate-900">{{ title }}</h3>
      <p v-if="description" class="text-xs text-slate-400 mt-0.5">{{ description }}</p>
    </header>

    <SSkeleton v-if="loading" width="100%" height="16rem" />
    <SEmptyState
      v-else-if="empty"
      icon="chart"
      title="Sin datos"
      description="No hay registros para mostrar en este período."
    />
    <div v-else class="relative h-64"><slot /></div>
  </SCard>
</template>