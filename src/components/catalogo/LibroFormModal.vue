<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import api from '@/services/axios'
import { invalidarCacheLibros } from '@/services/libros.service'
import type { Libro, Categoria } from '@/types/catalogo'

const props = defineProps<{
  libro: Libro | null
  categorias: Categoria[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

// ─── Estado ──────────────────────────────────────────────────────────────
const guardando = ref(false)
const errorGeneral = ref('')
const portadaPreview = ref('')
const pdfNombre = ref('')

const form = reactive({
  isbn: '',
  titulo: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '1ª',
  numero_paginas: null as number | null,
  idioma: 'Español',
  categoriaId: null as number | null,
  descripcion: '',
  imagen_portada: '',
})

const errores = reactive<Record<string, string>>({})

// Rellenar al editar
watch(() => props.libro, (l) => {
  limpiarErrores()
  errorGeneral.value = ''
  if (l) {
    form.isbn = l.isbn ?? ''
    form.titulo = l.titulo ?? ''
    form.editorial = l.editorial ?? ''
    form.anoPublicacion = l.anoPublicacion ?? new Date().getFullYear()
    form.edicion = l.edicion ?? '1ª'
    form.numero_paginas = l.numero_paginas ?? null
    form.idioma = l.idioma ?? 'Español'
    form.categoriaId = l.categoria?.id_categoria ?? null
    form.descripcion = l.descripcion ?? ''
    form.imagen_portada = l.imagen_portada ?? ''
    portadaPreview.value = l.imagen_portada ?? ''
  } else {
    resetForm()
  }
}, { immediate: true })

function resetForm() {
  form.isbn = ''
  form.titulo = ''
  form.editorial = ''
  form.anoPublicacion = new Date().getFullYear()
  form.edicion = '1ª'
  form.numero_paginas = null
  form.idioma = 'Español'
  form.categoriaId = null
  form.descripcion = ''
  form.imagen_portada = ''
  portadaPreview.value = ''
  pdfNombre.value = ''
}

function limpiarErrores() {
  Object.keys(errores).forEach(k => delete errores[k])
}

// ─── Computed ──────────────────────────────────────────────────────────
const opcionesCategorias = computed(() =>
  props.categorias.map(c => ({ value: c.id_categoria, label: c.nombre_categoria }))
)

const idiomasOpciones = [
  { value: 'Español', label: 'Español' },
  { value: 'Inglés', label: 'Inglés' },
  { value: 'Portugués', label: 'Portugués' },
  { value: 'Francés', label: 'Francés' },
  { value: 'Alemán', label: 'Alemán' },
]

// ─── Archivos simulados ───────────────────────────────────────────────
function onPortadaChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    portadaPreview.value = ev.target?.result as string
    form.imagen_portada = portadaPreview.value
  }
  reader.readAsDataURL(file)
}

function onPdfChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  pdfNombre.value = file.name
}

// ─── Validación ───────────────────────────────────────────────────────
function validar(): boolean {
  limpiarErrores()
  if (!form.titulo.trim()) errores.titulo = 'El título es requerido'
  if (!form.isbn.trim()) errores.isbn = 'El ISBN es requerido'
  if (!form.editorial.trim()) errores.editorial = 'La editorial es requerida'
  if (!form.categoriaId) errores.categoriaId = 'La categoría es requerida'
  const anioActual = new Date().getFullYear()
  if (!form.anoPublicacion || form.anoPublicacion < 1000 || form.anoPublicacion > anioActual + 1)
    errores.anoPublicacion = 'Año inválido'
  return Object.keys(errores).length === 0
}

