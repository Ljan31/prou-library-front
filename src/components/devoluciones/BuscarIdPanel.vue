<script setup lang="ts">
import DevIcon from './DevIcon.vue'
import { formatDate, getNombreUsuario, getTitulo } from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'

defineProps<{ loading: boolean; error: string | null; prestamo: Prestamo | null }>()
defineEmits<{ buscar: [] }>()

const id = defineModel<string | number>({ default: '' })
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
    <p class="font-semibold text-slate-800 text-sm">Buscar préstamo por ID</p>

    <div class="flex gap-2">
      <div class="relative flex-1">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">#</span>
        <input v-model="id" type="number" placeholder="Ej: 7" aria-label="ID del préstamo"
          class="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
          @keydown.enter="$emit('buscar')" />
      </div>
      <button type="button" :disabled="!id || loading"
        :class="['px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5',
          id && !loading ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed']"
        @click="$emit('buscar')">
        <DevIcon :name="loading ? 'spinner' : 'search'" class="w-4 h-4" />
        Buscar
      </button>
    </div>

    <div v-if="error" role="alert"
      class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
      <DevIcon name="exclamation" class="w-4 h-4 flex-shrink-0" />
      {{ error }}
    </div>

    <div v-if="prestamo" class="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-1">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-indigo-400">#{{ prestamo.id_prestamo }}</span>
        <span v-if="prestamo.vencido" class="text-xs font-bold text-red-600">VENCIDO</span>
        <span v-else class="text-xs text-emerald-600 font-medium">{{ prestamo.estadoPrestamo }}</span>
      </div>
      <p class="text-sm font-semibold text-slate-800">{{ getTitulo(prestamo) }}</p>
      <p class="text-xs text-slate-500 capitalize">{{ getNombreUsuario(prestamo) }}</p>
      <p class="text-xs text-slate-400">Vence: {{ formatDate(prestamo.fechaDevolucionEstimada) }}</p>
    </div>
  </div>
</template>
