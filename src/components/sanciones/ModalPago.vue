<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSancionStore } from '@/stores/sancion.store'
import SModal from '@/components/ui/SModal.vue'
import SInput from '@/components/ui/SInput.vue'
import SButton from '@/components/ui/SButton.vue'
import type { SancionResponse } from '@/types/notificacion.types'
export interface SancionPago {
  idSancion: number
  nombreUsuario: string
  ciUsuario: string
  montoMulta: number | null
  tipoSancion?: string
  estado?: string
  fechaFinSuspension?: string | null
  observaciones?: string | null
}
const props = defineProps<{ sancion: SancionResponse | null }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'pagado'): void
}>()
const modelValue = defineModel<boolean>()

const store = useSancionStore()
const metodoPago = ref('')
const observaciones = ref('')
const enviando = ref(false)

// const METODOS = ['Efectivo', 'Transferencia bancaria', 'QR', 'Depósito bancario', 'Otro']
const METODOS = ['Efectivo', 'QR', 'Otro']

async function registrar() {
  if (!metodoPago.value || !props.sancion) return
  enviando.value = true
  try {
    await store.registrarPago(props.sancion.idSancion, {
      metodoPago: metodoPago.value,
      observaciones: observaciones.value || undefined,
    })
    modelValue.value = false
    emit('pagado')
    metodoPago.value = ''
    observaciones.value = ''
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <SModal v-model="modelValue" title="Registrar pago de multa" size="sm">
    <div v-if="sancion" class="space-y-4">
      <!-- Info sanción -->
      <div class="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
        <p class="text-sm font-medium text-amber-900">{{ sancion.nombreUsuario }}</p>
        <p class="text-xs text-amber-700">CI: {{ sancion.ciUsuario }}</p>
        <p class="text-lg font-bold text-amber-800 mt-1">
          Bs {{ sancion.montoMulta?.toFixed(2) ?? '0.00' }}
        </p>
      </div>

      <!-- Método de pago -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1.5">
          Método de pago <span class="text-red-500">*</span>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="m in METODOS" :key="m" class="px-3 py-2 rounded-lg border text-sm font-medium transition-all"
            :class="metodoPago === m
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 text-slate-600 hover:border-slate-300'" @click="metodoPago = m">
            {{ m }}
          </button>
        </div>
      </div>

      <SInput v-model="observaciones" type="textarea" label="Observaciones"
        placeholder="Opcional – notas adicionales" />
    </div>

    <template #footer>
      <SButton variant="secondary" @click="modelValue = false">Cancelar</SButton>
      <SButton :loading="enviando" :disabled="!metodoPago" @click="registrar">
        Confirmar pago
      </SButton>
    </template>
  </SModal>
</template>