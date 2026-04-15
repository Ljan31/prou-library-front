<script setup lang="ts">
import { ref } from 'vue'
import NuevoPrestamo from './NuevoPrestamo.vue'
import HistorialPrestamosView from './HistorialPrestamosView.vue'

// ─── TAB VIEW ────────────────────────────────────────────────────────────────
type TabView = 'nuevo' | 'lista'
const activeTab = ref<TabView>('nuevo')

</script>

<template>
  <div class="page-container space-y-6">

    <!-- Header -->
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Gestión de Préstamos</h1>
        <p class="text-sm text-slate-500 mt-0.5">Registra nuevos préstamos y consulta el historial</p>
      </div>
      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
        <button @click="activeTab = 'nuevo'" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'nuevo'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        ]">
          Nuevo Préstamo
        </button>
        <button @click="activeTab = 'lista'" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'lista'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        ]">
          Historial
        </button>
      </div>
    </div>

    <!-- ═══════════════════ NUEVO PRÉSTAMO ═══════════════════ -->
    <NuevoPrestamo v-if="activeTab === 'nuevo'" />

    <!-- ═══════════════════ HISTORIAL ═══════════════════ -->
    <HistorialPrestamosView v-if="activeTab === 'lista'" />

  </div>
</template>