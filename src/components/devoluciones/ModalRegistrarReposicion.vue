<script setup lang="ts">
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import DevIcon from './DevIcon.vue'
import { getCodigoEjemplar, getNombreUsuario, getTitulo } from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'

defineProps<{ prestamo: Prestamo | null; loading: boolean }>()
defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>({ required: true })
const monto = defineModel<string | number>('monto', { default: '' })
const observaciones = defineModel<string>('observaciones', { default: '' })
</script>

<template>
  <SModal v-model="open" title="Registrar pérdida del ejemplars" size="md">
    <div class="space-y-4">
      <div v-if="prestamo" class="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
        <div class="flex justify-between gap-4">
          <span class="text-slate-500">Libro</span>
          <span class="font-medium text-right">{{ getTitulo(prestamo, 'Sin título') }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Ejemplar</span>
          <span class="font-medium">{{ getCodigoEjemplar(prestamo) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Usuario</span>
          <span class="font-medium capitalize">{{ getNombreUsuario(prestamo) }}</span>
        </div>
      </div>

      <div class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <DevIcon name="info" class="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Al confirmar, el ejemplar se marca como <strong>perdido</strong>, se genera una sanción de
          reposición y se notifica al usuario. Luego podrás resolverla con pago o con un ejemplar físico.
        </span>
      </div>

      <SInput v-model="monto" label="Valor de reposición (Bs)" type="number" placeholder="Ej: 120.00"
        help-text="Monto que el usuario debe pagar si repone el ejemplar con dinero" :required="true" />

      <SInput v-model="observaciones" type="textarea" label="Observaciones"
        placeholder="Circunstancias de la pérdida..." />
    </div>

    <template #footer>
      <SButton variant="secondary" @click="open = false">Cancelar</SButton>
      <SButton variant="danger" :loading="loading" @click="$emit('confirm')">Registrar pérdida</SButton>
    </template>
  </SModal>
</template>
