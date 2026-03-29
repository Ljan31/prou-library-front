<script setup lang="ts">
import { onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
const ui = useUiStore()
onMounted(() => ui.setBreadcrumbs([{ label: 'Mis Préstamos' }]))
</script>
<template>
  <div class="page-container">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Mis Préstamos</h1>
      <p class="text-sm text-slate-500 mt-0.5">Consulta tus préstamos activos e historial personal</p>
    </div>
    <SCard>
      <SEmptyState title="Sin préstamos activos" description="No tienes préstamos registrados actualmente."
        icon="book" />
    </SCard>
  </div>
</template>
