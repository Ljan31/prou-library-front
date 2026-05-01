<script setup lang="ts">
/**
 * NuevoEjemplarView — Registro rápido de ejemplar
 *
 * Ruta sugerida: /inventario/nuevo-ejemplar
 * meta: { roles: ['ROLE_ADMIN', 'ROLE_BIBLIOTECARIO'] }
 *
 * Flujo en una sola página con secciones progresivas:
 *  § 1 — Libro    : buscar existente ó completar datos para crear
 *  § 2 — Edición  : se muestra automáticamente al tener libro.
 *                   Si el libro ya tiene ediciones → elegir ó abrir modal "Nueva edición"
 *                   Si es libro nuevo             → formulario inline (datos mínimos)
 *  § 3 — Ejemplar : datos físicos. Se habilita al tener edición confirmada.
 *
 * Reutiliza EdicionFormModal del catálogo para crear/editar ediciones de libros ya existentes.
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import SButton from '@/components/ui/SButton.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import EdicionFormModal from '@/components/catalogo/EdicionFormModal.vue'

import api from '@/services/axios'
import { crearEjemplar } from '@/services/ejemplares.service'
import { obtenerCategorias, crearCategoria } from '@/services/categorias.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import type { Libro, Edicion, Categoria } from '@/types/catalogo'

// ─── Stores / router ──────────────────────────────────────────────────────
const ui = useUiStore()
const auth = useAuthStore()
const router = useRouter()
const { isAdmin, isBibliotecario } = usePermissions()

onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Inventario', to: '/inventario' },
    { label: 'Nuevo ejemplar' },
  ])
  cargarCategorias()
  cargarBibliotecas()
})

// ══════════════════════════════════════════════════════════════════════════
// § 1 — LIBRO
// ══════════════════════════════════════════════════════════════════════════
const modoLibro = ref<'buscar' | 'crear'>('buscar')
const busquedaLibro = ref('')
const buscandoLibros = ref(false)
const resultadosLibros = ref<Libro[]>([])
const libroConfirmado = ref<Libro | null>(null)   // libro ya elegido/creado
let timerBusqueda: ReturnType<typeof setTimeout>

watch(busquedaLibro, (q) => {
  libroConfirmado.value = null
  edicionConfirmada.value = null
  clearTimeout(timerBusqueda)
  if (!q.trim()) { resultadosLibros.value = []; return }
  timerBusqueda = setTimeout(() => buscarLibros(q), 350)
})

async function buscarLibros(q: string) {
  buscandoLibros.value = true
  try {
    const res = await api.get('/libros/search', { params: { q } })
    const data = res.data.data
    resultadosLibros.value = Array.isArray(data) ? data : (data?.content ?? [])
  } catch {
    resultadosLibros.value = []
  } finally {
    buscandoLibros.value = false
  }
}

function elegirLibro(libro: Libro) {
  libroConfirmado.value = libro
  busquedaLibro.value = libro.titulo
  resultadosLibros.value = []
  edicionConfirmada.value = null
  cargarEdicionesLibro(libro.idLibro)
}

function limpiarLibro() {
  libroConfirmado.value = null
  busquedaLibro.value = ''
  resultadosLibros.value = []
  edicionConfirmada.value = null
  edicionesLibro.value = []
  modoLibro.value = 'buscar'
}

// ── Crear libro nuevo inline ──────────────────────────────────────────────
const categorias = ref<Categoria[]>([])
const cargandoCategorias = ref(false)
const modoCategoria = ref<'elegir' | 'nueva'>('elegir')

const nuevoLibro = reactive({
  titulo: '',
  idioma: 'es',
  categoriaId: null as number | null,
  descripcion: '',
})
const nuevaCategoria = reactive({ nombreCategoria: '', descripcion: '', codigoDewey: '' })
const erroresLibro = reactive<Record<string, string>>({})
const creandoLibro = ref(false)

const idiomasOpciones = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
  { value: 'fr', label: 'Francés' },
  { value: 'de', label: 'Alemán' },
]

async function cargarCategorias() {
  cargandoCategorias.value = true
  try { categorias.value = await obtenerCategorias() }
  finally { cargandoCategorias.value = false }
}

async function crearNuevaCategoria() {
  if (!nuevaCategoria.nombreCategoria.trim()) return
  try {
    const cat = await crearCategoria({
      nombre_categoria: nuevaCategoria.nombreCategoria,
      descripcion: nuevaCategoria.descripcion || undefined,
      codigo_dewey: nuevaCategoria.codigoDewey || undefined,
    } as any)
    categorias.value.push(cat)
    nuevoLibro.categoriaId = cat.idCategoria ?? cat.id_categoria
    modoCategoria.value = 'elegir'
    Object.assign(nuevaCategoria, { nombreCategoria: '', descripcion: '', codigoDewey: '' })
  } catch { /* silencioso */ }
}

