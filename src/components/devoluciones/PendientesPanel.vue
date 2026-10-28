<script setup lang="ts">
import { useMedia } from '@/composables/useMedia'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import DevIcon from './DevIcon.vue'
import {
  diasVencido, esVencido, formatDate, getCiUsuario, getNombreUsuario, getTitulo,
} from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'

const props = defineProps<{
  items: Prestamo[]
  loading: boolean
  error: string | null
  selectedId?: number | null
}>()
defineEmits<{ select: [prestamo: Prestamo]; retry: [] }>()

const search = defineModel<string>('search', { default: '' })
const { getUrl } = useMedia()

function rowClass(p: Prestamo) {
  if (esVencido(p)) return 'bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100'
  return props.selectedId === p.id_prestamo ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
}
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 space-y-3">
      <p class="font-semibold text-slate-800 text-sm">Préstamos pendientes</p>
      <div class="relative">
        <DevIcon name="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input v-model="search" type="text" placeholder="Filtrar..." aria-label="Filtrar préstamos pendientes"
          class="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
      </div>
    </div>

    <!-- Cargando -->
    <div v-if="loading" class="p-4 space-y-2">
      <div v-for="i in 3" :key="i" class="h-16 bg-slate-100 rounded-xl animate-pulse" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-5 text-center space-y-2" role="alert">
      <p class="text-sm text-red-600">{{ error }}</p>
      <button type="button" class="text-xs font-semibold text-indigo-600 hover:underline" @click="$emit('retry')">
        Reintentar
      </button>
    </div>

    <!-- Vacío -->
    <SEmptyState v-else-if="!items.length" title="¡Sin pendientes!" description="Todos los préstamos están al día"
      icon="inbox" />

    <!-- Lista -->
    <div v-else class="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
      <button v-for="p in items" :key="p.id_prestamo" type="button"
        :class="['w-full px-5 py-3.5 text-left transition-all hover:bg-slate-50', rowClass(p)]"
        @click="$emit('select', p)">
        <div class="flex items-start gap-3">
          <img v-if="p.ejemplar?.edicion?.imagenPortada" :src="getUrl(p.ejemplar.edicion.imagenPortada)" alt="portada"
            class="w-12 h-16 object-cover rounded-md border border-slate-200 shadow-sm flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs font-bold text-slate-400">#{{ p.id_prestamo }}</span>
              <span v-if="esVencido(p)" class="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                VENCIDO {{ diasVencido(p.fechaDevolucionEstimada) }}d
              </span>
              <span v-else class="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                {{ p.estadoPrestamo }}
              </span>
            </div>
            <p class="text-sm font-semibold text-slate-800 truncate leading-tight">
              {{ getTitulo(p, 'Sin título') }}
            </p>
            <p class="text-xs text-slate-600 truncate">
              {{ getNombreUsuario(p) }}
              <span class="text-slate-400">CI: {{ getCiUsuario(p) }}</span>
            </p>
            <p class="text-xs text-slate-400">Vence: {{ formatDate(p.fechaDevolucionEstimada) }}</p>
          </div>
          <div v-if="selectedId === p.id_prestamo"
            class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <DevIcon name="check" :stroke-width="3" class="w-3 h-3 text-white" />
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
