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
import api from '@/services/axios'
import { obtenerCategorias } from '@/services/categorias.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { crearEdicion, actualizarEdicion } from '@/services/ediciones.service'
import { crearEjemplar, actualizarEjemplar } from '@/services/ejemplares.service'
import { useMedia } from '@/composables/useMedia'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Categoria, Edicion, Ejemplar } from '@/types/catalogo'

// ── Props / emits ─────────────────────────────────────────────────────────
const props = defineProps<{ libroId: number }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
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

    // Ejemplares: aplanar de todas las ediciones
    const ejsPlanos: Ejemplar[] = []
    for (const ed of (data.ediciones ?? [])) {
      if (ed.ejemplares?.length) ejsPlanos.push(...ed.ejemplares)
    }
    // Si no vienen en el libro, cargar por separado
    if (!ejsPlanos.length) await cargarEjemplares()
    else ejemplares.value = ejsPlanos

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

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 — EDICIONES
// ══════════════════════════════════════════════════════════════════════════
const edicionEditandoId = ref<number | null>(null)
const edicionEditando = ref<any>(null)
const portadaFileEdicion = ref<File | null>(null)
const portadaPreviewEdicion = ref('')
const guardandoEdicion = ref(false)
const errorEdicion = ref('')

// Visor PDF
const pdfViewerUrl = ref('')
const mostrarPdfViewer = ref(false)

function abrirPdf(urlOPath: string) {
  const url = urlOPath.startsWith('http') ? urlOPath : getUrl(urlOPath)
  pdfViewerUrl.value = url
  mostrarPdfViewer.value = true
}

function cerrarPdf() { mostrarPdfViewer.value = false; pdfViewerUrl.value = '' }

function iniciarEdicionEdicion(ed: Edicion) {
  edicionEditandoId.value = ed.idEdicion
  edicionEditando.value = {
    isbn: ed.isbn ?? '',
    editorial: ed.editorial ?? '',
    anoPublicacion: ed.anoPublicacion ?? new Date().getFullYear(),
    edicion: ed.edicion ?? '',
    numeroPaginas: ed.numeroPaginas ?? null,
  }
  portadaFileEdicion.value = null
  portadaPreviewEdicion.value = ''
  errorEdicion.value = ''
}

function cancelarEdicionEdicion() {
  edicionEditandoId.value = null
  edicionEditando.value = null
}

function onPortadaEdicionChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  portadaFileEdicion.value = file
  const r = new FileReader()
  r.onload = (e) => { portadaPreviewEdicion.value = e.target?.result as string }
  r.readAsDataURL(file)
}

async function guardarEdicion() {
  if (!edicionEditandoId.value || !edicionEditando.value) return
  if (!edicionEditando.value.isbn.trim()) { errorEdicion.value = 'ISBN requerido'; return }
  if (!edicionEditando.value.editorial.trim()) { errorEdicion.value = 'Editorial requerida'; return }
  guardandoEdicion.value = true
  errorEdicion.value = ''
  try {
    await actualizarEdicion(
      edicionEditandoId.value,
      {
        isbn: edicionEditando.value.isbn.trim(),
        editorial: edicionEditando.value.editorial.trim(),
        anoPublicacion: edicionEditando.value.anoPublicacion,
        edicion: edicionEditando.value.edicion.trim() || undefined,
        numeroPaginas: edicionEditando.value.numeroPaginas || undefined,
        libroId: props.libroId,
      },
      portadaFileEdicion.value ?? null,
    )
    await cargarLibro()
    cancelarEdicionEdicion()
  } catch (e: unknown) {
    const err = e as any
    errorEdicion.value = err?.response?.data?.message ?? 'Error al guardar edición'
  } finally {
    guardandoEdicion.value = false
  }
}

// Nueva edición
const mostrarNuevaEdicion = ref(false)
const nuevaEdicion = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '',
  numeroPaginas: null as number | null,
})
const erroresNuevaEd = reactive<Record<string, string>>({})
const portadaNuevaFile = ref<File | null>(null)
const portadaNuevaPreview = ref('')
const pdfNuevoFile = ref<File | null>(null)
const pdfNuevoNombre = ref('')
const creandoEdicion = ref(false)

function onPortadaNuevaChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  portadaNuevaFile.value = file
  const r = new FileReader()
  r.onload = (e) => { portadaNuevaPreview.value = e.target?.result as string }
  r.readAsDataURL(file)
}

function onPdfNuevoChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  pdfNuevoFile.value = file
  pdfNuevoNombre.value = file.name
}

async function guardarNuevaEdicion() {
  Object.keys(erroresNuevaEd).forEach(k => delete erroresNuevaEd[k])
  if (!nuevaEdicion.isbn.trim()) { erroresNuevaEd.isbn = 'ISBN requerido'; return }
  if (!nuevaEdicion.editorial.trim()) { erroresNuevaEd.editorial = 'Editorial requerida'; return }
  creandoEdicion.value = true
  try {
    await crearEdicion(
      {
        isbn: nuevaEdicion.isbn.trim(),
        editorial: nuevaEdicion.editorial.trim(),
        anoPublicacion: nuevaEdicion.anoPublicacion,
        edicion: nuevaEdicion.edicion.trim() || undefined,
        numeroPaginas: nuevaEdicion.numeroPaginas || undefined,
        libroId: props.libroId,
      },
      portadaNuevaFile.value ?? null,
    )
    await cargarLibro()
    mostrarNuevaEdicion.value = false
    nuevaEdicion.isbn = ''
    nuevaEdicion.editorial = ''
    nuevaEdicion.edicion = ''
    nuevaEdicion.numeroPaginas = null
    portadaNuevaFile.value = null
    portadaNuevaPreview.value = ''
    pdfNuevoFile.value = null
    pdfNuevoNombre.value = ''
  } catch (e: unknown) {
    const err = e as any
    erroresNuevaEd.general = err?.response?.data?.message ?? 'Error al crear edición'
  } finally {
    creandoEdicion.value = false
  }
}

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

// Formulario nuevo ejemplar inline
const mostrarNuevoEjemplar = ref(false)
const nuevoEjemplar = reactive({
  edicionId: null as number | null,
  bibliotecaId: null as number | null,
  codigoEjemplar: '',
  codigoTopografico: '',
  ubicacionFisica: '',
  estadoEjemplar: 'DISPONIBLE',
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precioCompra: null as number | null,
  observaciones: '',
})
const erroresNuevoEj = reactive<Record<string, string>>({})
const creandoEjemplar = ref(false)
const errorNuevoEj = ref('')

const bibliotecaPropia = computed(() => {
  const lista = auth.user?.biblioteca
  if (!lista?.length) return null
  const bib = lista[0]
  const id = bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id
  const nombre = bib.nombre ?? bib.name
  return id && nombre ? { id, nombre } : null
})

watch(mostrarNuevoEjemplar, (v) => {
  if (v) {
    nuevoEjemplar.edicionId = ediciones.value[0]?.idEdicion ?? null
    nuevoEjemplar.bibliotecaId = bibliotecaPropia.value?.id ?? bibliotecas.value[0]?.id ?? null
  }
})

async function guardarNuevoEjemplar() {
  Object.keys(erroresNuevoEj).forEach(k => delete erroresNuevoEj[k])
  if (!nuevoEjemplar.codigoEjemplar.trim()) erroresNuevoEj.codigoEjemplar = 'Código requerido'
  if (!nuevoEjemplar.edicionId) erroresNuevoEj.edicionId = 'Selecciona una edición'
  if (!nuevoEjemplar.bibliotecaId) erroresNuevoEj.bibliotecaId = 'Selecciona una biblioteca'
  if (Object.keys(erroresNuevoEj).length) return
  creandoEjemplar.value = true
  errorNuevoEj.value = ''
  try {
    await crearEjemplar({
      codigoEjemplar: nuevoEjemplar.codigoEjemplar.trim(),
      codigoTopografico: nuevoEjemplar.codigoTopografico.trim() || undefined,
      ubicacionFisica: nuevoEjemplar.ubicacionFisica.trim() || undefined,
      edicionId: nuevoEjemplar.edicionId!,
      bibliotecaId: nuevoEjemplar.bibliotecaId!,
      estadoEjemplar: nuevoEjemplar.estadoEjemplar as any,
      fechaAdquisicion: nuevoEjemplar.fechaAdquisicion || undefined,
      precioCompra: nuevoEjemplar.precioCompra,
      observaciones: nuevoEjemplar.observaciones.trim() || undefined,
    })
    await cargarEjemplares()
    mostrarNuevoEjemplar.value = false
    nuevoEjemplar.codigoEjemplar = ''
    nuevoEjemplar.codigoTopografico = ''
    nuevoEjemplar.ubicacionFisica = ''
    nuevoEjemplar.observaciones = ''
    nuevoEjemplar.precioCompra = null
    emit('saved')
  } catch (e: unknown) {
    const err = e as any
    errorNuevoEj.value = err?.response?.data?.message ?? 'Error al crear ejemplar'
  } finally {
    creandoEjemplar.value = false
  }
}

