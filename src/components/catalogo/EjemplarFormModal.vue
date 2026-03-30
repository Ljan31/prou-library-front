<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import BaseModal from './BaseModal.vue'
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
const errorGeneral = ref('')

const errores = reactive<Record<string, string>>({})

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

const opcionesEstado = [
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'EN_REPARACION', label: '🟡 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
]

watch(() => props.ejemplar, (e) => {
  limpiarErrores()
  errorGeneral.value = ''
  if (e) {
    form.libroId = e.libroId ?? props.libroId ?? null
    form.bibliotecaId = e.bibliotecaId ?? null
    form.codigo_ejemplar = e.codigo_ejemplar ?? ''
    form.codigo_topografico = e.codigo_topografico ?? ''
    form.ubicacion_fisica = e.ubicacion_fisica ?? ''
    form.estadoEjemplar = e.estadoEjemplar ?? 'DISPONIBLE'
    form.fechaAdquisicion = e.fechaAdquisicion ?? new Date().toISOString().split('T')[0]
    form.precio_compra = e.precio_compra ?? null
    form.observaciones = e.observaciones ?? ''
    form.pdf = e.pdf ?? ''
    form.pdfPreview = e.pdfPreview ?? ''
  } else {
    form.libroId = props.libroId ?? null
    form.bibliotecaId = null
    form.codigo_ejemplar = ''
    form.codigo_topografico = ''
    form.ubicacion_fisica = ''
    form.estadoEjemplar = 'DISPONIBLE'
    form.fechaAdquisicion = new Date().toISOString().split('T')[0]
    form.precio_compra = null
    form.observaciones = ''
    form.pdf = ''
    form.pdfPreview = ''
  }
}, { immediate: true })

function limpiarErrores() {
  Object.keys(errores).forEach(k => delete errores[k])
}

function validar(): boolean {
  limpiarErrores()
  if (!form.codigo_ejemplar.trim()) errores.codigo_ejemplar = 'El código del ejemplar es requerido'
  if (!form.ubicacion_fisica.trim()) errores.ubicacion_fisica = 'La ubicación es requerida'
  if (!form.libroId) errores.libroId = 'Se requiere un libro asociado'
  return Object.keys(errores).length === 0
}

async function guardar() {
  if (!validar()) return
  guardando.value = true
  errorGeneral.value = ''
  try {
    const payload = { ...form }
    if (props.ejemplar) {
      await api.put(`/ejemplares/${props.ejemplar.id_ejemplar}`, payload)
    } else {
      await api.post('/ejemplares', payload)
    }
    emit('saved')
  } catch (err: unknown) {
    errorGeneral.value = err instanceof Error ? err.message : 'Error al guardar el ejemplar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal :title="ejemplar ? 'Editar ejemplar' : 'Nuevo ejemplar'" size="md" @close="emit('close')">
    <div class="space-y-4">
      <!-- Código ejemplar + topográfico -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código ejemplar *</label>
          <input v-model="form.codigo_ejemplar" type="text" placeholder="JAVA-011"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.codigo_ejemplar ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.codigo_ejemplar" class="text-xs text-red-500 mt-1">{{ errores.codigo_ejemplar }}</p>
          <p class="text-xs text-slate-400 mt-1">Debe ser único</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código topográfico</label>
          <input v-model="form.codigo_topografico" type="text" placeholder="004-JAV-2020"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- Ubicación -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Ubicación física *</label>
        <input v-model="form.ubicacion_fisica" type="text" placeholder="Estante A11"
          class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :class="errores.ubicacion_fisica ? 'border-red-400' : 'border-slate-200'" />
        <p v-if="errores.ubicacion_fisica" class="text-xs text-red-500 mt-1">{{ errores.ubicacion_fisica }}</p>
      </div>

      <!-- Estado -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
        <select v-model="form.estadoEjemplar"
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option v-for="op in opcionesEstado" :key="op.value" :value="op.value">{{ op.label }}</option>
        </select>
      </div>

      <!-- Fecha y precio -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Fecha adquisición</label>
          <input v-model="form.fechaAdquisicion" type="date"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Precio compra (Bs.)</label>
          <input v-model.number="form.precio_compra" type="number" step="0.01" placeholder="45.50"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- Links PDF -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">URL del PDF completo</label>
        <input v-model="form.pdf" type="text" placeholder="https://..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">URL de previsualización (imagen)</label>
        <input v-model="form.pdfPreview" type="text" placeholder="https://..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <!-- Observaciones -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
        <textarea v-model="form.observaciones" rows="2" placeholder="Notas adicionales..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <!-- Errores -->
      <p v-if="errores.libroId" class="text-sm text-red-500">{{ errores.libroId }}</p>
      <p v-if="errorGeneral" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorGeneral }}</p>
    </div>

    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
        Cancelar
      </button>
      <button @click="guardar" :disabled="guardando"
        class="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ ejemplar ? 'Guardar cambios' : 'Crear ejemplar' }}
      </button>
    </template>
  </BaseModal>
</template>