<script setup lang="ts">
import { onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePrestamos } from '@/composables/usePrestamos'

const ui = useUiStore()

const {
  prestamos,
  loading,
  error,
  fetchPrestamos,
  activos,
  historial
} = usePrestamos()

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Mis Préstamos' }])
  fetchPrestamos()
})

function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO')
}
</script>
<template>
  <div class="page-container space-y-6">

    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Mis Préstamos</h1>
      <p class="text-sm text-slate-500 mt-1">
        Consulta tus préstamos activos e historial personal
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 bg-slate-100 rounded-2xl animate-pulse" />
    </div>

    <!-- Error -->
    <div v-else-if="error"
      class="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
      <span>⚠️</span>
      {{ error }}
    </div>

    <div v-else class="space-y-6">

      <!-- ================= ACTIVOS ================= -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-2.5 px-5 py-4 border-b bg-slate-50/50">
          <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" d="M12 6.253v13M12 6.253C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" />
          </svg>
          <h3 class="font-semibold text-slate-800 text-sm">Préstamos Activos</h3>

          <span class="ml-auto text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
            {{ activos.length }}
          </span>
        </div>

        <!-- Lista -->
        <div v-if="activos.length" class="divide-y divide-slate-50">
          <div v-for="p in activos" :key="p.id_prestamo"
            class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition">

            <!-- Icon -->
            <div class="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
              📖
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-slate-800 text-sm truncate">
                {{ p.ejemplar?.libro?.titulo ?? 'Libro desconocido' }}
              </p>
              <p class="text-xs text-slate-500 mt-0.5">
                Ejemplar: {{ p.ejemplar?.codigo_ejemplar ?? '—' }}
              </p>
              <p class="text-xs text-red-500 mt-0.5">
                Vence: {{ formatDate(p.fechaDevolucionEstimada) }}
              </p>
            </div>

            <!-- Estado -->
            <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              {{ p.estadoPrestamo }}
            </span>

          </div>
        </div>

        <!-- Empty -->
        <div v-else class="py-10 text-center">
          <p class="text-sm text-slate-400">No tienes préstamos activos</p>
        </div>

      </div>

      <!-- ================= HISTORIAL ================= -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <!-- Header -->
        <div class="flex items-center gap-2.5 px-5 py-4 border-b bg-slate-50/50">
          <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" d="M9 12l2 2 4-4" />
          </svg>
          <h3 class="font-semibold text-slate-800 text-sm">Historial de Préstamos</h3>

          <span class="ml-auto text-xs text-slate-400">
            {{ historial.length }} registros
          </span>
        </div>

        <!-- Lista -->
        <div v-if="historial.length" class="divide-y divide-slate-50 max-h-80 overflow-y-auto">
          <div v-for="p in historial" :key="p.id_prestamo"
            class="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition">

            <!-- Icon -->
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              📘
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium text-slate-700 text-sm truncate">
                {{ p.ejemplar?.libro?.titulo ?? 'Libro desconocido' }}
              </p>
              <p class="text-xs text-slate-400 mt-0.5">
                Devuelto: {{ formatDate(p.fechaDevolucionReal) }}
              </p>
            </div>

            <!-- Badge -->
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              DEVUELTO
            </span>

          </div>
        </div>

        <!-- Empty -->
        <div v-else class="py-10 text-center">
          <p class="text-sm text-slate-400">Aún no tienes historial</p>
        </div>

      </div>

    </div>
  </div>
</template>
