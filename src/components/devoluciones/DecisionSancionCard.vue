<script setup lang="ts">
import { computed } from 'vue'
import DevIcon from './DevIcon.vue'

const props = defineProps<{
  decisionTomada: boolean
  tipo: 'APLICADA' | 'OMITIDA' | null
  perdido: boolean
  /** Hay una reposición PENDIENTE que bloquea la devolución */
  reposicionPendiente: boolean
}>()
defineEmits<{ aplicar: []; omitir: []; cambiar: [] }>()

const mensaje = computed(() => {
  if (props.tipo === 'OMITIDA') return 'Se decidió continuar sin sanción. Puedes confirmar la devolución.'
  if (props.perdido && props.reposicionPendiente) {
    return 'Pérdida registrada. Al regularizar la reposición (pago o ejemplar físico), el ejemplar se devolverá de inmediato.'
  }
  return 'Sanción registrada. Puedes confirmar la devolución cuando no queden bloqueos.'
})
</script>

<template>
  <!-- Decisión tomada: solo el resultado, sin volver a ofrecer la acción -->
  <div v-if="decisionTomada" class="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200"
    role="status">
    <DevIcon name="check" :stroke-width="2.5" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
    <p class="text-xs font-medium text-emerald-800 flex-1">{{ mensaje }}</p>
    <!-- Solo se puede cambiar si se omitió; una sanción registrada no se deshace aquí -->
    <button v-if="tipo === 'OMITIDA'" type="button"
      class="text-xs text-emerald-700 underline hover:text-emerald-900 shrink-0" @click="$emit('cambiar')">
      Cambiar
    </button>
  </div>

  <div v-else class="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
    <div class="flex items-start gap-3">
      <div class="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
        <DevIcon name="warning" class="w-5 h-5 text-amber-700" />
      </div>
      <div>
        <p class="text-sm font-semibold text-amber-900">Se requiere una decisión sobre la sanción</p>
        <p class="text-xs text-amber-800 mt-1">
          <template v-if="perdido">
            Al registrar la pérdida, el ejemplar se marca como perdido y se genera una reposición. Cuando el
            usuario la resuelva (pago o ejemplar físico), el ejemplar se devuelve de inmediato.
          </template>
          <template v-else>
            Puedes registrar una sanción por el estado del ejemplar o continuar sin aplicarla.
          </template>
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button type="button"
        class="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
        @click="$emit('aplicar')">
        {{ perdido ? 'Registrar pérdida y reposición' : 'Aplicar sanción' }}
      </button>
      <button type="button"
        class="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors"
        @click="$emit('omitir')">
        Continuar sin sanción
      </button>
    </div>
  </div>
</template>