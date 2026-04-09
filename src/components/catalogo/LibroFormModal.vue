<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import EdicionFormModal from './EdicionFormModal.vue'
import { crearLibro, actualizarLibro } from '@/services/libros.service'
import { eliminarEdicion } from '@/services/ediciones.service'
import { usePermissions } from '@/composables/usePermissions'
import { primeraPortada, primerIsbn } from '@/utils/catalogo'
import type { Libro, Categoria, Edicion } from '@/types/catalogo'

const props = defineProps<{
  libro: Libro | null
  categorias: Categoria[]
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { isAdmin } = usePermissions()

// ─── Estado ──────────────────────────────────────────────────────────────
const guardando = ref(false)
const errorGeneral = ref('')
const errores = reactive<Record<string, string>>({})

// Sub-modal de edición
const mostrarEdicionModal = ref(false)
const edicionEditando = ref<Edicion | null>(null)

const form = reactive({
  titulo: '',
  idioma: 'es',
  categoriaId: null as number | null,
  descripcion: '',
})

const idiomasOpciones = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
  { value: 'fr', label: 'Francés' },
  { value: 'de', label: 'Alemán' },
]

const opcionesCategorias = computed(() =>
  props.categorias.map(c => ({ value: c.id_categoria, label: c.nombre_categoria }))
)

// Rellenar al editar
watch(() => props.libro, (nuevoLibro) => {
  limpiarErrores(); errorGeneral.value = ''
  // form.titulo = l?.titulo ?? ''
  // form.idioma = l?.idioma ?? 'es'
  // form.categoriaId = l?.categoria?.id_categoria ?? null
  // form.descripcion = l?.descripcion ?? ''
  if (nuevoLibro) {
    // Modo editar
    form.titulo = nuevoLibro.titulo ?? ''
    form.idioma = nuevoLibro.idioma ?? 'es'
    form.categoriaId = nuevoLibro.categoria?.id_categoria ?? null
    form.descripcion = nuevoLibro.descripcion ?? ''
  } else {
    // Modo crear → limpiar formulario
    form.titulo = ''
    form.idioma = 'es'
    form.categoriaId = null
    form.descripcion = ''
  }
}, { immediate: true })

function limpiarErrores() {
  Object.keys(errores).forEach(k => delete errores[k])
}

function validar(): boolean {
  limpiarErrores()
  if (!form.titulo.trim()) errores.titulo = 'El título es requerido'
  if (!form.categoriaId) errores.categoriaId = 'La categoría es requerida'
  return Object.keys(errores).length === 0
}

async function guardar() {
  if (!validar()) return
  guardando.value = true; errorGeneral.value = ''
  try {
    const payload = {
      titulo: form.titulo.trim(),
      idioma: form.idioma,
      categoriaId: form.categoriaId,
      descripcion: form.descripcion.trim() || undefined,
    }
    if (props.libro) {
      await actualizarLibro(props.libro.idLibro, payload)
    } else {
      await crearLibro(payload as { titulo: string; idioma: string; categoriaId: number; descripcion?: string })
    }
    emit('saved')
  } catch (e: unknown) {
    errorGeneral.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// ─── Gestión de ediciones (solo al editar un libro existente) ─────────────
function abrirNuevaEdicion() {
  edicionEditando.value = null
  mostrarEdicionModal.value = true
}

function abrirEditarEdicion(ed: Edicion) {
  edicionEditando.value = ed
  mostrarEdicionModal.value = true
}

async function confirmarEliminarEdicion(ed: Edicion) {
  if (!confirm(`¿Eliminar la edición ISBN ${ed.isbn}? Solo es posible si no tiene ejemplares.`)) return
  try {
    await eliminarEdicion(ed.idEdicion)
    emit('saved') // refrescar el libro padre
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : 'Error al eliminar la edición')
  }
}

function onEdicionGuardada() {
  mostrarEdicionModal.value = false
  emit('saved') // refresca el libro para ver la nueva edición
}
</script>

<template>
  <BaseModal :title="libro ? 'Editar libro' : 'Nuevo libro'" size="lg" @close="emit('close')">
    <div class="space-y-5">

      <!-- ── Campos del libro ── -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Título *</label>
        <input v-model="form.titulo" type="text" placeholder="Título del libro"
          class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :class="errores.titulo ? 'border-red-400' : 'border-slate-200'" />
        <p v-if="errores.titulo" class="text-xs text-red-500 mt-1">{{ errores.titulo }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Categoría *</label>
          <select v-model="form.categoriaId"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            :class="errores.categoriaId ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar categoría</option>
            <option v-for="op in opcionesCategorias" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>
          <p v-if="errores.categoriaId" class="text-xs text-red-500 mt-1">{{ errores.categoriaId }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Idioma</label>
          <select v-model="form.idioma"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            <option v-for="op in idiomasOpciones" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
        <textarea v-model="form.descripcion" rows="3" placeholder="Descripción breve del libro..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <!-- ── Aviso al crear ── -->
      <div v-if="!libro" class="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
        <svg class="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-xs text-indigo-700">
          Después de crear el libro podrás agregar sus <strong>ediciones</strong> (ISBN, editorial, portada) desde el
          detalle.
        </p>
      </div>

      <!-- ── Ediciones del libro (solo al editar) ── -->
      <div v-if="libro">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-medium text-slate-600 uppercase tracking-wide">Ediciones</p>
          <button @click="abrirNuevaEdicion"
            class="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Nueva edición
          </button>
        </div>

        <div v-if="!libro.ediciones?.length"
          class="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
          Sin ediciones. Agrega la primera edición con ISBN, editorial y portada.
        </div>

        <div v-else class="space-y-2">
          <div v-for="ed in libro.ediciones" :key="ed.idEdicion"
            class="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <!-- Portada mini -->
            <div class="w-8 h-11 rounded overflow-hidden bg-slate-200 flex-shrink-0">
              <img v-if="ed.imagenPortada" :src="ed.imagenPortada" :alt="ed.isbn" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono font-medium text-slate-800 truncate">{{ ed.isbn }}</p>
              <p class="text-xs text-slate-500 truncate">{{ ed.editorial }} · {{ ed.anoPublicacion }}
                <template v-if="ed.edicion"> · {{ ed.edicion }}</template>
              </p>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button @click="abrirEditarEdicion(ed)"
                class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button v-if="isAdmin" @click="confirmarEliminarEdicion(ed)"
                class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="errorGeneral" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorGeneral }}</p>
    </div>

    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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

  <!-- Sub-modal de edición -->
  <EdicionFormModal v-if="mostrarEdicionModal && libro" :edicion="edicionEditando" :libro-id="libro.idLibro"
    @close="mostrarEdicionModal = false" @saved="onEdicionGuardada" />
</template>