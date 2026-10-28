<script setup lang="ts">
import { computed } from 'vue'
import DevIcon from './DevIcon.vue'

const props = defineProps<{
  disabled: boolean
  loading: boolean
  perdido: boolean
  deterioro: boolean
  reposicionPendiente: boolean
  sancionPendiente: boolean
}>()

const variante = computed(() => (props.perdido ? 'perdido' : props.deterioro ? 'deterioro' : 'normal'))

const clases = computed(() => {
  if (props.disabled) return 'bg-slate-100 text-slate-400 cursor-not-allowed'
  return {
    perdido: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200 active:scale-[0.98]',
    deterioro: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 active:scale-[0.98]',
    normal: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 active:scale-[0.98]',
  }[variante.value]
})

const icono = computed(() =>
  props.loading ? 'spinner' : ({ perdido: 'ban', deterioro: 'warning', normal: 'check-circle' } as const)[variante.value],
)

const etiqueta = computed(() => {
  if (props.loading) return 'Registrando...'
  if (props.reposicionPendiente) return 'Reposición pendiente — devolución bloqueada'
  if (props.disabled && props.sancionPendiente) return 'Resuelve la sanción para continuar'
  if (props.perdido) return 'Confirmar devolución — ejemplar perdido'
  if (props.deterioro) return 'Confirmar devolución con deterioro'
  return 'Confirmar devolución'
})
</script>

<template>
  <!-- El @click del padre cae en este <button> (único root) -->
  <button type="button" :disabled="disabled"
    :class="['w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2', clases]">
    <DevIcon :name="icono" class="w-4 h-4" />
    {{ etiqueta }}
  </button>
</template>
