<script setup lang="ts">
import type { EstadoSancion, TipoSancion, MotivoSancion } from '@/types/notificacion.types'

const props = defineProps<{
  tipo?: 'estado' | 'tipoSancion' | 'motivo'
  valor: EstadoSancion | TipoSancion | MotivoSancion | string
}>()

const estadoClases: Record<string, string> = {
  ACTIVA: 'bg-red-100 text-red-700',
  PAGADA: 'bg-emerald-100 text-emerald-700',
  CONDONADA: 'bg-slate-100 text-slate-600',
}

const tipoClases: Record<string, string> = {
  MULTA: 'bg-amber-100 text-amber-700',
  SUSPENSION: 'bg-red-100 text-red-700',
  MULTA_Y_SUSPENSION: 'bg-red-200 text-red-800',
}

const motivoClases: Record<string, string> = {
  RETRASO_DEVOLUCION: 'bg-amber-100 text-amber-700',
  DANIO_EJEMPLAR: 'bg-orange-100 text-orange-700',
  PERDIDA_EJEMPLAR: 'bg-red-100 text-red-700',
  REINCIDENCIA: 'bg-purple-100 text-purple-700',
}

const labels: Record<string, string> = {
  ACTIVA: 'Activa',
  PAGADA: 'Pagada',
  CONDONADA: 'Condonada',
  MULTA: 'Multa',
  SUSPENSION: 'Suspensión',
  MULTA_Y_SUSPENSION: 'Multa + Suspensión',
  RETRASO_DEVOLUCION: 'Retraso',
  DANIO_EJEMPLAR: 'Daño',
  PERDIDA_EJEMPLAR: 'Pérdida',
  REINCIDENCIA: 'Reincidencia',
}

const claseActual = computed(() => {
  if (props.tipo === 'estado') return estadoClases[props.valor] ?? 'bg-slate-100 text-slate-600'
  if (props.tipo === 'tipoSancion') return tipoClases[props.valor] ?? 'bg-slate-100 text-slate-600'
  if (props.tipo === 'motivo') return motivoClases[props.valor] ?? 'bg-slate-100 text-slate-600'
  return estadoClases[props.valor] ?? tipoClases[props.valor] ?? 'bg-slate-100 text-slate-600'
})

import { computed } from 'vue'
</script>

<template>
  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" :class="claseActual">
    {{ labels[valor] ?? valor }}
  </span>
</template>