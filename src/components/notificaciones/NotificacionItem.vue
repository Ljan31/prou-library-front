<script setup lang="ts">
import { computed } from 'vue'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Notificacion } from '@/types/notificacion.types'

const props = defineProps<{ notificacion: Notificacion; compact?: boolean }>()
defineEmits<{ (e: 'click', n: Notificacion): void }>()

const icono = computed(() => ({
  RECORDATORIO_DEVOLUCION: { path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', color: 'text-amber-500', bg: 'bg-amber-50' },
  VENCIMIENTO: { path: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', color: 'text-red-500', bg: 'bg-red-50' },
  RESERVA_DISPONIBLE: { path: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  SANCION: { path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', color: 'text-red-600', bg: 'bg-red-50' },
})[props.notificacion.tipoNotificacion] ?? { path: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0', color: 'text-indigo-600', bg: 'bg-indigo-50' }
)

const fechaRelativa = computed(() => {
  if (!props.notificacion.fechaEnvio) return ''
  try {
    return formatDistanceToNow(parseISO(props.notificacion.fechaEnvio), { addSuffix: true, locale: es })
  } catch {
    return ''
  }
})
</script>

<template>
  <div class="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group" :class="[
    notificacion.leida
      ? 'hover:bg-slate-50'
      : 'bg-indigo-50/50 hover:bg-indigo-50',
  ]" @click="$emit('click', notificacion)">
    <!-- Ícono tipo -->
    <div class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" :class="icono.bg">
      <svg class="w-4 h-4" :class="icono.color" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path :d="icono.path" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <!-- Contenido -->
    <div class="flex-1 min-w-0">
      <p class="text-sm leading-snug truncate"
        :class="notificacion.leida ? 'text-slate-600 font-normal' : 'text-slate-800 font-medium'">
        {{ notificacion.asunto }}
      </p>
      <p v-if="!compact" class="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
        {{ notificacion.mensaje }}
      </p>
      <p class="text-[11px] text-slate-400 mt-1">{{ fechaRelativa }}</p>
    </div>

    <!-- Punto "no leído" -->
    <div class="shrink-0 mt-1.5">
      <span v-if="!notificacion.leida" class="block w-2 h-2 rounded-full bg-indigo-500" />
    </div>
  </div>
</template>