// Edición inline de ejemplar (solo campos básicos)
const ejemplarEditandoId = ref<number | null>(null)
const ejemplarEditando = ref<any>(null)
const guardandoEjemplar = ref(false)
const errorEjemplar = ref('')

function iniciarEdicionEjemplar(ej: Ejemplar) {
  ejemplarEditandoId.value = ej.idEjemplar
  ejemplarEditando.value = {
    codigoEjemplar: ej.codigoEjemplar ?? '',
    codigoTopografico: ej.codigoTopografico ?? '',
    ubicacionFisica: ej.ubicacionFisica ?? '',
    precioCompra: ej.precioCompra ?? null,
    observaciones: ej.observaciones ?? '',
    edicionId: ej.edicion?.idEdicion ?? null,
    bibliotecaId: ej.biblioteca?.idBiblioteca ?? null,
  }
  errorEjemplar.value = ''
}

function cancelarEdicionEjemplar() {
  ejemplarEditandoId.value = null
  ejemplarEditando.value = null
}

async function guardarEjemplar() {
  if (!ejemplarEditandoId.value || !ejemplarEditando.value) return
  guardandoEjemplar.value = true
  errorEjemplar.value = ''
  try {
    await actualizarEjemplar(ejemplarEditandoId.value, {
      codigoEjemplar: ejemplarEditando.value.codigoEjemplar,
      codigoTopografico: ejemplarEditando.value.codigoTopografico || undefined,
      ubicacionFisica: ejemplarEditando.value.ubicacionFisica || undefined,
      edicionId: ejemplarEditando.value.edicionId,
      bibliotecaId: ejemplarEditando.value.bibliotecaId,
      precioCompra: ejemplarEditando.value.precioCompra,
      observaciones: ejemplarEditando.value.observaciones || undefined,
    })
    await cargarEjemplares()
    cancelarEdicionEjemplar()
    emit('saved')
  } catch (e: unknown) {
    const err = e as any
    errorEjemplar.value = err?.response?.data?.message ?? 'Error al guardar'
  } finally {
    guardandoEjemplar.value = false
  }
}

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
              @blur="setTimeout(() => { mostrarDropdownAutor = false }, 200)"
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

        <!-- Lista de ediciones -->
        <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
          <div v-for="ed in ediciones" :key="ed.idEdicion"
            class="rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-200 transition-colors">

            <!-- Header edición -->
            <div class="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <!-- Portada mini -->
              <div class="flex-shrink-0">
                <img v-if="ed.imagenPortada" :src="getUrl(ed.imagenPortada)" alt="Portada"
                  class="w-9 h-12 object-cover rounded-lg border border-slate-200 shadow-sm" />
                <div v-else
                  class="w-9 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                  <svg class="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
                  </svg>
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-sm font-mono font-semibold text-slate-900">{{ ed.isbn }}</p>
                <p class="text-xs text-slate-500 truncate">
                  {{ ed.editorial }}
                  <template v-if="ed.anoPublicacion"> · {{ ed.anoPublicacion }}</template>
                  <template v-if="ed.edicion"> · {{ ed.edicion }}</template>
                </p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs text-emerald-600 font-medium">
                    {{ ed.ejemplaresDisponibles ?? 0 }} disp.
                  </span>
                  <span class="text-slate-300 text-xs">/</span>
                  <span class="text-xs text-slate-400">{{ ed.ejemplaresTotal ?? 0 }} total</span>
                </div>
              </div>

              <!-- Acciones: PDF + Editar -->
              <div class="flex items-center gap-1 flex-shrink-0">

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

                <!-- Editar edición -->
                <button
                  @click="edicionEditandoId === ed.idEdicion ? cancelarEdicionEdicion() : iniciarEdicionEdicion(ed)"
                  :class="[
                    'p-1.5 rounded-lg transition-colors',
                    edicionEditandoId === ed.idEdicion
                      ? 'text-indigo-600 bg-indigo-100'
                      : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                  ]" title="Editar edición">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Formulario inline de edición -->
            <div v-if="edicionEditandoId === ed.idEdicion && edicionEditando"
              class="px-4 py-4 space-y-3 bg-indigo-50/40">

              <div class="flex gap-4">
                <!-- Cambiar portada -->
                <label
                  class="relative flex-shrink-0 w-16 h-22 rounded-xl overflow-hidden border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white cursor-pointer group">
                  <img v-if="portadaPreviewEdicion || ed.imagenPortada"
                    :src="portadaPreviewEdicion || getUrl(ed.imagenPortada!)" alt="Portada"
                    class="w-full h-full object-cover absolute inset-0" />
                  <div v-else class="absolute inset-0 flex items-center justify-center">
                    <svg class="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
                    </svg>
                  </div>
                  <div
                    class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <svg class="w-4 h-4 text-white opacity-0 group-hover:opacity-100 drop-shadow" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <input type="file" accept="image/*" class="sr-only" @change="onPortadaEdicionChange" />
                </label>

                <div class="flex-1 grid grid-cols-2 gap-2.5">
                  <div class="col-span-2">
                    <label class="block text-xs text-slate-600 mb-1">ISBN</label>
                    <input v-model="edicionEditando.isbn" type="text"
                      class="w-full text-xs rounded-lg border px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      :class="errorEdicion && !edicionEditando.isbn ? 'border-red-400' : 'border-slate-200'" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Editorial</label>
                    <input v-model="edicionEditando.editorial" type="text"
                      class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Año</label>
                    <input v-model.number="edicionEditando.anoPublicacion" type="number"
                      class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Edición</label>
                    <input v-model="edicionEditando.edicion" type="text" placeholder="1ra"
                      class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-600 mb-1">Páginas</label>
                    <input v-model.number="edicionEditando.numeroPaginas" type="number"
                      class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              </div>

              <p v-if="errorEdicion" class="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorEdicion }}</p>

              <div class="flex items-center justify-end gap-2">
                <button @click="cancelarEdicionEdicion"
                  class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button @click="guardarEdicion" :disabled="guardandoEdicion"
                  class="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5">
                  <svg v-if="guardandoEdicion" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardar edición
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sin ediciones -->
        <div v-if="!ediciones.length" class="text-center py-8 border border-dashed border-slate-200 rounded-xl">
          <p class="text-sm text-slate-400">Este libro no tiene ediciones registradas</p>
        </div>

        <!-- Botón agregar nueva edición -->
        <button @click="mostrarNuevaEdicion = !mostrarNuevaEdicion"
          class="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors font-medium">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ mostrarNuevaEdicion ? 'Cancelar nueva edición' : 'Agregar nueva edición' }}
        </button>

        <!-- Formulario nueva edición -->
        <div v-if="mostrarNuevaEdicion" class="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
          <p class="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Nueva edición</p>

          <div class="flex gap-4">
            <!-- Portada -->
            <label
              class="relative flex-shrink-0 w-16 h-22 rounded-xl overflow-hidden border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white cursor-pointer">
              <img v-if="portadaNuevaPreview" :src="portadaNuevaPreview" alt="" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
                </svg>
              </div>
              <input type="file" accept="image/*" class="sr-only" @change="onPortadaNuevaChange" />
            </label>

            <div class="flex-1 grid grid-cols-2 gap-2.5">
              <div class="col-span-2">
                <label class="block text-xs text-slate-600 mb-1">ISBN *</label>
                <input v-model="nuevaEdicion.isbn" type="text" placeholder="978-..."
                  class="w-full text-xs rounded-lg border px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  :class="erroresNuevaEd.isbn ? 'border-red-400' : 'border-slate-200'" />
                <p v-if="erroresNuevaEd.isbn" class="text-xs text-red-500 mt-0.5">{{ erroresNuevaEd.isbn }}</p>
              </div>
              <div class="col-span-2">
                <label class="block text-xs text-slate-600 mb-1">Editorial *</label>
                <input v-model="nuevaEdicion.editorial" type="text"
                  class="w-full text-xs rounded-lg border px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  :class="erroresNuevaEd.editorial ? 'border-red-400' : 'border-slate-200'" />
              </div>
              <div>
                <label class="block text-xs text-slate-600 mb-1">Año</label>
                <input v-model.number="nuevaEdicion.anoPublicacion" type="number"
                  class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="block text-xs text-slate-600 mb-1">Edición</label>
                <input v-model="nuevaEdicion.edicion" type="text" placeholder="1ra"
                  class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          <!-- PDF nueva edición -->
          <div>
            <label class="block text-xs text-slate-600 mb-1">PDF Digital (opcional)</label>
            <div v-if="!pdfNuevoNombre" @click="($refs.pdfNuevoInput as HTMLInputElement)?.click()"
              class="flex items-center gap-2 p-2.5 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 hover:bg-white transition-colors">
              <svg class="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span class="text-xs text-slate-400">Clic para subir PDF</span>
              <input ref="pdfNuevoInput" type="file" accept=".pdf" class="sr-only" @change="onPdfNuevoChange" />
            </div>
            <div v-else class="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-xs text-emerald-700 truncate flex-1">{{ pdfNuevoNombre }}</span>
              <button @click="pdfNuevoFile = null; pdfNuevoNombre = ''"
                class="text-emerald-400 hover:text-red-500 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <p v-if="erroresNuevaEd.general" class="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
            {{ erroresNuevaEd.general }}
          </p>

          <div class="flex items-center justify-end gap-2">
            <button @click="mostrarNuevaEdicion = false"
              class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button @click="guardarNuevaEdicion" :disabled="creandoEdicion"
              class="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5">
              <svg v-if="creandoEdicion" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Crear edición
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════
           TAB 3 — EJEMPLARES
      ══════════════════════════════════════════════════════════════════ -->
      <div v-else-if="tabActiva === 'ejemplares'" class="space-y-4">

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
              <button
                @click="ejemplarEditandoId === ej.idEjemplar ? cancelarEdicionEjemplar() : iniciarEdicionEjemplar(ej)"
                :class="[
                  'p-1.5 rounded-lg transition-colors flex-shrink-0',
                  ejemplarEditandoId === ej.idEjemplar
                    ? 'text-indigo-600 bg-indigo-100'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                ]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>

            <!-- Form inline edición ejemplar -->
            <div v-if="ejemplarEditandoId === ej.idEjemplar && ejemplarEditando"
              class="px-4 pb-4 pt-2 border-t border-slate-100 bg-indigo-50/30 space-y-2.5">

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-xs text-slate-600 mb-1">Código ejemplar</label>
                  <input v-model="ejemplarEditando.codigoEjemplar" type="text"
                    class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label class="block text-xs text-slate-600 mb-1">Código topográfico</label>
                  <input v-model="ejemplarEditando.codigoTopografico" type="text"
                    class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div class="col-span-2">
                  <label class="block text-xs text-slate-600 mb-1">Ubicación física</label>
                  <input v-model="ejemplarEditando.ubicacionFisica" type="text"
                    class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label class="block text-xs text-slate-600 mb-1">Biblioteca</label>
                  <select v-model="ejemplarEditando.bibliotecaId"
                    class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-slate-600 mb-1">Precio (Bs.)</label>
                  <input v-model.number="ejemplarEditando.precioCompra" type="number" step="0.01"
                    class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div class="col-span-2">
                  <label class="block text-xs text-slate-600 mb-1">Observaciones</label>
                  <input v-model="ejemplarEditando.observaciones" type="text"
                    class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <p v-if="errorEjemplar" class="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorEjemplar }}
              </p>

              <div class="flex items-center justify-end gap-2">
                <button @click="cancelarEdicionEjemplar"
                  class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button @click="guardarEjemplar" :disabled="guardandoEjemplar"
                  class="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5">
                  <svg v-if="guardandoEjemplar" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardar
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

        <!-- Botón agregar nuevo ejemplar -->
        <button @click="mostrarNuevoEjemplar = !mostrarNuevoEjemplar"
          class="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors font-medium">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ mostrarNuevoEjemplar ? 'Cancelar' : 'Agregar ejemplar' }}
        </button>

        <!-- Formulario nuevo ejemplar -->
        <div v-if="mostrarNuevoEjemplar" class="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3">
          <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Nuevo ejemplar</p>

          <div class="grid grid-cols-2 gap-2.5">
            <!-- Edición -->
            <div class="col-span-2">
              <label class="block text-xs text-slate-600 mb-1">Edición *</label>
              <select v-model="nuevoEjemplar.edicionId"
                class="w-full text-xs rounded-lg border px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :class="erroresNuevoEj.edicionId ? 'border-red-400' : 'border-slate-200'">
                <option :value="null" disabled>Seleccionar edición</option>
                <option v-for="ed in ediciones" :key="ed.idEdicion" :value="ed.idEdicion">
                  {{ ed.isbn }} · {{ ed.editorial }} ({{ ed.anoPublicacion }})
                </option>
              </select>
              <p v-if="erroresNuevoEj.edicionId" class="text-xs text-red-500 mt-0.5">{{ erroresNuevoEj.edicionId }}</p>
            </div>

            <div>
              <label class="block text-xs text-slate-600 mb-1">Código ejemplar *</label>
              <input v-model="nuevoEjemplar.codigoEjemplar" type="text" placeholder="EJ-2024-010"
                class="w-full text-xs rounded-lg border px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :class="erroresNuevoEj.codigoEjemplar ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="erroresNuevoEj.codigoEjemplar" class="text-xs text-red-500 mt-0.5">{{
                erroresNuevoEj.codigoEjemplar }}
              </p>
            </div>
            <div>
              <label class="block text-xs text-slate-600 mb-1">Código topográfico</label>
              <input v-model="nuevoEjemplar.codigoTopografico" type="text" placeholder="004.1 C676"
                class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div class="col-span-2">
              <label class="block text-xs text-slate-600 mb-1">Biblioteca *</label>
              <div v-if="!isAdmin && bibliotecaPropia"
                class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                <svg class="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
                <span class="text-xs font-medium text-indigo-700">{{ bibliotecaPropia.nombre }}</span>
              </div>
              <select v-else v-model="nuevoEjemplar.bibliotecaId"
                class="w-full text-xs rounded-lg border px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                :class="erroresNuevoEj.bibliotecaId ? 'border-red-400' : 'border-slate-200'">
                <option :value="null" disabled>Seleccionar biblioteca</option>
                <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
              </select>
              <p v-if="erroresNuevoEj.bibliotecaId" class="text-xs text-red-500 mt-0.5">{{ erroresNuevoEj.bibliotecaId
                }}</p>
            </div>

            <div>
              <label class="block text-xs text-slate-600 mb-1">Ubicación física</label>
              <input v-model="nuevoEjemplar.ubicacionFisica" type="text" placeholder="Estante A-1"
                class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-600 mb-1">Estado inicial</label>
              <select v-model="nuevoEjemplar.estadoEjemplar"
                class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="DISPONIBLE">🟢 Disponible</option>
                <option value="EN_REPARACION">🟡 En reparación</option>
                <option value="DAÑADO">🟠 Dañado</option>
              </select>
            </div>

            <div>
              <label class="block text-xs text-slate-600 mb-1">Fecha adquisición</label>
              <input v-model="nuevoEjemplar.fechaAdquisicion" type="date"
                class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-600 mb-1">Precio (Bs.)</label>
              <input v-model.number="nuevoEjemplar.precioCompra" type="number" step="0.01" placeholder="85.00"
                class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div class="col-span-2">
              <label class="block text-xs text-slate-600 mb-1">Observaciones</label>
              <input v-model="nuevoEjemplar.observaciones" type="text" placeholder="Donación FHCE 2024..."
                class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <p v-if="errorNuevoEj" class="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorNuevoEj }}</p>

          <div class="flex items-center justify-end gap-2">
            <button @click="mostrarNuevoEjemplar = false"
              class="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button @click="guardarNuevoEjemplar" :disabled="creandoEjemplar"
              class="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5">
              <svg v-if="creandoEjemplar" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Crear ejemplar
            </button>
          </div>
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
  </BaseModal>
</template>