<script setup lang="ts">
import type { EstadoSancionUsuario } from '@/types/notificacion.types'

const props = defineProps<{
  estado: EstadoSancionUsuario | null
  loading?: boolean
}>()

function formatFecha(fecha: string | null) {
  if (!fecha) return ''
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="loading" class="h-12 bg-slate-100 animate-pulse rounded-lg" />

  <!-- Suspensión vigente -->
  <div v-else-if="estado?.tieneSuspensionVigente"
    class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3.5" role="alert">
    <div class="shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
      <svg class="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    </div>
    <div>
      <p class="text-sm font-semibold text-red-800">Usuario suspendido</p>
      <p class="text-xs text-red-600 mt-0.5">
        Tiene suspensión activa
        <span v-if="estado.fechaFinSuspensionMasProxima">
          hasta el <strong>{{ formatFecha(estado.fechaFinSuspensionMasProxima) }}</strong>
        </span>.
        No puede realizar préstamos ni reservas durante este período.
      </p>
    </div>
  </div>

  <!-- Deuda pendiente (no bloqueante) -->
  <div v-else-if="estado?.tieneDeudaPendiente"
    class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3.5" role="alert">
    <div class="shrink-0 w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
      <svg class="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
    <div>
      <p class="text-sm font-semibold text-amber-800">Multas pendientes</p>
      <p class="text-xs text-amber-700 mt-0.5">
        El usuario tiene {{ estado.totalSancionesActivas }} sanción(es) activa(s) con deuda pendiente.
        Puede continuar con el préstamo, pero debe regularizar su situación.
      </p>
    </div>
  </div>

  <!-- Sin bloqueos -->
  <div v-else-if="estado && !estado.tieneSuspensionVigente && !estado.tieneDeudaPendiente"
    class="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-3">
    <svg class="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
    <p class="text-sm text-emerald-700 font-medium">Usuario habilitado para realizar préstamos</p>
  </div>
</template>