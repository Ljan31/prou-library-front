<script setup lang="ts">
import DevIcon from './DevIcon.vue'
import {
  ESTADO_EJEMPLAR_CLASSES, ESTADO_EJEMPLAR_LABEL, ESTADOS_EJEMPLAR, type EstadoEjemplar,
} from '@/constants/devolucion.constants'

defineProps<{ disabled?: boolean; hayDeterioro?: boolean; perdido?: boolean }>()
const model = defineModel<EstadoEjemplar>({ required: true })
</script>

<template>
  <div>
    <label class="block text-sm font-semibold text-slate-700 mb-3">Estado físico del ejemplar</label>
    <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Estado físico del ejemplar">
      <button v-for="e in ESTADOS_EJEMPLAR" :key="e" type="button" role="radio" :aria-checked="model === e"
        :disabled="disabled"
        :class="['py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
          model === e ? ESTADO_EJEMPLAR_CLASSES[e] : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']"
        @click="model = e">
        {{ ESTADO_EJEMPLAR_LABEL[e] }}
      </button>
    </div>

    <p v-if="hayDeterioro" class="text-xs text-amber-600 mt-2 flex items-center gap-1">
      <DevIcon name="info" class="w-3.5 h-3.5" />
      Estado sugerido automáticamente · Puedes ajustarlo
    </p>

    <div v-if="perdido"
      class="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
      <DevIcon name="ban" class="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>
        El ejemplar será marcado como <strong>perdido</strong>. Se podrá aplicar sanción por pérdida tras confirmar
        la devolución.
      </span>
    </div>
  </div>
</template>
