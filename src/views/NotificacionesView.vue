<script setup lang="ts">
import { onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
const ui = useUiStore()
onMounted(() => ui.setBreadcrumbs([{ label: 'Notificaciones' }]))
</script>
<template>
  <div class="page-container">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Notificaciones</h1>
      <p class="text-sm text-slate-500 mt-0.5">Alertas, avisos y recordatorios del sistema</p>
    </div>
    <SCard>
      <SEmptyState title="Sin notificaciones" description="No tienes notificaciones pendientes." />
    </SCard>
  </div>
</template>
