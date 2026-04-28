<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useSancionStore } from '@/stores/sancion.store'
import { useAuthStore } from '@/stores/auth.store'
import SModal from '@/components/ui/SModal.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import SButton from '@/components/ui/SButton.vue'

const emit = defineEmits<{ (e: 'registrado'): void }>()
const modelValue = defineModel<boolean>()

const store = useSancionStore()
const auth = useAuthStore()
const enviando = ref(false)

const form = reactive({
  usuarioId: '',
  prestamoId: '',
  motivo: '' as 'DANIO_EJEMPLAR' | 'PERDIDA_EJEMPLAR' | 'REINCIDENCIA' | '',
  montoFijo: '',
  observaciones: '',
})

const errores = reactive({ usuarioId: '', motivo: '' })

const MOTIVOS = [
  { value: 'DANIO_EJEMPLAR', label: 'Daño al ejemplar' },
  { value: 'PERDIDA_EJEMPLAR', label: 'Pérdida del ejemplar' },
  { value: 'REINCIDENCIA', label: 'Reincidencia' },
]

function validar() {
  errores.usuarioId = form.usuarioId ? '' : 'El ID de usuario es requerido'
  errores.motivo = form.motivo ? '' : 'El motivo es requerido'
  return !errores.usuarioId && !errores.motivo
}

async function registrar() {
  if (!validar()) return
  enviando.value = true
  try {
    await store.registrarManual({
      usuarioId: Number(form.usuarioId),
      bibliotecaId: auth.user?.biblioteca?.[0]?.id_biblioteca ?? 0,
      prestamoId: form.prestamoId ? Number(form.prestamoId) : null,
      motivo: form.motivo as 'DANIO_EJEMPLAR' | 'PERDIDA_EJEMPLAR' | 'REINCIDENCIA',
      montoFijo: form.montoFijo ? parseFloat(form.montoFijo) : null,
      observaciones: form.observaciones || undefined,
    })
    modelValue.value = false
    emit('registrado')
    Object.assign(form, { usuarioId: '', prestamoId: '', motivo: '', montoFijo: '', observaciones: '' })
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <SModal v-model="modelValue" title="Registrar sanción manual" size="md">
    <div class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SInput v-model="form.usuarioId" label="ID de usuario" type="number" placeholder="Ej: 42" :required="true"
          :error-message="errores.usuarioId" />
        <SInput v-model="form.prestamoId" label="ID de préstamo" type="number" placeholder="Opcional"
          help-text="Si aplica a un préstamo específico" />
      </div>

      <SSelect v-model="form.motivo" label="Motivo" :options="MOTIVOS" :required="true"
        :error-message="errores.motivo" />

      <SInput v-model="form.montoFijo" label="Monto (Bs)" type="number" placeholder="Ej: 50.00"
        help-text="Deja en blanco para aplicar monto 0" />

      <SInput v-model="form.observaciones" type="textarea" label="Observaciones"
        placeholder="Describe el estado del ejemplar u otras notas relevantes..." />
    </div>

    <template #footer>
      <SButton variant="secondary" @click="modelValue = false">Cancelar</SButton>
      <SButton variant="danger" :loading="enviando" @click="registrar">
        Registrar sanción
      </SButton>
    </template>
  </SModal>
</template>