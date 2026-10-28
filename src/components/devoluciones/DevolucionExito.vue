<script setup lang="ts">
import DevIcon from './DevIcon.vue'
import { CONDICION_TEXT, type Condicion, type MotivoSancion } from '@/constants/devolucion.constants'
import { formatDate } from '@/utils/devolucion.utils'
import type { DevolucionResultado, Prestamo } from '@/types/devolucion.types'

defineProps<{
  prestamo: Prestamo
  resultado: DevolucionResultado | null
  hayDeterioro: boolean
  perdido: boolean
}>()
defineEmits<{ sancion: [motivo: MotivoSancion]; nueva: [] }>()
</script>

<template>
  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="p-8 text-center space-y-4">
      <div class="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <DevIcon name="check" :stroke-width="2.5" class="w-10 h-10 text-emerald-600" />
      </div>
      <div>
        <p class="text-lg font-bold text-slate-800">¡Devolución registrada!</p>
        <p class="text-sm text-slate-500 mt-1">El ejemplar ha sido devuelto correctamente</p>
      </div>

      <div v-if="resultado" class="bg-slate-50 rounded-xl p-4 text-sm space-y-2 text-left">
        <div class="flex justify-between">
          <span class="text-slate-500">Préstamo #</span>
          <span class="font-medium">{{ prestamo.id_prestamo }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Condición devuelta</span>
          <span :class="['font-semibold', CONDICION_TEXT[resultado.condicionDevolucion as Condicion] ?? 'text-slate-700']">
            {{ resultado.condicionDevolucion }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Fecha real</span>
          <span class="font-medium">{{ formatDate(resultado.fechaDevolucionReal) }}</span>
        </div>
      </div>

      <!-- Deterioro / pérdida: ofrecer sanción post-devolución -->
      <div v-if="hayDeterioro || perdido" class="space-y-3">
        <div class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 text-left">
          <DevIcon name="warning" class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {{ perdido ? 'El ejemplar fue reportado como perdido.' : 'El sistema detectó deterioro en la devolución.' }}
            ¿Deseas aplicar una sanción al usuario?
          </span>
        </div>
        <div class="flex gap-2">
          <button v-if="!perdido" type="button"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center justify-center gap-1.5"
            @click="$emit('sancion', 'DANIO_EJEMPLAR')">
            <DevIcon name="warning" class="w-4 h-4" />
            Aplicar sanción por daño
          </button>
          <button v-else type="button"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-1.5"
            @click="$emit('sancion', 'PERDIDA_EJEMPLAR')">
            <DevIcon name="ban" class="w-4 h-4" />
            Registrar pérdida y reposición
          </button>
          <button type="button"
            class="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            @click="$emit('nueva')">
            Omitir
          </button>
        </div>
      </div>

      <button v-else type="button"
        class="w-full py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        @click="$emit('nueva')">
        Registrar otra devolución
      </button>
    </div>
  </div>
</template>
