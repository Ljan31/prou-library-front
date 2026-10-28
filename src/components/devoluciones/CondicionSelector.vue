<script setup lang="ts">
import { computed } from 'vue'
import DevIcon from './DevIcon.vue'
import { CONDICION_CLASSES, CONDICIONES, type Condicion } from '@/constants/devolucion.constants'

const props = defineProps<{ entrega?: string; disabled?: boolean; hayDeterioro?: boolean }>()
const model = defineModel<Condicion>({ required: true })

const entregaClass = computed(
  () => CONDICION_CLASSES[props.entrega as Condicion] ?? 'border-slate-200 bg-slate-50 text-slate-500',
)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <label class="text-sm font-semibold text-slate-700">Condición del ejemplar</label>
      <span v-if="hayDeterioro"
        class="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
        <DevIcon name="exclamation" class="w-3 h-3" />
        Deterioro detectado
      </span>
    </div>

    <!-- Comparación entrega → devolución -->
    <div class="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
      <div class="flex-1 text-center">
        <p class="text-xs text-slate-400 mb-1">Al entregar</p>
        <span :class="['inline-block px-3 py-1.5 rounded-lg text-xs font-bold border-2', entregaClass]">
          {{ entrega ?? 'N/D' }}
        </span>
      </div>
      <DevIcon name="arrow-right" class="w-5 h-5 text-slate-300 flex-shrink-0" />
      <div class="flex-1 text-center">
        <p class="text-xs text-slate-400 mb-1">Al devolver</p>
        <span :class="['inline-block px-3 py-1.5 rounded-lg text-xs font-bold border-2', CONDICION_CLASSES[model]]">
          {{ model }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Condición al devolver">
      <button v-for="c in CONDICIONES" :key="c" type="button" role="radio" :aria-checked="model === c"
        :disabled="disabled"
        :class="['py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
          model === c ? CONDICION_CLASSES[c] : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']"
        @click="model = c">
        {{ c }}
      </button>
    </div>
  </div>
</template>
