<script setup lang="ts">
import { ref, watch } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import { useSancionStore } from '@/stores/sancion.store'
import { formatMonto, montoSancion } from '@/utils/sancion.utils'
import type { SancionResponse } from '@/types/notificacion.types'

const props = defineProps<{ sancion: SancionResponse | null }>()
const emit = defineEmits<{ registrado: [sancion: SancionResponse] }>()
const open = defineModel<boolean>({ required: true })

const store = useSancionStore()

const observaciones = ref('')
const recibido = ref(false)
const loading = ref(false)

watch(open, abierto => {
  if (!abierto) return
  observaciones.value = ''
  recibido.value = false
})

async function confirmar() {
  const s = props.sancion
  if (!s || !recibido.value || loading.value) return

  loading.value = true
  try {
    const data = await store.registrarReposicionFisica(s.idSancion, {
      observaciones: observaciones.value.trim() || undefined,
    })
    open.value = false
    if (data) emit('registrado', data)
  } catch {
    /* el store ya mostró el error del backend */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <SModal v-model="open" title="Registrar reposición física" size="md">
    <div v-if="sancion" class="space-y-5">
      <div class="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
        <div class="flex justify-between gap-4">
          <span class="text-slate-500">Usuario</span>
          <span class="font-medium text-slate-800 text-right">{{ sancion.nombreUsuario }}</span>
        </div>
        <div v-if="sancion.tituloEjemplar" class="flex justify-between gap-4">
          <span class="text-slate-500">Ejemplar perdido</span>
          <span class="font-medium text-slate-800 text-right">{{ sancion.tituloEjemplar }}</span>
        </div>
        <div v-if="sancion.codigoTopograficoConcat" class="flex justify-between gap-4">
          <span class="text-slate-500">Código</span>
          <span class="font-medium text-slate-800">{{ sancion.codigoTopograficoConcat }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-slate-500">Valor de referencia</span>
          <span class="font-medium text-slate-800">{{ formatMonto(montoSancion(sancion)) }}</span>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 space-y-1">
        <p class="font-semibold">Al confirmar:</p>
        <ul class="list-disc pl-4 space-y-0.5">
          <li>La reposición queda resuelta con un ejemplar de reemplazo.</li>
          <li>El inventario se actualiza con el nuevo ejemplar.</li>
          <li>Se desbloquea la devolución del préstamo.</li>
        </ul>
      </div>

      <SInput v-model="observaciones" type="textarea" label="Observaciones (opcional)"
        placeholder="Ej: Copia de la misma edición, en buen estado" />

      <label class="flex items-start gap-2.5 cursor-pointer select-none">
        <input v-model="recibido" type="checkbox"
          class="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
        <span class="text-sm text-slate-700">Confirmo que recibí físicamente el ejemplar de reemplazo.</span>
      </label>
    </div>

    <template #footer>
      <SButton variant="secondary" :disabled="loading" @click="open = false">Cancelar</SButton>
      <SButton variant="success" :loading="loading" :disabled="!recibido" @click="confirmar">
        Confirmar reposición
      </SButton>
    </template>
  </SModal>
</template>
