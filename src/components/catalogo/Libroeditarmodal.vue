<script setup lang="ts">
/**
 * LibroEditarModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Permite editar un libro existente en 3 pestañas:
 *   📋 Info       — datos generales del libro (título, autores, categoría, idioma)
 *   📖 Ediciones  — listar ediciones, ver/cambiar portada, ver PDF, editar datos
 *   📦 Ejemplares — tabla de ejemplares con acciones inline, agregar nuevo
 *
 * Recibe: libroId  (número)
 * Emite:  close, saved
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ref, reactive, computed, onMounted, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import EdicionFormModal from './EdicionFormModal.vue'
import EjemplarFormModal from './EjemplarFormModal.vue'
import EjemplarEstadoModal from './EjemplarEstadoModal.vue'
import EjemplarHistorialModal from './EjemplarHistorialModal.vue'
import ConfirmModal from '@/components/bibliotecas/DeleteConfirmModal.vue'
import api from '@/services/axios'
import { obtenerCategorias } from '@/services/categorias.service'
import { eliminarEdicion } from '@/services/ediciones.service'
import { eliminarEjemplar } from '@/services/ejemplares.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { useMedia } from '@/composables/useMedia'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Categoria, Edicion, Ejemplar } from '@/types/catalogo'

// ── Props / emits ─────────────────────────────────────────────────────────
const props = defineProps<{ libroId: number }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
const ui = useUiStore()
const { isAdmin, isBibliotecario } = usePermissions()
const { getUrl } = useMedia()

// ══════════════════════════════════════════════════════════════════════════
// PESTAÑA ACTIVA
// ══════════════════════════════════════════════════════════════════════════
type Tab = 'info' | 'ediciones' | 'ejemplares'
const tabActiva = ref<Tab>('info')

// ══════════════════════════════════════════════════════════════════════════
// CARGA INICIAL DEL LIBRO
// ══════════════════════════════════════════════════════════════════════════
const cargando = ref(true)
const errorCarga = ref('')

// Datos del libro cargado
const libroRaw = ref<any>(null)
const ediciones = ref<Edicion[]>([])
const ejemplares = ref<Ejemplar[]>([])

// Categorías y bibliotecas
const categorias = ref<Categoria[]>([])
const bibliotecas = ref<{ id: number; nombre: string }[]>([])

onMounted(async () => {
  await Promise.all([cargarLibro(), cargarCategorias(), cargarBibliotecas()])
})

async function cargarLibro() {
  cargando.value = true
  errorCarga.value = ''
  try {
    const res = await api.get(`/libros/${props.libroId}`)
    const data = res.data?.data ?? res.data
    console.log('Datos extraídos del API:', data)
    libroRaw.value = data

    // Rellenar form info
    formInfo.titulo = data.titulo ?? ''
    formInfo.idioma = data.idioma ?? 'es'
    formInfo.categoriaId = data.categoria?.id_categoria ?? data.categoria?.idCategoria ?? null
    formInfo.descripcion = data.descripcion ?? ''

    // Autores
    autores.value = (data.autores ?? []).map((a: any) => ({
      idAutor: a.idAutor ?? a.id_autor,
      nombre: a.nombre ?? a.nombreCompleto ?? '',
    }))

    // Ediciones
    ediciones.value = data.ediciones ?? []
    console.log('Ediciones:', ediciones.value)
    // Ejemplares: aplanar de todas las ediciones
    const ejsPlanos: Ejemplar[] = []
    for (const ed of (data.ediciones ?? [])) {
      if (ed.ejemplares?.length) ejsPlanos.push(...ed.ejemplares)
    }
    console.log('Ejemplares planos antes de fallback:', ejsPlanos)
    // Si no vienen en el libro, cargar por separado
    if (!ejsPlanos.length) {
      await cargarEjemplares()
      console.log('Ejemplares cargados por separado:', ejemplares.value)

    }
    else ejemplares.value = ejsPlanos
    console.log('libro: ', libroRaw)
  } catch (e: unknown) {
    errorCarga.value = e instanceof Error ? e.message : 'Error al cargar el libro'
  } finally {
    cargando.value = false
  }
}

async function cargarEjemplares() {
  try {
    const res = await api.get(`/ejemplares/libro/${props.libroId}`)
    const data = res.data?.data ?? res.data
    ejemplares.value = Array.isArray(data) ? data : []
  } catch { ejemplares.value = [] }
}

async function cargarCategorias() {
  try { categorias.value = await obtenerCategorias() } catch { }
}

async function cargarBibliotecas() {
  if (!isAdmin.value) {
    const lista = auth.user?.biblioteca
    if (lista?.length) {
      const bib = lista[0]
      const id = bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id
      const nombre = bib.nombre ?? bib.name
      if (id && nombre) bibliotecas.value = [{ id, nombre }]
    }
    return
  }
  try {
    const res = await bibliotecasService.getAll()
    const raw = (res.data as any)?.data ?? res.data
    const lista = Array.isArray(raw) ? raw : []
    bibliotecas.value = lista
      .filter((b: any) => b.estado === 'ACTIVA' || !b.estado)
      .map((b: any) => ({
        id: b.id_biblioteca ?? b.idBiblioteca ?? b.id,
        nombre: b.nombre ?? b.name,
      }))
  } catch { }
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 1 — INFO DEL LIBRO
// ══════════════════════════════════════════════════════════════════════════
const formInfo = reactive({
  titulo: '',
  idioma: 'es',
  categoriaId: null as number | null,
  descripcion: '',
})
const erroresInfo = reactive<Record<string, string>>({})
const guardandoInfo = ref(false)

// Autores
const autores = ref<{ idAutor?: number; nombre: string; nuevo?: boolean }[]>([])
const busquedaAutor = ref('')
const resultadosAutores = ref<any[]>([])
const buscandoAutores = ref(false)
const mostrarDropdownAutor = ref(false)
let timerAutor: ReturnType<typeof setTimeout>

watch(busquedaAutor, (q) => {
  clearTimeout(timerAutor)
  if (!q.trim()) { resultadosAutores.value = []; mostrarDropdownAutor.value = false; return }
  timerAutor = setTimeout(() => buscarAutores(q), 320)
})
const cerrarDropdownAutor = () => {
  setTimeout(() => {
    mostrarDropdownAutor.value = false
  }, 180)
}
async function buscarAutores(q: string) {
  buscandoAutores.value = true
  mostrarDropdownAutor.value = true
  try {
    const res = await api.get('/autores/search', { params: { q } })
    const data = res.data?.data ?? res.data
    resultadosAutores.value = Array.isArray(data) ? data : []
  } catch { resultadosAutores.value = [] }
  finally { buscandoAutores.value = false }
}

function agregarAutorExistente(autor: any) {
  if (!autores.value.find(a => a.idAutor === autor.idAutor)) {
    autores.value.push({ idAutor: autor.idAutor, nombre: autor.nombre })
  }
  busquedaAutor.value = ''
  mostrarDropdownAutor.value = false
}

function crearNuevoAutor() {
  const nombre = busquedaAutor.value.trim()
  if (!nombre) return
  if (!autores.value.find(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
    autores.value.push({ nombre, nuevo: true })
  }
  busquedaAutor.value = ''
  mostrarDropdownAutor.value = false
}

function quitarAutor(idx: number) { autores.value.splice(idx, 1) }

async function guardarInfo() {
  Object.keys(erroresInfo).forEach(k => delete erroresInfo[k])
  if (!formInfo.titulo.trim()) { erroresInfo.titulo = 'El título es requerido'; return }
  guardandoInfo.value = true
  try {
    await api.put(`/libros/${props.libroId}`, {
      titulo: formInfo.titulo.trim(),
      idioma: formInfo.idioma,
      categoriaId: formInfo.categoriaId || undefined,
      descripcion: formInfo.descripcion.trim() || undefined,
      autorIds: autores.value.filter(a => !a.nuevo && a.idAutor).map(a => a.idAutor),
      autores: autores.value.filter(a => a.nuevo).map(a => ({ nombre: a.nombre })),
    })
    emit('saved')
  } catch (e: unknown) {
    const err = e as any
    erroresInfo.general = err?.response?.data?.message ?? (e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    guardandoInfo.value = false
  }
}

// ─── Sub-modales con un único ref de control ──────────────────────────────
type SubModal = 'edicion-form' | 'ejemplar-form' | 'estado' | 'historial' | null

const subModal = ref<SubModal>(null)
const edicionEditando = ref<Edicion | null>(null)
const edicionIdParaEjemplar = ref<number | null>(null)
const ejemplarSeleccionado = ref<Ejemplar | null>(null)
const ejemplarEditando = ref<Ejemplar | null>(null)

const mostrarModalEliminarEdicion = ref(false)
const edicionAEliminar = ref<Edicion | null>(null)
const eliminandoEdicion = ref(false)
function cerrar() {
  subModal.value = null
  edicionEditando.value = null
  edicionIdParaEjemplar.value = null
  ejemplarSeleccionado.value = null
  ejemplarEditando.value = null
  edicionAEliminar.value = null
  ejemplarAEliminar.value = null

  mostrarModalEliminarEdicion.value = false
  mostrarModalEliminarEjemplar.value = false
}

// Ediciones
function abrirNuevaEdicion() { edicionEditando.value = null; subModal.value = 'edicion-form' }
function abrirEditarEdicion(ed: Edicion) { 
  console.log('editar edicion', ed)
  edicionEditando.value = ed; subModal.value = 'edicion-form' 
}

// async function confirmarEliminarEdicion(ed: Edicion) {
//   if (!confirm(`¿Eliminar la edición ISBN ${ed.isbn}? Solo es posible si no tiene ejemplares.`)) return
//   try {
//     await eliminarEdicion(ed.idEdicion)
//     ui.toast.success('Eliminada', 'Edición eliminada correctamente')
//     emit('editar', props.libro) // refresca el libro padre
//   } catch (e: unknown) {
//     ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo eliminar')
//   }
// }
function confirmarEliminarEdicion(ed: Edicion) {
  edicionAEliminar.value = ed
  mostrarModalEliminarEdicion.value = true
}

async function eliminarEdicionConfirmada() {
  if (!edicionAEliminar.value) return

  eliminandoEdicion.value = true

  try {
    await eliminarEdicion(edicionAEliminar.value.idEdicion)
    ui.toast.success(
      'Eliminada',
      'Edición eliminada correctamente'
    )
    mostrarModalEliminarEdicion.value = false
    edicionAEliminar.value = null
    cargarLibro()
    // emit('editar', props.libro)
  } catch (e: unknown) {

    const mensaje =
      e?.response?.data?.message ||
      e?.message ||
      'No se pudo eliminar'

    ui.toast.error('Error', mensaje)
mostrarModalEliminarEdicion.value = false
    edicionAEliminar.value = null
  } finally {
    eliminandoEdicion.value = false
  }
}


// Ejemplares
const mostrarModalEliminarEjemplar = ref(false)
const ejemplarAEliminar = ref<Ejemplar | null>(null)
const eliminandoEjemplar = ref(false)
function abrirNuevoEjemplar(edicionId?: number) {
  console.log('==============')
  console.log(edicionId)
  console.log(ediciones.value)
  ejemplarEditando.value = null
  edicionIdParaEjemplar.value = edicionId ?? ediciones?.value?.[0]?.idEdicion ?? null
  subModal.value = 'ejemplar-form'
}

function abrirEditarEjemplar(e: Ejemplar) {
  console.log('e', e)
  ejemplarEditando.value = e
  subModal.value = 'ejemplar-form'
}

function abrirCambioEstado(e: Ejemplar) { ejemplarSeleccionado.value = e; subModal.value = 'estado' }
function abrirHistorial(e: Ejemplar) { ejemplarSeleccionado.value = e; subModal.value = 'historial' }
function confirmarEliminarEjemplar(ej: Ejemplar) {
  ejemplarAEliminar.value = ej
  mostrarModalEliminarEjemplar.value = true
}

async function eliminarEjemplarConfirmada() {
  if (!ejemplarAEliminar.value) return

  eliminandoEjemplar.value = true
  console.log('deleteEJ',ejemplarAEliminar.value)
  try {
    await eliminarEjemplar(ejemplarAEliminar.value.id_ejemplar)
    ui.toast.success(
      'Eliminada',
      'Ejemplar eliminada correctamente'
    )
    mostrarModalEliminarEjemplar.value = false
    ejemplarAEliminar.value = null
    cargarLibro()
    // emit('editar', props.libro)
  } catch (e: unknown) {

    const mensaje =
      e?.response?.data?.message ||
      e?.message ||
      'No se pudo eliminar'

    ui.toast.error('Error', mensaje)
mostrarModalEliminarEjemplar.value = false
    ejemplarAEliminar.value = null
  } finally {
    eliminandoEjemplar.value = false
  }
}
function onEdicionGuardada() {
  cerrar()
  ui.toast.success('Guardado', 'Edición guardada correctamente')
  // emit('saved', props.libroId) // refresca desde arriba
  cargarLibro()
}

function onEjemplarGuardado() {
  cerrar()
  cargarEjemplares()
  ui.toast.success('Guardado', 'Ejemplar guardado correctamente')
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 — EDICIONES
// ══════════════════════════════════════════════════════════════════════════

// Visor PDF
const pdfViewerUrl = ref('')
const mostrarPdfViewer = ref(false)

function abrirPdf(urlOPath: string) {
  const url = urlOPath.startsWith('http') ? urlOPath : getUrl(urlOPath)
  pdfViewerUrl.value = url
  mostrarPdfViewer.value = true
}
function cerrarPdf() { mostrarPdfViewer.value = false; pdfViewerUrl.value = '' }

// ══════════════════════════════════════════════════════════════════════════
// TAB 3 — EJEMPLARES
// ══════════════════════════════════════════════════════════════════════════

// Filtro por edición
const filtroEdicionId = ref<number | 'todos'>('todos')

const ejemplaresFiltrados = computed(() => {
  if (filtroEdicionId.value === 'todos') return ejemplares.value
  return ejemplares.value.filter(e =>
    (e.edicion?.idEdicion ?? (e as any).idEdicion) === filtroEdicionId.value
  )
})

const bibliotecaPropia = computed(() => {
  const lista = auth.user?.biblioteca
  if (!lista?.length) return null
  const bib = lista[0]
  const id = bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id
  const nombre = bib.nombre ?? bib.name
  return id && nombre ? { id, nombre } : null
})


// ── Helpers ───────────────────────────────────────────────────────────────
const categoriaActual = computed(() =>
  categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === formInfo.categoriaId)
)
</script>

<template>
  <BaseModal title="Editar libro" size="xl" @close="emit('close')">

    <!-- ── Cargando ──────────────────────────────────────────────────────── -->
    <div v-if="cargando" class="flex flex-col items-center gap-3 py-12">
      <svg class="w-7 h-7 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p class="text-sm text-slate-400">Cargando libro...</p>
    </div>

    <!-- ── Error carga ───────────────────────────────────────────────────── -->
    <div v-else-if="errorCarga" class="text-center py-10">
      <p class="text-sm text-red-500">{{ errorCarga }}</p>
      <button @click="cargarLibro" class="mt-3 text-xs text-indigo-600 hover:underline font-medium">Reintentar</button>
    </div>

    <template v-else>

      <!-- ── Tabs ─────────────────────────────────────────────────────────── -->
      <div class="flex gap-1 mb-6 border-b border-slate-200">
        <button v-for="tab in [
          { key: 'info', label: 'Información', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { key: 'ediciones', label: 'Ediciones', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
          { key: 'ejemplares', label: 'Ejemplares', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
        ]" :key="tab.key" @click="tabActiva = tab.key as Tab" :class="[
          'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
          tabActiva === tab.key
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
        ]">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
          </svg>
          <span>{{ tab.label }}</span>
          <span v-if="tab.key === 'ediciones'"
            class="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
            {{ ediciones.length }}
          </span>
          <span v-if="tab.key === 'ejemplares'"
            class="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
            {{ ejemplares.length }}
          </span>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════
           TAB 1 — INFORMACIÓN DEL LIBRO
      ══════════════════════════════════════════════════════════════════ -->
      <div v-if="tabActiva === 'info'" class="space-y-5">

        <!-- Título -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
            Título <span class="text-red-400">*</span>
          </label>
          <input v-model="formInfo.titulo" type="text"
            class="w-full text-sm rounded-xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="erroresInfo.titulo ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
          <p v-if="erroresInfo.titulo" class="text-xs text-red-500 mt-1">{{ erroresInfo.titulo }}</p>
        </div>

        <!-- Autores -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Autores</label>

          <div v-if="autores.length" class="flex flex-wrap gap-1.5 mb-2">
            <span v-for="(autor, i) in autores" :key="i"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              :class="autor.nuevo ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'">
              <span v-if="autor.nuevo" class="font-bold text-amber-600">+</span>
              {{ autor.nombre }}
              <button @click="quitarAutor(i)" class="ml-0.5 text-slate-400 hover:text-red-500 transition-colors">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>

          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <input v-model="busquedaAutor" type="text" placeholder="Buscar o crear autor..."
              @focus="mostrarDropdownAutor = busquedaAutor.length > 0"
              @blur="cerrarDropdownAutor"
              class="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

            <div v-if="mostrarDropdownAutor"
              class="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              <div v-if="buscandoAutores" class="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
                <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Buscando...
              </div>
              <template v-else>
                <button v-for="autor in resultadosAutores" :key="autor.idAutor"
                  @mousedown.prevent="agregarAutorExistente(autor)"
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-indigo-50 transition-colors">
                  <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span class="text-xs font-semibold text-indigo-600">{{ autor.nombre.charAt(0).toUpperCase()
                    }}</span>
                  </div>
                  <span class="truncate text-slate-800">{{ autor.nombre }}</span>
                </button>
                <button v-if="busquedaAutor.trim()" @mousedown.prevent="crearNuevoAutor"
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-amber-50 text-amber-700 border-t border-slate-100 transition-colors">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Crear "<strong>{{ busquedaAutor }}</strong>"
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- Categoría + Idioma -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Categoría</label>
            <select v-model="formInfo.categoriaId"
              class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option :value="null">Sin categoría</option>
              <option v-for="cat in categorias" :key="cat.id_categoria ?? cat.idCategoria"
                :value="cat.id_categoria ?? cat.idCategoria">
                {{ cat.nombre_categoria ?? cat.nombreCategoria }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Idioma</label>
            <select v-model="formInfo.idioma"
              class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="es">🇧🇴 Español</option>
              <option value="en">🇺🇸 Inglés</option>
              <option value="pt">🇧🇷 Portugués</option>
              <option value="fr">🇫🇷 Francés</option>
              <option value="de">🇩🇪 Alemán</option>
            </select>
          </div>
        </div>

        <!-- Descripción -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Descripción</label>
          <textarea v-model="formInfo.descripcion" rows="3"
            class="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>

        <p v-if="erroresInfo.general"
          class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
          {{ erroresInfo.general }}
        </p>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════
           TAB 2 — EDICIONES
      ══════════════════════════════════════════════════════════════════ -->
      <div v-else-if="tabActiva === 'ediciones'" class="space-y-4">
        <div v-if="isAdmin || isBibliotecario" class="flex justify-end mb-3">
          <button @click="abrirNuevaEdicion"
            class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Nueva edición
          </button>
        </div>
      

        <!-- Sin ediciones -->
        <div v-if="!ediciones.length" class="text-center py-8 border border-dashed border-slate-200 rounded-xl">
          <p class="text-sm text-slate-400">Este libro no tiene ediciones registradas</p>
        </div>
        <div v-else class="space-y-3">
            <div v-for="ed in ediciones" :key="ed.idEdicion"
              class="border border-slate-200 rounded-xl overflow-hidden">
              <div class="flex items-center gap-4 px-4 py-3 bg-slate-50">
                <!-- Portada mini -->
                <div class="w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
                  <img v-if="ed.imagenPortada" :src="getUrl(ed.imagenPortada)" :alt="ed.isbn"
                    class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-mono font-semibold text-slate-900">{{ ed.isbn }}</p>
                  <p class="text-xs text-slate-600">{{ ed.editorial }} · {{ ed.anoPublicacion }}
                    <template v-if="ed.edicion"> · {{ ed.edicion }}</template>
                    <template v-if="ed.numeroPaginas"> · {{ ed.numeroPaginas }} págs.</template>
                  </p>
                  <p class="text-xs text-slate-400 mt-0.5">
                    {{ ed.ejemplaresDisponibles ?? '?' }} / {{ ed.ejemplaresTotal ?? '?' }} disponibles
                  </p>
                </div>
                <div v-if="isAdmin || isBibliotecario" class="flex items-center gap-1 flex-shrink-0">
                  
                   <!-- Ver PDF -->
                  <button v-if="ed.pdfUrl" @click="abrirPdf(ed.pdfUrl)"
                    class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    title="Ver PDF">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    PDF
                    </button>
                    <span v-else
                      class="px-2.5 py-1.5 text-xs text-slate-300 border border-dashed border-slate-200 rounded-lg">
                      Sin PDF
                  </span>
                  <button @click="abrirNuevoEjemplar(ed.idEdicion)"
                    class="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                    title="Agregar ejemplar">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button @click="abrirEditarEdicion(ed)"
                    class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title="Editar">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button v-if="isAdmin || isBibliotecario" @click="confirmarEliminarEdicion(ed)"
                    class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════
           TAB 3 — EJEMPLARES
      ══════════════════════════════════════════════════════════════════ -->
      <div v-else-if="tabActiva === 'ejemplares'" class="space-y-4">
        <div v-if="isAdmin || isBibliotecario" class="flex justify-end mb-3">
          <button @click="abrirNuevoEjemplar()"
            class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Agregar ejemplar
          </button>
        </div>
        <!-- Filtro por edición -->
        <div class="flex items-center gap-2 flex-wrap">
          <button @click="filtroEdicionId = 'todos'"
            :class="['px-3 py-1.5 text-xs rounded-full font-medium transition-colors',
              filtroEdicionId === 'todos' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']">
            Todos ({{ ejemplares.length }})
          </button>
          <button v-for="ed in ediciones" :key="ed.idEdicion" @click="filtroEdicionId = ed.idEdicion"
            :class="['px-3 py-1.5 text-xs rounded-full font-medium font-mono transition-colors',
              filtroEdicionId === ed.idEdicion ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']">
            {{ ed.isbn }}
          </button>
        </div>

        <!-- Lista de ejemplares -->
        <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
          <div v-for="ej in ejemplaresFiltrados" :key="ej.idEjemplar"
            class="rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-200 transition-colors">

            <!-- Fila resumen del ejemplar -->
            <div class="flex items-center gap-3 px-4 py-3">
              <!-- Estado dot -->
              <span :class="['w-2 h-2 rounded-full flex-shrink-0',
                estadoEjemplarConfig[ej.estadoEjemplar]?.dot ?? 'bg-slate-300']" />

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-mono font-semibold text-slate-900">{{ ej.codigoEjemplar }}</span>
                  <span v-if="ej.codigoTopografico" class="text-xs text-slate-400 font-mono">{{ ej.codigoTopografico
                  }}</span>
                    <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                estadoEjemplarConfig[ej.estadoEjemplar]?.clases ?? 'bg-slate-100 text-slate-600']">
                {{ estadoEjemplarConfig[ej.estadoEjemplar]?.label ?? ej.estadoEjemplar }}
              </span>
                </div>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span
                    :class="['text-xs font-medium',
                      estadoEjemplarConfig[ej.estadoEjemplar]?.clases?.replace('bg-', 'text-').split(' ')[0] ?? 'text-slate-500']">
                    {{ estadoEjemplarConfig[ej.estadoEjemplar]?.label ?? ej.estadoEjemplar }}
                  </span>
                  <span v-if="ej.ubicacionFisica" class="text-xs text-slate-400">· {{ ej.ubicacionFisica }}</span>
                  <span v-if="ej.biblioteca?.nombre" class="text-xs text-slate-400">· {{ ej.biblioteca.nombre }}</span>
                </div>
              </div>

              <!-- Editar -->
             
              <div v-if="isAdmin || isBibliotecario" class="flex items-center gap-1.5 flex-shrink-0">

                <!-- Historial -->
                <button
                  @click="abrirHistorial(ej)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Historial">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <!-- Cambiar estado -->
                <button
                  @click="abrirCambioEstado(ej)"
                  :disabled="['BAJA', 'PERDIDO'].includes(ej.estadoEjemplar)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Cambiar estado">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>

                <!-- Editar -->
                <button
                  @click="abrirEditarEjemplar(ej)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Editar">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button v-if="isAdmin || isBibliotecario" @click="confirmarEliminarEjemplar(ej)"
                  class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Eliminar">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          
          </div>
        </div>

        <!-- Sin ejemplares filtrados -->
        <div v-if="!ejemplaresFiltrados.length"
          class="text-center py-6 border border-dashed border-slate-200 rounded-xl">
          <p class="text-sm text-slate-400">No hay ejemplares para mostrar</p>
        </div>


      </div>
    </template>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        Cerrar
      </button>

      <!-- Guardar info (solo tab info) -->
      <button v-if="tabActiva === 'info'" @click="guardarInfo" :disabled="guardandoInfo"
        class="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
        <svg v-if="guardandoInfo" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Guardar información
      </button>
    </template>

    <!-- ════════════════════════════════════════════════════════════════════
         PDF VIEWER — Teleport al body
    ════════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="mostrarPdfViewer" class="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm">

        <!-- Toolbar PDF -->
        <div class="flex items-center justify-between px-5 py-3 bg-black/60 border-b border-white/10 flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-white">{{ libroRaw?.titulo ?? 'Documento PDF' }}</p>
              <p class="text-xs text-white/50">Vista previa del documento</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Descargar / abrir en nueva pestaña -->
            <a :href="pdfViewerUrl" target="_blank" rel="noopener noreferrer"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Abrir en nueva pestaña
            </a>

            <!-- Cerrar -->
            <button @click="cerrarPdf"
              class="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- iframe PDF -->
        <div class="flex-1 overflow-hidden">
          <iframe :src="pdfViewerUrl + '#toolbar=1&navpanes=0'" class="w-full h-full border-0"
            title="Vista previa PDF" />
        </div>
      </div>
    </Teleport>

    <!-- Sub-modales fuera del BaseModal principal -->
    <EdicionFormModal v-if="subModal === 'edicion-form'" :edicion="edicionEditando" :libro-id="props.libroId"
      @close="cerrar" @saved="onEdicionGuardada" />

    <EjemplarFormModal v-if="subModal === 'ejemplar-form'" :ejemplar="ejemplarEditando" :ediciones="ediciones"
      :edicion-id-inicial="edicionIdParaEjemplar ?? undefined" @close="cerrar" @saved="onEjemplarGuardado" />

    <EjemplarEstadoModal v-if="subModal === 'estado' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
      @close="cerrar" @saved="onEjemplarGuardado" />

    <EjemplarHistorialModal v-if="subModal === 'historial' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
      @close="cerrar" />
    <ConfirmModal
      v-model="mostrarModalEliminarEdicion"
      :loading="eliminandoEdicion"
      title="¿Eliminar edición?"
      :message="`¿Eliminar la edición ISBN ${edicionAEliminar?.isbn}? Solo es posible si no tiene ejemplares.`"
      @confirm="eliminarEdicionConfirmada"
    />
    <ConfirmModal
      v-model="mostrarModalEliminarEjemplar"
      :loading="eliminandoEjemplar"
      title="¿Eliminar ejemplar?"
      :message="`
        ¿Eliminar el ejemplar ${
          ejemplarAEliminar?.codigoEjemplar ||
          ejemplarAEliminar?.codigoTopografico ||
          ejemplarAEliminar?.codigoTopograficoConcat ||
          '#' + ejemplarAEliminar?.idEjemplar ||
          'seleccionado'
        }?
        Solo es posible si no tiene préstamos ni reservas.
      `"
      @confirm="eliminarEjemplarConfirmada"
    />
  </BaseModal>
</template>