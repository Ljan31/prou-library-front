<script setup lang="ts">
import { useMedia } from '@/composables/useMedia'
import DevIcon from './DevIcon.vue'
import {
  diasVencido, formatDate, getCodigoEjemplar, getNombreUsuario, getTitulo,
} from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'

defineProps<{ prestamo: Prestamo }>()
defineEmits<{ close: [] }>()
const { getUrl } = useMedia()
</script>

<template>
  <div :class="['px-6 py-4 border-b', prestamo.vencido ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100']">
    <div class="flex items-start gap-4">
      <img v-if="prestamo.ejemplar?.edicion?.imagenPortada" :src="getUrl(prestamo.ejemplar.edicion.imagenPortada)"
        alt="portada" class="w-12 h-16 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="text-xs font-bold text-slate-400">#{{ prestamo.id_prestamo }}</span>
          <span v-if="prestamo.vencido"
            class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
            ⚠️ VENCIDO hace {{ diasVencido(prestamo.fechaDevolucionEstimada) }} días
          </span>
          <span v-else class="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {{ prestamo.estadoPrestamo }}
          </span>
        </div>
        <p class="font-semibold text-slate-800 truncate">{{ getTitulo(prestamo) }}</p>
        <div class="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
          <span class="capitalize">{{ getNombreUsuario(prestamo) }}</span>
          <span>·</span>
          <span>{{ getCodigoEjemplar(prestamo) }}</span>
          <span>· Prestado: {{ formatDate(prestamo.fechaPrestamo) }}</span>
        </div>
      </div>
      <button type="button" aria-label="Cerrar selección"
        class="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0" @click="$emit('close')">
        <DevIcon name="x" class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>
