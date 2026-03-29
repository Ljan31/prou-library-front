<script setup lang="ts">
import { onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
const ui = useUiStore()
onMounted(() => ui.setBreadcrumbs([{ label: 'Préstamos' }]))
</script>
<template>
  <div class="page-container">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Gestión de Préstamos</h1>
      <p class="text-sm text-slate-500 mt-0.5">Registra y administra préstamos de libros</p>
    </div>
    <SCard>
      <SEmptyState title="Módulo en construcción"
        description="Ruta y guards configurados. Equipo 3 conectará al backend." icon="book" />
    </SCard>
  </div>
</template>
