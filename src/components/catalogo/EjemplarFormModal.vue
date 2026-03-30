<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import api from '@/services/axios'
import type { Ejemplar } from '@/types/catalogo'

const props = defineProps<{
  ejemplar: Ejemplar | null
  libroId?: number
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const guardando = ref(false)
const errors = reactive<Record<string, string>>({})

const opcionesEstado = [
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'EN_REPARACION', label: '🟡 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
]

const form = reactive({
  libroId: props.libroId ?? null as number | null,
  bibliotecaId: null as number | null,
  codigo_ejemplar: '',
  codigo_topografico: '',
  ubicacion_fisica: '',
  estadoEjemplar: 'DISPONIBLE',
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precio_compra: null as number | null,
  observaciones: '',
  pdf: '',
  pdfPreview: '',
})

watch(() => props.ejemplar, (e) => {
  if (e) {
    Object.assign(form, {
      libroId: e.libroId ?? props.libroId ?? null,
      bibliotecaId: e.bibliotecaId ?? null,
      codigo_ejemplar: e.codigo_ejemplar ?? '',
      codigo_topografico: e.codigo_topografico ?? '',
      ubicacion_fisica: e.ubicacion_fisica ?? '',
      estadoEjemplar: e.estadoEjemplar ?? 'DISPONIBLE',
      fechaAdquisicion: e.fechaAdquisicion ?? new Date().toISOString().split('T')[0],
      precio_compra: e.precio_compra ?? null,
      observaciones: e.observaciones ?? '',
      pdf: e.pdf ?? '',
      pdfPreview: e.pdfPreview ?? '',
    })
  }
}, { immediate: true })

function validar(): boolean {
  const e = errors
  Object.keys(e).forEach(k => delete e[k])
  if (!form.codigo_ejemplar.trim()) e.codigo_ejemplar = 'El código del ejemplar es requerido'
  if (!form.ubicacion_fisica.trim()) e.ubicacion_fisica = 'La ubicación es requerida'
  if (!form.libroId) e.libroId = 'Se requiere asociar un libro'
  return Object.keys(e).length === 0
}

async function guardar() {
  console.log(123)
  if (!validar()) return
  guardando.value = true
  try {
    if (props.ejemplar) {
      await api.put(`/ejemplares/${props.ejemplar.id_ejemplar}`, form)
    } else {
      await api.post('/ejemplares', form)
    }
    emit('saved')
  } catch (err: unknown) {
    errors.general = err instanceof Error ? err.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <SModal :model-value="true" :title="ejemplar ? 'Editar ejemplar' : 'Nuevo ejemplar'" size="md"
    @update:model-value="emit('close')">
    <form @submit.prevent="guardar" class="space-y-4">
      <!-- Código ejemplar + topográfico -->
      <div class="grid grid-cols-2 gap-3">
        <SInput v-model="form.codigo_ejemplar" label="Código ejemplar *" placeholder="JAVA-011"
          :error-message="errors.codigo_ejemplar" help-text="Debe ser único" />
        <SInput v-model="form.codigo_topografico" label="Código topográfico" placeholder="004-JAV-2020" />
      </div>

      <!-- Ubicación física -->
      <SInput v-model="form.ubicacion_fisica" label="Ubicación física *" placeholder="Estante A11"
        :error-message="errors.ubicacion_fisica" />

      <!-- Estado (solo al crear o estados no terminales) -->
      <SSelect v-model="form.estadoEjemplar" label="Estado" :options="opcionesEstado" />

      <!-- Fecha y precio -->
      <div class="grid grid-cols-2 gap-3">
        <SInput v-model="form.fechaAdquisicion" type="date" label="Fecha adquisición" />
        <SInput v-model.number="form.precio_compra" type="number" label="Precio de compra (Bs.)" placeholder="45.50" />
      </div>

      <!-- Links PDF -->
      <SInput v-model="form.pdf" label="URL del PDF completo" placeholder="https://..."
        help-text="Enlace al PDF para visualización" />
      <SInput v-model="form.pdfPreview" label="URL de preview PDF" placeholder="https://..."
        help-text="Imagen de previsualización para estudiantes" />

      <!-- Observaciones -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1.5">Observaciones</label>
        <textarea v-model="form.observaciones" rows="2" placeholder="Notas adicionales sobre el ejemplar..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
      </div>

      <p v-if="errors.general" class="text-sm text-red-500">{{ errors.general }}</p>
      <p v-if="errors.libroId" class="text-sm text-red-500">{{ errors.libroId }}</p>
    </form>

    <template #footer>
      <SButton variant="ghost" @click="emit('close')">Cancelar</SButton>
      <SButton variant="primary" :loading="guardando" @click="guardar">
        {{ ejemplar ? 'Guardar cambios' : 'Crear ejemplar' }}
      </SButton>
    </template>
  </SModal>
</template>