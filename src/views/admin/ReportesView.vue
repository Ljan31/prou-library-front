<script setup lang="ts">
import { onMounted } from 'vue'
import { useUiStore } from '@/store/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
const ui = useUiStore()
onMounted(() => ui.setBreadcrumbs([{ label: 'Reportes' }]))
</script>
<template>
  <div class="page-container">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Reportes</h1>
      <p class="text-sm text-slate-500 mt-0.5">Métricas y estadísticas del sistema</p>
    </div>
    <SCard>
      <SEmptyState title="Módulo en construcción"
        description="Ruta y guards configurados. Equipo 3 conectará al backend." icon="chart" />
    </SCard>
  </div>
</template>
