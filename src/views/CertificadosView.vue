<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'

import CertificadosGenerar from './certificado/CertificadosGenerar.vue'
import CertificadosValidar from './certificado/CertificadosValidar.vue'
import CertificadosHistorial from './certificado/CertificadosHistorial.vue'

const ui = useUiStore()
const { isAdmin, isBibliotecario } = usePermissions()

type Tab = 'generar' | 'validar' | 'historial'
const activeTab = ref<Tab>('generar')

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Certificados' }])
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab') as Tab | null
  if (tab && ['generar', 'validar', 'historial'].includes(tab)) {
    activeTab.value = tab
  }
})
</script>

<template>
  <div class="page-container space-y-6">

    <!-- ── Header + Tabs ── -->
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Certificados de No Deuda</h1>
        <p class="text-sm text-slate-500 mt-0.5">Genera y valida certificados de no deuda bibliográfica</p>
      </div>

      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
        <button @click="activeTab = 'generar'" :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'generar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']">
          Generar
        </button>
        <button @click="activeTab = 'validar'" :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'validar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']">
          Validar
        </button>
        <!-- Historial solo para staff -->
        <button v-if="isAdmin || isBibliotecario" @click="activeTab = 'historial'" :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'historial' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']">
          Historial
        </button>
      </div>
    </div>

    <!-- ── Contenido por tab ── -->
    <CertificadosGenerar v-if="activeTab === 'generar'" :key="'generar'" />
    <CertificadosValidar v-if="activeTab === 'validar'" :key="'validar'" />
    <CertificadosHistorial v-if="activeTab === 'historial'" :key="'historial'" />

  </div>
</template>