async function crearLibroYContinuar() {
  Object.keys(erroresLibro).forEach(k => delete erroresLibro[k])
  if (!nuevoLibro.titulo.trim()) erroresLibro.titulo = 'El título es requerido'
  if (!nuevoLibro.categoriaId) erroresLibro.categoriaId = 'La categoría es requerida'
  if (Object.keys(erroresLibro).length) return

  creandoLibro.value = true
  try {
    const res = await api.post('/libros', {
      titulo: nuevoLibro.titulo.trim(),
      idioma: nuevoLibro.idioma,
      categoriaId: nuevoLibro.categoriaId,
      descripcion: nuevoLibro.descripcion.trim() || undefined,
    })
    const libro: Libro = res.data?.data ?? res.data
    libroConfirmado.value = libro
    edicionesLibro.value = []   // libro nuevo, sin ediciones
    modoLibro.value = 'buscar'  // resetear modo visual
    ui.toast.success('Libro creado', `"${libro.titulo}" registrado correctamente`)
  } catch (e: unknown) {
    erroresLibro.general = e instanceof Error ? e.message : 'Error al crear el libro'
  } finally {
    creandoLibro.value = false
  }
}

// ══════════════════════════════════════════════════════════════════════════
// § 2 — EDICIÓN
// ══════════════════════════════════════════════════════════════════════════
const edicionesLibro = ref<Edicion[]>([])
const cargandoEdiciones = ref(false)
const edicionConfirmada = ref<Edicion | null>(null)

// Modal EdicionFormModal (reutilizado del catálogo)
const mostrarModalEdicion = ref(false)
const edicionParaEditar = ref<Edicion | null>(null)

// Formulario inline para edición nueva (libro recién creado, sin ediciones)
const nuevaEdicion = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '1ra',
  numeroPaginas: null as number | null,
})
const erroresEdicion = reactive<Record<string, string>>({})
const creandoEdicion = ref(false)

// Portada (modo inline — igual que EdicionFormModal)
type ModoPortada = 'archivo' | 'url'
const modoPortada = ref<ModoPortada>('archivo')
const portadaFile = ref<File | null>(null)
const portadaPreview = ref('')
const portadaUrlInput = ref('')
const previewVisible = computed(() => portadaPreview.value || portadaUrlInput.value)

function onArchivoChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  portadaFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => { portadaPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
  portadaUrlInput.value = ''
}
function limpiarPortada() {
  portadaFile.value = null; portadaPreview.value = ''; portadaUrlInput.value = ''
}

async function cargarEdicionesLibro(libroId: number) {
  cargandoEdiciones.value = true
  try {
    const res = await api.get(`/ediciones/libro/${libroId}`)
    edicionesLibro.value = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
    // Si solo hay una edición, la pre-seleccionamos automáticamente
    if (edicionesLibro.value.length === 1) {
      elegirEdicion(edicionesLibro.value[0])
    }
  } catch {
    edicionesLibro.value = []
  } finally {
    cargandoEdiciones.value = false
  }
}

function elegirEdicion(ed: Edicion) {
  edicionConfirmada.value = ed
  formEjemplar.edicionId = ed.idEdicion
}

function abrirModalNuevaEdicion() {
  edicionParaEditar.value = null
  mostrarModalEdicion.value = true
}

async function onEdicionGuardada() {
  mostrarModalEdicion.value = false
  if (libroConfirmado.value) {
    await cargarEdicionesLibro(libroConfirmado.value.idLibro)
  }
}