// ─── Guardar ──────────────────────────────────────────────────────────
async function guardar() {
  if (!validar()) return
  guardando.value = true
  errorGeneral.value = ''
  try {
    const payload = {
      isbn: form.isbn,
      titulo: form.titulo,
      editorial: form.editorial,
      anoPublicacion: form.anoPublicacion,
      edicion: form.edicion,
      numero_paginas: form.numero_paginas,
      idioma: form.idioma,
      categoriaId: form.categoriaId,
      descripcion: form.descripcion,
      imagen_portada: form.imagen_portada,
    }
    if (props.libro) {
      await api.put(`/libros/${props.libro.id_libro}`, payload)
    } else {
      await api.post('/libros', payload)
    }
    invalidarCacheLibros()
    emit('saved')
  } catch (err: unknown) {
    errorGeneral.value = err instanceof Error ? err.message : 'Error al guardar el libro'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal :title="libro ? 'Editar libro' : 'Nuevo libro'" size="lg" @close="emit('close')">
    <div class="space-y-5">
      <!-- Portada + campos básicos -->
      <div class="flex gap-5">
        <!-- Preview portada -->
        <div class="flex-shrink-0">
          <p class="text-xs font-medium text-slate-600 mb-1.5">Portada</p>
          <div
            class="relative w-28 h-40 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 group">
            <img v-if="portadaPreview" :src="portadaPreview" alt="Portada" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
              <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-xs text-slate-400 text-center">Subir portada</span>
            </div>
            <!-- Overlay para subir -->
            <label
              class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer">
              <svg class="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input type="file" accept="image/*" class="sr-only" @change="onPortadaChange" />
            </label>
          </div>
          <p class="text-xs text-slate-400 mt-1 text-center">JPG, PNG</p>
        </div>

        <!-- Campos principales -->
        <div class="flex-1 space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Título *</label>
            <input v-model="form.titulo" type="text" placeholder="Título del libro"
              class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="errores.titulo ? 'border-red-400' : 'border-slate-200'" />
            <p v-if="errores.titulo" class="text-xs text-red-500 mt-1">{{ errores.titulo }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">ISBN *</label>
              <input v-model="form.isbn" type="text" placeholder="978-..."
                class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="errores.isbn ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="errores.isbn" class="text-xs text-red-500 mt-1">{{ errores.isbn }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Edición</label>
              <input v-model="form.edicion" type="text" placeholder="1ª"
                class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Editorial *</label>
            <input v-model="form.editorial" type="text"
              class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="errores.editorial ? 'border-red-400' : 'border-slate-200'" />
            <p v-if="errores.editorial" class="text-xs text-red-500 mt-1">{{ errores.editorial }}</p>
          </div>
        </div>
      </div>

      <!-- Segunda fila -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="sm:col-span-2">
          <label class="block text-xs font-medium text-slate-600 mb-1">Categoría *</label>
          <select v-model="form.categoriaId"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            :class="errores.categoriaId ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar categoría</option>
            <option v-for="op in opcionesCategorias" :key="op.value" :value="op.value">
              {{ op.label }}
            </option>
          </select>
          <p v-if="errores.categoriaId" class="text-xs text-red-500 mt-1">{{ errores.categoriaId }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Año</label>
          <input v-model.number="form.anoPublicacion" type="number"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.anoPublicacion ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.anoPublicacion" class="text-xs text-red-500 mt-1">{{ errores.anoPublicacion }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Páginas</label>
          <input v-model.number="form.numero_paginas" type="number" placeholder="450"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Idioma</label>
          <select v-model="form.idioma"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            <option v-for="op in idiomasOpciones" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">URL portada (opcional)</label>
          <input v-model="form.imagen_portada" type="text" placeholder="https://..."
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- Descripción -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
        <textarea v-model="form.descripcion" rows="3" placeholder="Descripción breve del libro..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <!-- PDF simulado -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1.5">PDF del libro (simulado)</label>
        <label
          class="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
          <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span class="text-sm text-slate-600">{{ pdfNombre || 'Seleccionar PDF' }}</span>
          <input type="file" accept="application/pdf" class="sr-only" @change="onPdfChange" />
        </label>
        <span v-if="pdfNombre" class="ml-3 text-xs text-emerald-600">✓ Cargado</span>
      </div>

      <!-- Error general -->
      <p v-if="errorGeneral" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
        {{ errorGeneral }}
      </p>
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
        {{ libro ? 'Guardar cambios' : 'Crear libro' }}
      </button>
    </template>
  </BaseModal>
</template>