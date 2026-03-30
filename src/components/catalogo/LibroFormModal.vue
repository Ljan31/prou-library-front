<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import api from '@/services/axios'
import type { Libro, Categoria } from '@/types/catalogo'

const props = defineProps<{
  libro: Libro | null
  categorias: Categoria[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const guardando = ref(false)
const errors = reactive<Record<string, string>>({})

// Preview portada
const portadaPreview = ref(props.libro?.imagen_portada ?? '')
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

// Rellenar al editar
watch(() => props.libro, (libro) => {
  if (libro) {
    Object.assign(form, {
      isbn: libro.isbn ?? '',
      titulo: libro.titulo ?? '',
      editorial: libro.editorial ?? '',
      anoPublicacion: libro.anoPublicacion ?? new Date().getFullYear(),
      edicion: libro.edicion ?? '1ª',
      numero_paginas: libro.numero_paginas ?? null,
      idioma: libro.idioma ?? 'Español',
      categoriaId: libro.categoria?.id_categoria ?? null,
      descripcion: libro.descripcion ?? '',
      imagen_portada: libro.imagen_portada ?? '',
    })
    portadaPreview.value = libro.imagen_portada ?? ''
  }
}, { immediate: true })

const opcionesCategoria = props.categorias.map(c => ({
  value: c.id_categoria,
  label: c.nombre_categoria
}))

const idiomasOpciones = [
  { value: 'Español', label: 'Español' },
  { value: 'Inglés', label: 'Inglés' },
  { value: 'Portugués', label: 'Portugués' },
  { value: 'Francés', label: 'Francés' },
  { value: 'Alemán', label: 'Alemán' },
]

// Simulación de subida de imagen (preview local)
function onPortadaChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    portadaPreview.value = ev.target?.result as string
    form.imagen_portada = portadaPreview.value // en producción sería la URL del servidor
  }
  reader.readAsDataURL(file)
}

function onPdfChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  pdfNombre.value = file.name
  // En producción: subir al servidor y guardar URL
}

function validar(): boolean {
  const e = errors
  Object.keys(e).forEach(k => delete e[k])

  if (!form.titulo.trim()) e.titulo = 'El título es requerido'
  if (!form.isbn.trim()) e.isbn = 'El ISBN es requerido'
  if (!form.editorial.trim()) e.editorial = 'La editorial es requerida'
  if (!form.categoriaId) e.categoriaId = 'La categoría es requerida'
  if (form.anoPublicacion < 1000 || form.anoPublicacion > new Date().getFullYear() + 1)
    e.anoPublicacion = 'Año inválido'

  return Object.keys(e).length === 0
}

async function guardar() {
  if (!validar()) return

  guardando.value = true
  try {
    const payload = { ...form }
    if (props.libro) {
      await api.put(`/libros/${props.libro.id_libro}`, payload)
    } else {
      await api.post('/libros', payload)
    }
    emit('saved')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al guardar'
    errors.general = msg
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <SModal :model-value="true" :title="libro ? 'Editar libro' : 'Nuevo libro'" size="lg"
    @update:model-value="emit('close')">
    <form @submit.prevent="guardar" class="space-y-5">
      <!-- Fila: portada + campos básicos -->
      <div class="flex gap-5">
        <!-- Preview portada -->
        <div class="flex-shrink-0">
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Portada</label>
          <div
            class="relative w-28 h-40 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 group cursor-pointer">
            <img v-if="portadaPreview" :src="portadaPreview" alt="Portada" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center gap-2">
              <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-xs text-slate-400 text-center px-2">Subir portada</span>
            </div>
            <!-- Overlay editar -->
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
        <div class="flex-1 grid grid-cols-1 gap-3">
          <SInput v-model="form.titulo" label="Título *" placeholder="Título del libro"
            :error-message="errors.titulo" />
          <div class="grid grid-cols-2 gap-3">
            <SInput v-model="form.isbn" label="ISBN *" placeholder="978-..." :error-message="errors.isbn" />
            <SInput v-model="form.edicion" label="Edición" placeholder="1ª" />
          </div>
          <SInput v-model="form.editorial" label="Editorial *" :error-message="errors.editorial" />
        </div>
      </div>

      <!-- Segunda fila -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="sm:col-span-2">
          <SSelect v-model="form.categoriaId" label="Categoría *" :options="opcionesCategoria"
            :error-message="errors.categoriaId" />
        </div>
        <SInput v-model.number="form.anoPublicacion" type="number" label="Año" :error-message="errors.anoPublicacion" />
        <SInput v-model.number="form.numero_paginas" type="number" label="Páginas" placeholder="450" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <SSelect v-model="form.idioma" label="Idioma" :options="idiomasOpciones" />
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">URL portada (o subir arriba)</label>
          <SInput v-model="form.imagen_portada" placeholder="https://..." />
        </div>
      </div>

      <!-- Descripción -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1.5">Descripción</label>
        <textarea v-model="form.descripcion" rows="3" placeholder="Descripción breve del libro..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
      </div>

      <!-- PDF simulado -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1.5">PDF del libro (simulado)</label>
        <div class="flex items-center gap-3">
          <label
            class="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span class="text-sm text-slate-600">{{ pdfNombre || 'Seleccionar PDF' }}</span>
            <input type="file" accept="application/pdf" class="sr-only" @change="onPdfChange" />
          </label>
          <span v-if="pdfNombre" class="text-xs text-emerald-600 flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Cargado
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-1">El PDF se usará para visualización por estudiantes</p>
      </div>

      <!-- Error general -->
      <p v-if="errors.general" class="text-sm text-red-500">{{ errors.general }}</p>
    </form>

    <template #footer>
      <SButton variant="ghost" @click="emit('close')">Cancelar</SButton>
      <SButton variant="primary" :loading="guardando" @click="guardar">
        {{ libro ? 'Guardar cambios' : 'Crear libro' }}
      </SButton>
    </template>
  </SModal>
</template>