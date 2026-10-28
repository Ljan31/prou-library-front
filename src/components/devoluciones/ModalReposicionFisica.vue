<script setup lang="ts">
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import { formatMonto, montoSancion } from '@/utils/sancion.utils'
import type { SancionResponse } from '@/types/notificacion.types'

defineProps<{ sancion: SancionResponse | null; loading: boolean }>()
defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>({ required: true })
const observaciones = defineModel<string>('observaciones', { default: '' })
</script>

<template>
  <SModal v-model="open" title="Registrar reposición física" size="md">
    <div class="space-y-4">
      <div v-if="sancion" class="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-500">Usuario</span>
          <span class="font-medium capitalize">{{ sancion.nombreUsuario }}</span>
        </div>
        <div v-if="sancion.tituloEjemplar" class="flex justify-between gap-4">
          <span class="text-slate-500">Libro</span>
          <span class="font-medium text-right">{{ sancion.tituloEjemplar }}</span>
        </div>
        <div v-if="sancion.codigoTopograficoConcat" class="flex justify-between">
          <span class="text-slate-500">Código</span>
          <span class="font-medium">{{ sancion.codigoTopograficoConcat }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Valor de reposición</span>
          <span class="font-medium">{{ formatMonto(montoSancion(sancion)) }}</span>
        </div>
      </div>

      <p class="text-xs text-slate-500">
        Al confirmar, la reposición queda resuelta con un ejemplar de reemplazo y el inventario se actualiza.
      </p>

      <SInput v-model="observaciones" type="textarea" label="Observaciones"
        placeholder="Ej: Se recibió una copia de la misma edición en buen estado" />
    </div>

    <template #footer>
      <SButton variant="secondary" @click="open = false">Cancelar</SButton>
      <SButton variant="success" :loading="loading" @click="$emit('confirm')">Confirmar reposición</SButton>
    </template>
  </SModal>
</template>
