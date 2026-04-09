<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { crearEjemplar, actualizarEjemplar } from '@/services/ejemplares.service'
import type { Ejemplar, Edicion } from '@/types/catalogo'

const props = defineProps<{
  ejemplar: Ejemplar | null
  // Ediciones disponibles del libro para elegir a cuál asociar
  ediciones?: Edicion[]
  // Si se pasa una edicion pre-seleccionada (desde el detalle de una edición)
  edicionIdInicial?: number
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const guardando = ref(false)
const errorGeneral = ref('')
const errores = reactive<Record<string, string>>({})

const opcionesEstado = [
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'EN_REPARACION', label: '🟡 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
]

const form = reactive({
  edicionId: props.edicionIdInicial ?? null as number | null,
  bibliotecaId: null as number | null,
  codigoEjemplar: '',
  codigoTopografico: '',
  ubicacionFisica: '',
  estadoEjemplar: 'DISPONIBLE',
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precioCompra: null as number | null,
  observaciones: '',
})

watch(() => props.ejemplar, (e) => {
  limpiarErrores(); errorGeneral.value = ''
  if (e) {
    form.edicionId = e.edicion?.idEdicion ?? props.edicionIdInicial ?? null
    form.bibliotecaId = e.biblioteca?.idBiblioteca ?? null
    form.codigoEjemplar = e.codigoEjemplar ?? ''
    form.codigoTopografico = e.codigoTopografico ?? ''
    form.ubicacionFisica = e.ubicacionFisica ?? ''
    form.estadoEjemplar = e.estadoEjemplar ?? 'DISPONIBLE'
    form.fechaAdquisicion = e.fechaAdquisicion ?? new Date().toISOString().split('T')[0]
    form.precioCompra = e.precioCompra ?? null
    form.observaciones = e.observaciones ?? ''
  } else {
    form.edicionId = props.edicionIdInicial ?? null
    form.bibliotecaId = null
    form.codigoEjemplar = ''
    form.codigoTopografico = ''
    form.ubicacionFisica = ''
    form.estadoEjemplar = 'DISPONIBLE'
    form.fechaAdquisicion = new Date().toISOString().split('T')[0]
    form.precioCompra = null
    form.observaciones = ''
  }
}, { immediate: true })

function limpiarErrores() { Object.keys(errores).forEach(k => delete errores[k]) }

function validar(): boolean {
  limpiarErrores()
  if (!form.codigoEjemplar.trim()) errores.codigoEjemplar = 'El código es requerido'
  if (!form.ubicacionFisica.trim()) errores.ubicacionFisica = 'La ubicación es requerida'
  if (!form.edicionId) errores.edicionId = 'Debe seleccionar una edición'
  return Object.keys(errores).length === 0
}

async function guardar() {
  if (!validar()) return
  guardando.value = true; errorGeneral.value = ''
  try {
    if (props.ejemplar) {
      await actualizarEjemplar(props.ejemplar.idEjemplar, {
        codigoEjemplar: form.codigoEjemplar,
        codigoTopografico: form.codigoTopografico || undefined,
        ubicacionFisica: form.ubicacionFisica || undefined,
        edicionId: form.edicionId!,
        bibliotecaId: form.bibliotecaId!,
        precioCompra: form.precioCompra,
        observaciones: form.observaciones || undefined,
      })
    } else {
      await crearEjemplar({
        codigoEjemplar: form.codigoEjemplar,
        codigoTopografico: form.codigoTopografico || undefined,
        ubicacionFisica: form.ubicacionFisica || undefined,
        edicionId: form.edicionId!,
        bibliotecaId: form.bibliotecaId!,
        estadoEjemplar: form.estadoEjemplar as any,
        fechaAdquisicion: form.fechaAdquisicion || undefined,
        precioCompra: form.precioCompra,
        observaciones: form.observaciones || undefined,
      })
    }
    emit('saved')
  } catch (e: unknown) {
    errorGeneral.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal :title="ejemplar ? 'Editar ejemplar' : 'Nuevo ejemplar'" size="md" @close="emit('close')">
    <div class="space-y-4">

      <!-- Selección de edición (si se pasan varias) -->
      <div v-if="ediciones && ediciones.length > 1">
        <label class="block text-xs font-medium text-slate-600 mb-1">Edición *</label>
        <select v-model="form.edicionId"
          class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          :class="errores.edicionId ? 'border-red-400' : 'border-slate-200'">
          <option :value="null" disabled>Seleccionar edición</option>
          <option v-for="ed in ediciones" :key="ed.idEdicion" :value="ed.idEdicion">
            {{ ed.isbn }} — {{ ed.editorial }} ({{ ed.anoPublicacion }})
          </option>
        </select>
        <p v-if="errores.edicionId" class="text-xs text-red-500 mt-1">{{ errores.edicionId }}</p>
      </div>

      <!-- Código + Topográfico -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código ejemplar *</label>
          <input v-model="form.codigoEjemplar" type="text" placeholder="EJ-2024-010"
            class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.codigoEjemplar ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.codigoEjemplar" class="text-xs text-red-500 mt-1">{{ errores.codigoEjemplar }}</p>
          <p class="text-xs text-slate-400 mt-0.5">Debe ser único</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código topográfico</label>
          <input v-model="form.codigoTopografico" type="text" placeholder="004.1 C676"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- Ubicación -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Ubicación física *</label>
        <input v-model="form.ubicacionFisica" type="text" placeholder="Estante B-2, Fila 1"
          class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :class="errores.ubicacionFisica ? 'border-red-400' : 'border-slate-200'" />
        <p v-if="errores.ubicacionFisica" class="text-xs text-red-500 mt-1">{{ errores.ubicacionFisica }}</p>
      </div>

      <!-- Estado (solo al crear) -->
      <div v-if="!ejemplar">
        <label class="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
        <select v-model="form.estadoEjemplar"
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option v-for="op in opcionesEstado" :key="op.value" :value="op.value">{{ op.label }}</option>
        </select>
      </div>

      <!-- Fecha + Precio -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Fecha adquisición</label>
          <input v-model="form.fechaAdquisicion" type="date"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Precio compra (Bs.)</label>
          <input v-model.number="form.precioCompra" type="number" step="0.01" placeholder="85.00"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- Observaciones -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
        <textarea v-model="form.observaciones" rows="2" placeholder="Donación FHCE 2024..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <p v-if="errores.edicionId && !(ediciones && ediciones.length > 1)" class="text-sm text-red-500">{{
        errores.edicionId }}</p>
      <p v-if="errorGeneral" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorGeneral }}</p>
    </div>

    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        Cancelar
      </button>
      <button @click="guardar" :disabled="guardando"
        class="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ ejemplar ? 'Guardar cambios' : 'Crear ejemplar' }}
      </button>
    </template>
  </BaseModal>
</template>