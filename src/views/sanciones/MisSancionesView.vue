<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useSancionStore } from '@/stores/sancion.store'
import SCard from '@/components/ui/SCard.vue'
import SSpinner from '@/components/feedback/SSpinner.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SancionBadge from '@/components/sanciones/SancionBadge.vue'

const ui = useUiStore()
const auth = useAuthStore()
const store = useSancionStore()

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Mis Sanciones' }])
  if (auth.user?.id) {
    store.cargarEstadoUsuario(auth.user.id)
    store.cargarHistorialUsuario(auth.user.id)
  }
})

function formatFecha(f: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const resumen = computed(() => store.estadoUsuario)
</script>

<template>
  <div class="page-container space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl font-semibold text-slate-900">Mis Sanciones</h1>
      <p class="text-sm text-slate-500 mt-0.5">Historial de multas y suspensiones de tu cuenta</p>
    </div>

    <!-- Banner estado -->
    <div v-if="store.cargandoEstado" class="space-y-2">
      <SSkeleton width="100%" height="4rem" />
    </div>

    <template v-else-if="resumen">
      <!-- Suspensión activa -->
      <div v-if="resumen.tieneSuspensionVigente"
        class="flex items-start gap-4 bg-red-50 border border-red-200 rounded-xl p-4" role="alert">
        <div class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-red-800">Cuenta suspendida</p>
          <p class="text-sm text-red-600 mt-0.5">
            Tu cuenta está suspendida hasta el
            <strong>{{ formatFecha(resumen.fechaFinSuspensionMasProxima) }}</strong>.
            No puedes realizar préstamos ni reservas durante este período.
          </p>
          <p class="text-xs text-red-500 mt-1.5">
            Acércate a la biblioteca para regularizar tu situación.
          </p>
        </div>
      </div>

      <!-- Deuda pendiente -->
      <div v-else-if="resumen.tieneDeudaPendiente"
        class="flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4" role="alert">
        <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p class="font-semibold text-amber-800">Multas pendientes de pago</p>
          <p class="text-sm text-amber-700 mt-0.5">
            Tienes {{ resumen.totalSancionesActivas }} sanción(es) activa(s).
            Acércate a la biblioteca para regularizar tu situación.
          </p>
        </div>
      </div>

      <!-- Sin problemas -->
      <div v-else class="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <svg class="w-5 h-5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <p class="text-sm text-emerald-700 font-medium">Tu cuenta está al día. ¡Sin sanciones activas!</p>
      </div>
    </template>

    <!-- Historial -->
    <SCard padding="none">
      <div class="px-4 py-3 border-b border-slate-100">
        <h2 class="text-sm font-semibold text-slate-800">Historial de sanciones</h2>
      </div>

      <div v-if="store.cargando" class="flex justify-center py-10">
        <SSpinner />
      </div>

      <div v-else-if="store.historial.length === 0" class="py-10">
        <SEmptyState title="Sin historial" description="No tienes sanciones registradas." icon="inbox" />
      </div>

      <div v-else class="divide-y divide-slate-50">
        <div v-for="s in store.historial" :key="s.idSancion"
          class="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <!-- Info principal -->
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <SancionBadge tipo="tipoSancion" :valor="s.tipoSancion" />
              <SancionBadge tipo="motivo" :valor="s.motivo" />
              <SancionBadge tipo="estado" :valor="s.estado" />
              <span v-if="s.suspensionVigente"
                class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">Vigente</span>
            </div>
            <p class="text-xs text-slate-500">
              Generada el {{ formatFecha(s.fechaGeneracion) }}
              <span v-if="s.diasRetraso"> · {{ s.diasRetraso }} días de retraso</span>
            </p>
            <p v-if="s.observaciones" class="text-xs text-slate-400 mt-0.5 italic">{{ s.observaciones }}</p>
          </div>

          <!-- Montos y fechas -->
          <div class="shrink-0 text-right space-y-1">
            <p class="text-base font-bold" :class="s.estado === 'ACTIVA' ? 'text-red-600' : 'text-slate-500'">
              Bs {{ s.montoMulta?.toFixed(2) ?? '0.00' }}
            </p>
            <p v-if="s.fechaFinSuspension" class="text-xs text-slate-500">
              Suspensión hasta {{ formatFecha(s.fechaFinSuspension) }}
            </p>
            <p v-if="s.fechaPago" class="text-xs text-emerald-600">
              Pagado el {{ formatFecha(s.fechaPago) }}
            </p>
          </div>
        </div>
      </div>
    </SCard>
  </div>
</template>