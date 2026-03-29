<script setup lang="ts">
import { onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'

const ui = useUiStore()
onMounted(() => ui.setBreadcrumbs([{ label: 'Usuarios' }]))
</script>

<template>
  <div class="page-container">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Gestión de Usuarios</h1>
      <p class="text-sm text-slate-500 mt-0.5">Administra usuarios, roles y permisos del sistema</p>
    </div>
    <SCard>
      <SEmptyState title="Módulo en construcción"
        description="El Equipo 3 conectará este módulo al backend. La ruta y el guard de rol ya están configurados."
        icon="inbox" />
    </SCard>
  </div>
</template>
