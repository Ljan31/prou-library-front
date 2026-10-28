<script setup lang="ts">
import DevIcon from './DevIcon.vue'
import { formatMonto, montoSancion, estaPagada } from '@/utils/sancion.utils'
import type { EstadoSancionUsuario, SancionResponse } from '@/types/notificacion.types'

defineProps<{
  loading: boolean
  estado: EstadoSancionUsuario | null
  /** Multa/suspensión activa asociada al préstamo (no incluye reposición) */
  multa: SancionResponse | null
  /** Hay una reposición activa: se muestra en <ReposicionPanel>, no aquí */
  hayReposicion: boolean
  omitirBloqueo: boolean
}>()
defineEmits<{ pagar: []; omitir: []; cancelarOmitir: [] }>()
</script>

<template>
  <!-- Verificando -->
  <div v-if="loading" class="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-500" role="status">
    <DevIcon name="spinner" class="w-4 h-4 text-indigo-500" />
    Verificando sanciones del usuario...
  </div>

  <!-- Multa / suspensión activa en este préstamo -->
  <div v-else-if="multa && estado" class="rounded-xl border-2 border-red-200 overflow-hidden">
    <div class="flex items-center gap-3 px-4 py-3 bg-red-50" role="alert">
      <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
        <DevIcon name="warning" class="w-4 h-4 text-red-600" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-red-700">Usuario con sanciones activas</p>
        <p class="text-xs text-red-600 mt-0.5">
          <span v-if="estado.tieneDeudaPendiente">
            Deuda pendiente: <strong>{{ formatMonto(montoSancion(multa)) }}</strong>
          </span>
          <span v-if="estado.tieneSuspensionVigente && estado.tieneDeudaPendiente"> · </span>
          <span v-if="estado.tieneSuspensionVigente">
            Suspensión hasta: <strong>{{ estado.fechaFinSuspensionMasProxima ?? '—' }}</strong>
          </span>
        </p>
      </div>
    </div>

    <div class="px-4 py-3 bg-white space-y-3">
      <p class="text-xs text-slate-500 font-medium">¿Cómo deseas proceder?</p>
      <div class="flex flex-col gap-2">
        <button v-if="estado.tieneDeudaPendiente && !estaPagada(multa)" type="button"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 transition-all text-left"
          @click="$emit('pagar')">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DevIcon name="cash" class="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-emerald-800">Registrar pago de deuda</p>
            <p class="text-xs text-emerald-600">Saldar la deuda antes de procesar la devolución</p>
          </div>
          <DevIcon name="chevron-right" class="w-4 h-4 text-emerald-500 ml-auto" />
        </button>

        <button type="button"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
          @click="$emit('omitir')">
          <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <DevIcon name="info" class="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-700">Proceder de todas formas</p>
            <p class="text-xs text-slate-500">Registrar la devolución ignorando la sanción pendiente</p>
          </div>
        </button>
      </div>
    </div>

    <div v-if="omitirBloqueo" class="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-t border-amber-200">
      <DevIcon name="info" class="w-4 h-4 text-amber-500 flex-shrink-0" />
      <p class="text-xs text-amber-700 font-medium">
        Continuando con sanción pendiente. Completa el formulario y confirma la devolución.
      </p>
      <button type="button" class="ml-auto text-amber-500 hover:text-amber-700 text-xs underline"
        @click="$emit('cancelarOmitir')">Cancelar</button>
    </div>
  </div>

  <!-- Sin sanciones -->
  <div v-else-if="estado && !hayReposicion"
    class="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
    <DevIcon name="check-circle" :stroke-width="2.5" class="w-4 h-4 flex-shrink-0" />
    Usuario sin sanciones activas — puede proceder con la devolución
  </div>
</template>