async function crearEdicionInline() {
  Object.keys(erroresEdicion).forEach(k => delete erroresEdicion[k])
  if (!nuevaEdicion.isbn.trim()) erroresEdicion.isbn = 'El ISBN es requerido'
  if (!nuevaEdicion.editorial.trim()) erroresEdicion.editorial = 'La editorial es requerida'
  const anioActual = new Date().getFullYear()
  if (!nuevaEdicion.anoPublicacion || nuevaEdicion.anoPublicacion < 1000 || nuevaEdicion.anoPublicacion > anioActual + 1)
    erroresEdicion.anoPublicacion = 'Año inválido'
  if (!libroConfirmado.value) { erroresEdicion.general = 'No hay libro seleccionado'; return }
  if (Object.keys(erroresEdicion).length) return

  creandoEdicion.value = true
  try {
    // Construir FormData si hay archivo de portada
    let res
    if (portadaFile.value) {
      const fd = new FormData()
      fd.append('isbn', nuevaEdicion.isbn.trim())
      fd.append('editorial', nuevaEdicion.editorial.trim())
      fd.append('anoPublicacion', String(nuevaEdicion.anoPublicacion))
      if (nuevaEdicion.edicion) fd.append('edicion', nuevaEdicion.edicion)
      if (nuevaEdicion.numeroPaginas) fd.append('numeroPaginas', String(nuevaEdicion.numeroPaginas))
      fd.append('libroId', String(libroConfirmado.value.idLibro))
      fd.append('portada', portadaFile.value)
      res = await api.post('/ediciones', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    } else {
      res = await api.post('/ediciones', {
        isbn: nuevaEdicion.isbn.trim(),
        editorial: nuevaEdicion.editorial.trim(),
        anoPublicacion: nuevaEdicion.anoPublicacion,
        edicion: nuevaEdicion.edicion.trim() || undefined,
        numeroPaginas: nuevaEdicion.numeroPaginas || undefined,
        imagenPortada: modoPortada.value === 'url' && portadaUrlInput.value.trim()
          ? portadaUrlInput.value.trim() : undefined,
        libroId: libroConfirmado.value.idLibro,
      })
    }
    const ed: Edicion = res.data?.data ?? res.data
    edicionesLibro.value = [ed]
    elegirEdicion(ed)
    ui.toast.success('Edición creada', `ISBN ${ed.isbn}`)
  } catch (e: unknown) {
    let msg = 'Error al crear la edición'
    if (typeof e === 'object' && e !== null && 'response' in e)
      msg = (e as any).response?.data?.message || msg
    else if (e instanceof Error) msg = e.message
    erroresEdicion.general = msg
  } finally {
    creandoEdicion.value = false
  }
}

// ══════════════════════════════════════════════════════════════════════════
// § 3 — EJEMPLAR
// ══════════════════════════════════════════════════════════════════════════
interface BibliotecaOpcion { id: number; nombre: string }
const bibliotecas = ref<BibliotecaOpcion[]>([])
const cargandoBibs = ref(false)

const bibliotecaPropia = computed<BibliotecaOpcion[]>(() => {
  if (!auth.user?.biblioteca || auth.user.biblioteca.length === 0) return []
  return auth.user.biblioteca.map((bib: any) => ({
    id: (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number,
    nombre: (bib.nombre ?? bib.name) as string,
  })).filter((b: BibliotecaOpcion) => b.id && b.nombre)
})

async function cargarBibliotecas() {
  if (!isAdmin.value) {
    if (bibliotecaPropia.value.length) {
      bibliotecas.value = bibliotecaPropia.value
      if (!formEjemplar.bibliotecaId) formEjemplar.bibliotecaId = bibliotecaPropia.value[0].id
    }
    return
  }
  cargandoBibs.value = true
  try {
    const res = await bibliotecasService.getAll()
    const raw = res.data as unknown
    const lista = (Array.isArray(raw) ? raw : ((raw as any)?.data ?? [])) as any[]
    bibliotecas.value = lista
      .filter((b: any) => b.estado === 'ACTIVA' || !b.estado)
      .map((b: any) => ({
        id: b.id_biblioteca ?? b.idBiblioteca ?? b.id,
        nombre: b.nombre ?? b.name,
      }))
  } catch {
    bibliotecas.value = []
  } finally {
    cargandoBibs.value = false
  }
}

const opcionesEstado = [
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'EN_REPARACION', label: '🟣 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
]

const formEjemplar = reactive({
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

const erroresEjemplar = reactive<Record<string, string>>({})
const guardandoEjemplar = ref(false)
const errorGuardar = ref('')

// Pre-selección de biblioteca del bibliotecario
watch(bibliotecaPropia, (bib) => {
  if (bib.length && !formEjemplar.bibliotecaId) formEjemplar.bibliotecaId = bib[0].id
}, { immediate: true })

// Sincronizar edicionId cuando se confirma edición
watch(edicionConfirmada, (ed) => {
  formEjemplar.edicionId = ed?.idEdicion ?? null
})

function validarEjemplar(): boolean {
  Object.keys(erroresEjemplar).forEach(k => delete erroresEjemplar[k])
  if (!formEjemplar.codigoEjemplar.trim()) erroresEjemplar.codigoEjemplar = 'El código es requerido'
  if (!formEjemplar.ubicacionFisica.trim()) erroresEjemplar.ubicacionFisica = 'La ubicación es requerida'
  if (!formEjemplar.edicionId) erroresEjemplar.edicionId = 'Confirma primero la edición del libro'
  if (!formEjemplar.bibliotecaId) erroresEjemplar.bibliotecaId = 'Selecciona una biblioteca'
  return Object.keys(erroresEjemplar).length === 0
}

async function guardarEjemplar() {
  if (!validarEjemplar()) return
  guardandoEjemplar.value = true; errorGuardar.value = ''
  try {
    await crearEjemplar({
      codigoEjemplar: formEjemplar.codigoEjemplar,
      codigoTopografico: formEjemplar.codigoTopografico || undefined,
      ubicacionFisica: formEjemplar.ubicacionFisica || undefined,
      edicionId: formEjemplar.edicionId!,
      bibliotecaId: formEjemplar.bibliotecaId!,
      estadoEjemplar: formEjemplar.estadoEjemplar as any,
      fechaAdquisicion: formEjemplar.fechaAdquisicion || undefined,
      precioCompra: formEjemplar.precioCompra,
      observaciones: formEjemplar.observaciones || undefined,
    })
    ui.toast.success('Ejemplar creado', `Código ${formEjemplar.codigoEjemplar} registrado`)
    router.push('/inventario')
  } catch (e: unknown) {
    let msg = 'Error al crear el ejemplar'
    if (typeof e === 'object' && e !== null && 'response' in e)
      msg = (e as any).response?.data?.message || msg
    else if (e instanceof Error) msg = e.message
    errorGuardar.value = msg
  } finally {
    guardandoEjemplar.value = false
  }
}

// ── Estado visual de secciones ────────────────────────────────────────────
const seccionLibroCompleta = computed(() => !!libroConfirmado.value)
const seccionEdicionCompleta = computed(() => !!edicionConfirmada.value)

// Mostrar formulario inline de edición solo cuando:
// - hay libro confirmado
// - no hay ediciones (libro nuevo) o el usuario quiere crear nueva
const mostrarFormEdicionInline = computed(() =>
  seccionLibroCompleta.value && edicionesLibro.value.length === 0 && !cargandoEdiciones.value
)
</script>

<template>
  <div class="page-container max-w-3xl">

    <!-- ── Page header ───────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Nuevo ejemplar</h1>
        <p class="text-sm text-slate-500 mt-1">
          Registra un libro, su edición y el ejemplar físico en un solo formulario.
        </p>
      </div>
      <SButton variant="ghost" @click="router.replace('/inventario')">
        ← Volver al inventario
      </SButton>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════
         SECCIÓN 1 — LIBRO
    ═════════════════════════════════════════════════════════════════════ -->
    <section class="mb-6">
      <!-- Cabecera de sección -->
      <div class="flex items-center gap-3 mb-4">
        <div :class="[
          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors',
          seccionLibroCompleta ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
        ]">
          <svg v-if="seccionLibroCompleta" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span v-else>1</span>
        </div>
        <h2 class="text-base font-semibold text-slate-800">Libro</h2>
        <div v-if="seccionLibroCompleta" class="flex items-center gap-2 ml-auto">
          <span class="text-sm text-emerald-700 font-medium truncate max-w-xs">{{ libroConfirmado?.titulo }}</span>
          <button @click="limpiarLibro"
            class="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors flex-shrink-0">
            Cambiar
          </button>
        </div>
      </div>

      <!-- Panel del libro -->
      <div v-if="!seccionLibroCompleta" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <!-- Tabs: buscar / crear -->
        <div class="flex border-b border-slate-100">
          <button @click="modoLibro = 'buscar'; busquedaLibro = ''; resultadosLibros = []" :class="[
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            modoLibro === 'buscar' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          ]">
            🔍 Buscar libro existente
          </button>
          <button @click="modoLibro = 'crear'" :class="[
            'flex-1 py-2.5 text-sm font-medium transition-colors',
            modoLibro === 'crear' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          ]">
            ✏️ Crear nuevo libro
          </button>
        </div>

        <div class="p-5">

          <!-- ── Modo buscar ── -->
          <div v-if="modoLibro === 'buscar'">
            <div class="relative">
              <input v-model="busquedaLibro" type="text" placeholder="Escribe el título, autor o ISBN del libro…"
                class="w-full text-sm rounded-xl border border-slate-200 pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              <div v-if="buscandoLibros" class="absolute right-3 top-2.5">
                <svg class="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </div>

            <!-- Resultados -->
            <div v-if="resultadosLibros.length"
              class="mt-2 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <button v-for="libro in resultadosLibros.slice(0, 6)" :key="libro.idLibro" @click="elegirLibro(libro)"
                class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left group">
                <div class="w-8 h-11 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden">
                  <img v-if="libro.ediciones?.[0]?.imagenPortada" :src="libro.ediciones[0].imagenPortada" alt=""
                    class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <svg class="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-700">{{ libro.titulo }}
                  </p>
                  <p class="text-xs text-slate-400 truncate">
                    {{ libro.categoria?.nombre_categoria ?? libro.categoria?.nombreCategoria ?? '—' }}
                    <template v-if="libro.ediciones?.length"> · {{ libro.ediciones.length }} edición(es)</template>
                  </p>
                </div>
                <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-400 flex-shrink-0" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <!-- Sin resultados -->
            <p v-else-if="busquedaLibro.trim() && !buscandoLibros" class="mt-3 text-sm text-slate-400 text-center py-4">
              No se encontraron libros.
              <button @click="modoLibro = 'crear'; nuevoLibro.titulo = busquedaLibro"
                class="text-indigo-600 hover:underline font-medium">
                ¿Crear "{{ busquedaLibro }}"?
              </button>
            </p>
          </div>

          <!-- ── Modo crear libro ── -->
          <div v-else class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Título *</label>
              <input v-model="nuevoLibro.titulo" type="text" placeholder="Título completo del libro"
                class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="erroresLibro.titulo ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="erroresLibro.titulo" class="text-xs text-red-500 mt-1">{{ erroresLibro.titulo }}</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <!-- Categoría -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-medium text-slate-600">Categoría *</label>
                  <button @click="modoCategoria = modoCategoria === 'elegir' ? 'nueva' : 'elegir'"
                    class="text-xs text-indigo-600 hover:underline">
                    {{ modoCategoria === 'elegir' ? '+ Nueva' : '← Lista' }}
                  </button>
                </div>

                <!-- Elegir categoría existente -->
                <div v-if="modoCategoria === 'elegir'">
                  <select v-model="nuevoLibro.categoriaId"
                    class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    :class="erroresLibro.categoriaId ? 'border-red-400' : 'border-slate-200'">
                    <option :value="null" disabled>Seleccionar…</option>
                    <option v-for="c in categorias" :key="c.id_categoria" :value="c.id_categoria">
                      {{ c.nombre_categoria }}
                    </option>
                  </select>
                  <p v-if="erroresLibro.categoriaId" class="text-xs text-red-500 mt-1">{{ erroresLibro.categoriaId }}
                  </p>
                </div>

                <!-- Crear categoría nueva -->
                <div v-else class="space-y-2">
                  <input v-model="nuevaCategoria.nombreCategoria" type="text" placeholder="Nombre de categoría"
                    class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input v-model="nuevaCategoria.codigoDewey" type="text" placeholder="Código Dewey (opcional)"
                    class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button @click="crearNuevaCategoria"
                    class="w-full py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors">
                    Crear categoría
                  </button>
                </div>
              </div>

              <!-- Idioma -->
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Idioma</label>
                <select v-model="nuevoLibro.idioma"
                  class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option v-for="op in idiomasOpciones" :key="op.value" :value="op.value">{{ op.label }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <textarea v-model="nuevoLibro.descripcion" rows="2" placeholder="Breve descripción del libro…"
                class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            <p v-if="erroresLibro.general" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {{ erroresLibro.general }}
            </p>

            <SButton :loading="creandoLibro" @click="crearLibroYContinuar" class="w-full">
              Crear libro y continuar →
            </SButton>
          </div>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════
         SECCIÓN 2 — EDICIÓN
    ═════════════════════════════════════════════════════════════════════ -->
    <section class="mb-6" v-if="seccionLibroCompleta">
      <!-- Cabecera -->
      <div class="flex items-center gap-3 mb-4">
        <div :class="[
          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors',
          seccionEdicionCompleta ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'
        ]">
          <svg v-if="seccionEdicionCompleta" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span v-else>2</span>
        </div>
        <h2 class="text-base font-semibold text-slate-800">Edición</h2>
        <div v-if="seccionEdicionCompleta" class="flex items-center gap-2 ml-auto">
          <span class="text-sm text-emerald-700 font-medium font-mono">{{ edicionConfirmada?.isbn }}</span>
          <span class="text-xs text-slate-400">{{ edicionConfirmada?.editorial }} · {{ edicionConfirmada?.anoPublicacion
          }}</span>
          <button v-if="edicionesLibro.length > 1" @click="edicionConfirmada = null; formEjemplar.edicionId = null"
            class="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors flex-shrink-0">
            Cambiar
          </button>
        </div>
      </div>

      <!-- Loading de ediciones -->
      <div v-if="cargandoEdiciones" class="space-y-2">
        <SSkeleton height="3rem" width="100%" />
        <SSkeleton height="3rem" width="100%" />
      </div>

      <!-- Ediciones existentes del libro (libro con ediciones) -->
      <div v-else-if="edicionesLibro.length > 0 && !seccionEdicionCompleta"
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div class="px-5 pt-4 pb-2">
          <p class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Ediciones disponibles — elige una
          </p>

          <div class="space-y-2">
            <button v-for="ed in edicionesLibro" :key="ed.idEdicion" @click="elegirEdicion(ed)"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left group">
              <div class="w-8 h-11 rounded-md bg-slate-100 flex-shrink-0 overflow-hidden">
                <img v-if="ed.imagenPortada" :src="ed.imagenPortada" alt="" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg class="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-mono font-medium text-slate-800 group-hover:text-indigo-700">{{ ed.isbn }}</p>
                <p class="text-xs text-slate-500 truncate">
                  {{ ed.editorial }}
                  <template v-if="ed.anoPublicacion"> · {{ ed.anoPublicacion }}</template>
                  <template v-if="ed.edicion"> · {{ ed.edicion }}</template>
                  <template v-if="ed.numeroPaginas"> · {{ ed.numeroPaginas }} págs.</template>
                </p>
              </div>
              <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-400 flex-shrink-0" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Botón nueva edición (para libros con ediciones) -->
        <div class="px-5 py-3 border-t border-slate-100">
          <button @click="abrirModalNuevaEdicion"
            class="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:bg-indigo-50 px-2 py-1.5 rounded-lg transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Crear nueva edición
          </button>
        </div>
      </div>

      <!-- Formulario inline de edición (libro nuevo sin ediciones) -->
      <div v-else-if="mostrarFormEdicionInline" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">

        <div class="flex items-start gap-2 p-3 bg-sky-50 border border-sky-200 rounded-xl mb-4">
          <svg class="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-xs text-sky-700">
            Libro recién creado. Ingresa los datos de su primera edición (ISBN, editorial, año).
          </p>
        </div>

        <div class="space-y-4">
          <!-- Portada -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-2">Portada</label>
            <div class="flex rounded-lg border border-slate-200 overflow-hidden text-xs w-fit mb-3">
              <button @click="modoPortada = 'archivo'; limpiarPortada()" :class="['px-3 py-1.5 font-medium transition-colors',
                modoPortada === 'archivo' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
                Subir archivo
              </button>
              <button @click="modoPortada = 'url'; limpiarPortada()" :class="['px-3 py-1.5 font-medium transition-colors',
                modoPortada === 'url' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
                URL externa
              </button>
            </div>

            <div class="flex items-start gap-4">
              <!-- Preview -->
              <div
                class="flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 relative group">
                <img v-if="previewVisible" :src="previewVisible" alt="Portada" class="w-full h-full object-cover"
                  @error="portadaPreview = ''" />
                <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1">
                  <svg class="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="text-xs text-slate-400 text-center leading-tight px-1">Sin portada</span>
                </div>
                <button v-if="previewVisible" @click="limpiarPortada"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="flex-1">
                <div v-if="modoPortada === 'archivo'">
                  <label :class="[
                    'flex flex-col items-center justify-center gap-2 px-4 py-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
                    portadaFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                  ]">
                    <svg class="w-5 h-5" :class="portadaFile ? 'text-emerald-500' : 'text-slate-400'" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span class="text-xs text-center"
                      :class="portadaFile ? 'text-emerald-700 font-medium' : 'text-slate-500'">
                      {{ portadaFile ? portadaFile.name : 'Haz clic o arrastra una imagen' }}
                    </span>
                    <span class="text-xs text-slate-400">JPG, PNG, WEBP</span>
                    <input type="file" accept="image/*" class="sr-only" @change="onArchivoChange" />
                  </label>
                </div>
                <div v-else class="space-y-2">
                  <input v-model="portadaUrlInput" type="url" placeholder="https://cdn.example.com/portada.jpg"
                    class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <p class="text-xs text-slate-400">URL pública accesible (JPG, PNG, WEBP).</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Campos de edición -->
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="block text-xs font-medium text-slate-600 mb-1">ISBN *</label>
              <input v-model="nuevaEdicion.isbn" type="text" placeholder="978-0-262-03384-8"
                class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="erroresEdicion.isbn ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="erroresEdicion.isbn" class="text-xs text-red-500 mt-1">{{ erroresEdicion.isbn }}</p>
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-slate-600 mb-1">Editorial *</label>
              <input v-model="nuevaEdicion.editorial" type="text" placeholder="MIT Press"
                class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="erroresEdicion.editorial ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="erroresEdicion.editorial" class="text-xs text-red-500 mt-1">{{ erroresEdicion.editorial }}</p>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Año *</label>
              <input v-model.number="nuevaEdicion.anoPublicacion" type="number"
                class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="erroresEdicion.anoPublicacion ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="erroresEdicion.anoPublicacion" class="text-xs text-red-500 mt-1">{{ erroresEdicion.anoPublicacion
              }}
              </p>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Número de edición</label>
              <input v-model="nuevaEdicion.edicion" type="text" placeholder="1ra"
                class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-slate-600 mb-1">Páginas</label>
              <input v-model.number="nuevaEdicion.numeroPaginas" type="number" placeholder="450"
                class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <p v-if="erroresEdicion.general" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
            {{ erroresEdicion.general }}
          </p>

          <SButton :loading="creandoEdicion" @click="crearEdicionInline" class="w-full">
            Crear edición y continuar →
          </SButton>
        </div>
      </div>
    </section>

    <!-- ════════════════════════════════════════════════════════════════════
         SECCIÓN 3 — EJEMPLAR
    ═════════════════════════════════════════════════════════════════════ -->
    <section v-if="seccionEdicionCompleta" class="mb-8">
      <!-- Cabecera -->
      <div class="flex items-center gap-3 mb-4">
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold bg-indigo-600 text-white flex-shrink-0">
          3
        </div>
        <h2 class="text-base font-semibold text-slate-800">Datos del ejemplar</h2>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">

        <!-- Resumen libro + edición -->
        <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
          <div class="w-8 h-11 rounded-md bg-slate-200 flex-shrink-0 overflow-hidden">
            <img v-if="edicionConfirmada?.imagenPortada" :src="edicionConfirmada.imagenPortada" alt=""
              class="w-full h-full object-cover" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-800 truncate">{{ libroConfirmado?.titulo }}</p>
            <p class="text-xs text-slate-500 font-mono">{{ edicionConfirmada?.isbn }} · {{ edicionConfirmada?.editorial
            }}
            </p>
          </div>
        </div>

        <!-- Biblioteca -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">
            Biblioteca *
            <span v-if="isBibliotecario && !isAdmin" class="text-slate-400 font-normal">(tu biblioteca)</span>
          </label>
          <div v-if="isAdmin">
            <div v-if="cargandoBibs" class="flex items-center gap-2 h-9 text-xs text-slate-400">
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando bibliotecas…
            </div>
            <select v-else v-model.number="formEjemplar.bibliotecaId"
              class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              :class="erroresEjemplar.bibliotecaId ? 'border-red-400' : 'border-slate-200'">
              <option :value="null" disabled>Seleccionar biblioteca</option>
              <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
            </select>
          </div>
          <div v-else class="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            <span class="text-sm font-medium text-indigo-700">
              {{ bibliotecaPropia[0]?.nombre ?? 'Sin biblioteca asignada' }}
            </span>
          </div>
          <p v-if="erroresEjemplar.bibliotecaId" class="text-xs text-red-500 mt-1">{{ erroresEjemplar.bibliotecaId }}
          </p>
        </div>

        <!-- Código + topográfico -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Código ejemplar *</label>
            <input v-model="formEjemplar.codigoEjemplar" type="text" placeholder="EJ-2024-010"
              class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="erroresEjemplar.codigoEjemplar ? 'border-red-400' : 'border-slate-200'" />
            <p v-if="erroresEjemplar.codigoEjemplar" class="text-xs text-red-500 mt-1">{{ erroresEjemplar.codigoEjemplar
            }}
            </p>
            <p class="text-xs text-slate-400 mt-0.5">Debe ser único</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Código topográfico</label>
            <input v-model="formEjemplar.codigoTopografico" type="text" placeholder="004.1 C676"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <!-- Ubicación -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Ubicación física *</label>
          <input v-model="formEjemplar.ubicacionFisica" type="text" placeholder="Estante B-2, Fila 1"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="erroresEjemplar.ubicacionFisica ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="erroresEjemplar.ubicacionFisica" class="text-xs text-red-500 mt-1">{{ erroresEjemplar.ubicacionFisica
          }}
          </p>
        </div>

        <!-- Estado + Fecha + Precio -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
            <select v-model="formEjemplar.estadoEjemplar"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              <option v-for="op in opcionesEstado" :key="op.value" :value="op.value">{{ op.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Fecha adquisición</label>
            <input v-model="formEjemplar.fechaAdquisicion" type="date"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Precio compra (Bs.)</label>
            <input v-model.number="formEjemplar.precioCompra" type="number" step="0.01" placeholder="85.00"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <!-- Observaciones -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
          <textarea v-model="formEjemplar.observaciones" rows="2" placeholder="Donación FHCE 2024…"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>

        <p v-if="erroresEjemplar.edicionId" class="text-xs text-red-500">{{ erroresEjemplar.edicionId }}</p>
        <p v-if="errorGuardar" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorGuardar }}</p>
      </div>
    </section>

    <!-- ── Barra de acciones flotante ────────────────────────────────────── -->
    <div v-if="seccionEdicionCompleta"
      class="sticky bottom-4 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl shadow-lg px-5 py-3">
      <p class="text-sm text-slate-500 hidden sm:block">
        <span class="font-medium text-slate-700">{{ libroConfirmado?.titulo }}</span>
        <span class="text-slate-300 mx-2">·</span>
        <span class="font-mono text-xs">{{ edicionConfirmada?.isbn }}</span>
      </p>
      <div class="flex gap-2 ml-auto">
        <SButton variant="secondary" @click="router.push('/inventario')">Cancelar</SButton>
        <SButton :loading="guardandoEjemplar" @click="guardarEjemplar">
          <template #iconLeft>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </template>
          Registrar ejemplar
        </SButton>
      </div>
    </div>

  </div>

  <!-- Modal Nueva Edición — reutilizado del catálogo (libros con ediciones previas) -->
  <EdicionFormModal v-if="mostrarModalEdicion && libroConfirmado" :edicion="edicionParaEditar"
    :libro-id="libroConfirmado.idLibro" @close="mostrarModalEdicion = false" @saved="onEdicionGuardada" />
</template>