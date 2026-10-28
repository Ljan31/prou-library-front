<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import { useSancionStore } from '@/stores/sancion.store'
import { esReposicion, formatFecha, formatMonto, montoSancion } from '@/utils/sancion.utils'
import type { SancionResponse } from '@/types/notificacion.types'

const props = defineProps<{ sancion: SancionResponse | null }>()
const emit = defineEmits<{ pagado: [sancion: SancionResponse] }>()
const open = defineModel<boolean>({ required: true })

const store = useSancionStore()

const METODOS = ['Efectivo', 'Transferencia bancaria', 'QR', 'Depósito bancario', 'Otro'] as const

const metodo = ref<string>('')
const otroMetodo = ref('')
const observaciones = ref('')
const loading = ref(false)
const intentado = ref(false)

const repos = computed(() => !!props.sancion && esReposicion(props.sancion))
const monto = computed(() => (props.sancion ? montoSancion(props.sancion) : 0))
const metodoFinal = computed(() => (metodo.value === 'Otro' ? otroMetodo.value.trim() : metodo.value))

const errorMetodo = computed(() => {
  if (!intentado.value) return undefined
  if (!metodo.value) return 'Selecciona un método de pago'
  if (metodo.value === 'Otro' && !otroMetodo.value.trim()) return 'Describe el método de pago'
  return undefined
})

watch(open, abierto => {
  if (!abierto) return
  metodo.value = ''
  otroMetodo.value = ''
  observaciones.value = ''
  intentado.value = false
})

async function confirmar() {
  intentado.value = true
  const s = props.sancion
  if (!s || !metodoFinal.value || loading.value) return

  loading.value = true
  try {
    const data = await store.registrarPago(s.idSancion, {
      metodoPago: metodoFinal.value,
      observaciones: observaciones.value.trim() || undefined,
    })
    open.value = false
    emit('pagado', data)
  } catch {
    /* el store ya mostró el error del backend */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <SModal v-model="open" :title="repos ? 'Pago de reposición' : 'Registrar pago de multa'" size="md">
    <div v-if="sancion" class="space-y-5">
      <!-- Resumen -->
      <div class="rounded-xl bg-slate-50 p-4 space-y-3">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-xs text-slate-500">Usuario</p>
            <p class="font-medium text-slate-800 truncate">{{ sancion.nombreUsuario }}</p>
            <p class="text-xs text-slate-400">CI: {{ sancion.ciUsuario }}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-xs text-slate-500">Monto a pagar</p>
            <p class="text-2xl font-bold text-slate-900">{{ formatMonto(monto) }}</p>
          </div>
        </div>
        <p v-if="repos && sancion.tituloEjemplar" class="text-xs text-slate-500 border-t border-slate-200 pt-2">
          Ejemplar: <span class="font-medium text-slate-700">{{ sancion.tituloEjemplar }}</span>
          <span v-if="sancion.codigoTopograficoConcat"> · {{ sancion.codigoTopograficoConcat }}</span>
        </p>
      </div>

      <!-- Método de pago -->
      <fieldset>
        <legend class="block text-sm font-semibold text-slate-700 mb-2">Método de pago</legend>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup">
          <button v-for="m in METODOS" :key="m" type="button" role="radio" :aria-checked="metodo === m"
            :class="['py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all',
              metodo === m
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300']"
            @click="metodo = m">
            {{ m }}
          </button>
        </div>
        <SInput v-if="metodo === 'Otro'" v-model="otroMetodo" class="mt-3" placeholder="Describe el método de pago"
          :error-message="errorMetodo" />
        <p v-else-if="errorMetodo" class="mt-2 text-xs text-red-600" role="alert">{{ errorMetodo }}</p>
      </fieldset>

      <SInput v-model="observaciones" type="textarea" label="Observaciones (opcional)"
        placeholder="Ej: Pagado en caja central, comprobante Nº ..." />

      <!-- El pago de multa no levanta la suspensión -->
      <p v-if="!repos && sancion.suspensionVigente"
        class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        El pago salda la multa, pero la <strong>suspensión sigue vigente</strong> hasta
        {{ formatFecha(sancion.fechaFinSuspension) }}. La sanción permanecerá activa hasta que venza.
      </p>
    </div>

    <template #footer>
      <SButton variant="secondary" :disabled="loading" @click="open = false">Cancelar</SButton>
      <SButton variant="success" :loading="loading" @click="confirmar">
        Confirmar pago · {{ formatMonto(monto) }}
      </SButton>
    </template>
  </SModal>
</template>
