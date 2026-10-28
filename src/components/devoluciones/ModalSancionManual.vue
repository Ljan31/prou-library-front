<script setup lang="ts">
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import { CONDICION_TEXT, type Condicion } from '@/constants/devolucion.constants'
import { getCodigoEjemplar, getNombreUsuario } from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'

defineProps<{ prestamo: Prestamo | null; condicionDevolucion: Condicion; loading: boolean }>()
defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>({ required: true })
const monto = defineModel<string | number>('monto', { default: '' })
const observaciones = defineModel<string>('observaciones', { default: '' })
</script>

<template>
  <SModal v-model="open" title="Sanción por daño" size="md">
    <div class="space-y-4">
      <div v-if="prestamo" class="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-500">Préstamo</span>
          <span class="font-medium">#{{ prestamo.id_prestamo }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Ejemplar</span>
          <span class="font-medium">{{ getCodigoEjemplar(prestamo) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Usuario</span>
          <span class="font-medium capitalize">{{ getNombreUsuario(prestamo) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Condición</span>
          <span class="font-medium">
            <span :class="CONDICION_TEXT[(prestamo.condicionEntrega as Condicion) ?? 'BUENO']">
              {{ prestamo.condicionEntrega }}
            </span>
            → <span :class="CONDICION_TEXT[condicionDevolucion]">{{ condicionDevolucion }}</span>
          </span>
        </div>
      </div>

      <SInput v-model="monto" label="Monto de multa (Bs)" type="number" placeholder="Ej: 50.00"
        help-text="Dejar en blanco para aplicar monto según configuración" />

      <SInput v-model="observaciones" type="textarea" label="Observaciones"
        placeholder="Describe el daño observado u otras notas relevantes..." />
    </div>

    <template #footer>
      <SButton variant="secondary" @click="open = false">Cancelar</SButton>
      <SButton variant="danger" :loading="loading" @click="$emit('confirm')">Aplicar sanción</SButton>
    </template>
  </SModal>
</template>
