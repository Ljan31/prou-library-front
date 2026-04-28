<script setup lang="ts">
import { ref } from 'vue'
import { useSancionStore } from '@/stores/sancion.store'
import SModal from '@/components/ui/SModal.vue'
import SInput from '@/components/ui/SInput.vue'
import SButton from '@/components/ui/SButton.vue'
import type { SancionResponse } from '@/types/notificacion.types'

const props = defineProps<{ sancion: SancionResponse | null }>()
const emit = defineEmits<{ (e: 'condonado'): void }>()
const modelValue = defineModel<boolean>()

const store = useSancionStore()
const observaciones = ref('')
const enviando = ref(false)

async function condonar() {
  if (!observaciones.value.trim() || !props.sancion) return
  enviando.value = true
  try {
    await store.condonarSancion(props.sancion.idSancion, { observaciones: observaciones.value })
    modelValue.value = false
    emit('condonado')
    observaciones.value = ''
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <SModal v-model="modelValue" title="Condonar sanción" size="sm">
    <div v-if="sancion" class="space-y-4">
      <div class="bg-red-50 border border-red-100 rounded-lg p-3">
        <p class="text-xs text-red-600 font-medium mb-0.5">⚠ Esta acción es irreversible</p>
        <p class="text-sm text-red-800">
          Estás a punto de condonar la sanción de
          <span class="font-semibold">{{ sancion.nombreUsuario }}</span>
          por Bs {{ sancion.montoMulta?.toFixed(2) ?? '0.00' }}.
        </p>
      </div>

      <SInput v-model="observaciones" type="textarea" label="Motivo de condonación"
        placeholder="Describe el motivo por el que se condona esta sanción..." :required="true"
        :error-message="!observaciones.trim() && enviando ? 'El motivo es requerido' : ''" />
    </div>

    <template #footer>
      <SButton variant="secondary" @click="modelValue = false">Cancelar</SButton>
      <SButton variant="danger" :loading="enviando" :disabled="!observaciones.trim()" @click="condonar">
        Condonar sanción
      </SButton>
    </template>
  </SModal>
</template>