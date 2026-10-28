<script setup lang="ts">
import DevIcon from './DevIcon.vue'
import { formatMonto, montoSancion, puedePagar } from '@/utils/sancion.utils'
import type { SancionResponse } from '@/types/notificacion.types'

defineProps<{ sancion: SancionResponse }>()
defineEmits<{ pagar: []; fisica: [] }>()
</script>

<template>
  <div class="rounded-xl border-2 border-red-200 overflow-hidden">
    <div class="flex items-start gap-3 px-4 py-3 bg-red-50" role="alert">
      <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
        <DevIcon name="ban" class="w-4 h-4 text-red-600" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-red-700">Reposición del ejemplar pendiente</p>
        <p class="text-xs text-red-600 mt-0.5">
          Valor de reposición: <strong>{{ formatMonto(montoSancion(sancion)) }}</strong>
        </p>
        <p class="text-xs text-red-600 mt-1">
          La devolución se habilita cuando el usuario regularice la reposición. La condición y el estado
          físico permanecen bloqueados hasta entonces.
        </p>
      </div>
    </div>

    <div class="px-4 py-3 bg-white space-y-3">
      <p class="text-xs text-slate-500 font-medium">¿Cómo repone el usuario el ejemplar?</p>
      <div class="flex flex-col gap-2">
        <button v-if="puedePagar(sancion)" type="button"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 transition-all text-left"
          @click="$emit('pagar')">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <DevIcon name="cash" class="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-emerald-800">Registrar pago de reposición</p>
            <p class="text-xs text-emerald-600">El usuario paga el valor del ejemplar</p>
          </div>
          <DevIcon name="chevron-right" class="w-4 h-4 text-emerald-500 ml-auto" />
        </button>

        <button type="button"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 transition-all text-left"
          @click="$emit('fisica')">
          <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <DevIcon name="clipboard" class="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p class="text-sm font-semibold text-indigo-800">Registrar reposición física</p>
            <p class="text-xs text-indigo-600">El usuario entrega un ejemplar de reemplazo</p>
          </div>
          <DevIcon name="chevron-right" class="w-4 h-4 text-indigo-500 ml-auto" />
        </button>
      </div>
    </div>
  </div>
</template>
