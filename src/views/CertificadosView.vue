<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'

import CertificadosGenerar from './certificado/CertificadosGenerar.vue'
import CertificadosValidar from './certificado/CertificadosValidar.vue'

// Stores y permisos
const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin, isBibliotecario, isEstudiante } = usePermissions()

// Tab activo
const activeTab = ref<'generar' | 'validar'>('generar')

// ─── Breadcrumbs + QR params ─────────────────────────────────
onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Certificados' }])

  const params = new URLSearchParams(window.location.search)
  if (params.get('tab') === 'validar') activeTab.value = 'validar'
})
</script>

<template>
  <div class="page-container space-y-6">
    <!-- Header + Tabs -->
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Certificados de No Deuda</h1>
        <p class="text-sm text-slate-500 mt-0.5">Genera y valida certificados de no deuda bibliográfica</p>
      </div>

      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
        <button @click="activeTab = 'generar'" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'generar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        ]">
          Generar Certificado
        </button>
        <button @click="activeTab = 'validar'" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'validar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        ]">
          Validar Código
        </button>
      </div>
    </div>

    <!-- Contenido según tab -->
    <CertificadosGenerar v-if="activeTab === 'generar'" :key="activeTab" />
    <CertificadosValidar v-if="activeTab === 'validar'" :key="activeTab" />
  </div>
</template>