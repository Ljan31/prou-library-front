<script setup lang="ts">
import { onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
const ui = useUiStore()
onMounted(() => ui.setBreadcrumbs([{ label: 'Certificados' }]))
</script>
<template>
  <div class="page-container">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Certificados de No Deuda</h1>
      <p class="text-sm text-slate-500 mt-0.5">Genera y descarga certificados bibliográficos</p>
    </div>
    <SCard>
      <SEmptyState title="Módulo en construcción"
        description="Ruta configurada para todos los roles. Equipo 3 conectará la generación al backend." />
    </SCard>
  </div>
</template>
