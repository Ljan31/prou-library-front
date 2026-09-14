<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMedia } from '@/composables/useMedia'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import SButton from '@/components/ui/SButton.vue'
import SCard from '@/components/ui/SCard.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import EjemplarFormModal from '@/components/catalogo/EjemplarFormModal.vue'
import EjemplarFormModalInventario from '@/components/catalogo/EjemplarFormModalInventario.vue'
import EjemplarEstadoModal from '@/components/catalogo/EjemplarEstadoModal.vue'
import EjemplarHistorialModal from '@/components/catalogo/EjemplarHistorialModal.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import LibroLoteFormModal from '@/components/catalogo/LibroLoteFormModal.vue'
import Libroeditarmodal from '@/components/catalogo/Libroeditarmodal.vue'
import LibroModal from '@/components/inventario/LibroModal.vue'
import LibroRapidoModal from '@/components/inventario/LibroRapidoModal.vue'

import {
  obtenerEjemplares,
  obtenerEjemplaresPorBiblioteca,
  transferir,
} from '@/services/ejemplares.service'
import api from '@/services/axios'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Ejemplar } from '@/types/catalogo'
import { bibliotecasService } from '@/services/bibliotecas.service'

const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()
const router = useRouter()
const { getUrl } = useMedia()

onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Inventario' },
  ])
  cargarBibliotecas()
  cargarEjemplares()
})
// watch(
//   () => bibliotecaPropia.value,
//   (bib) => {
//     console.log('bib', bib)
//     if (bib.length > 0) {
//       cargarEjemplares()
//     }
//   },
//   { immediate: true }
// )

// ══════════════════════════════════════════════════════════════════
// VISTA — ejemplares | libros
// ══════════════════════════════════════════════════════════════════
type Vista = 'libros' | 'ejemplares'
const vistaActiva = ref<Vista>(
  (sessionStorage.getItem('inventario_vista') as Vista) ?? 'libros'
)
watch(vistaActiva, (v) => sessionStorage.setItem('inventario_vista', v))

// ══════════════════════════════════════════════════════════════════
// BIBLIOTECAS (admin)
// ══════════════════════════════════════════════════════════════════
interface BibliotecaOpcion { id: number; nombre: string }

const bibliotecas = ref<BibliotecaOpcion[]>([])
const cargandoBibs = ref(false)
const filtroBiblioteca = ref<number | ''>('')   // '' = todas

// ─── Biblioteca del usuario logueado ──────────────────────────────────────
const bibliotecaPropia = computed<BibliotecaOpcion | null>(() => {
  const lista = auth.user?.biblioteca
  if (!lista || lista.length === 0) return null

  const bib = lista[0] // 👈 tomas la primera

  const id = (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number | undefined
  const nombre = (bib.nombre ?? bib.name) as string | undefined

  return id && nombre ? { id, nombre } : null
})

async function cargarBibliotecas() {
  if (!isAdmin.value) return
  cargandoBibs.value = true
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
  finally { cargandoBibs.value = false }
}

// Cuando admin cambia el filtro de biblioteca, recargar
watch(filtroBiblioteca, () => cargarEjemplares())

// ─── Carga de datos ───────────────────────────────────────────────────────
const cargando = ref(false)
const error = ref<string | null>(null)
const todos = ref<Ejemplar[]>([])
const pdfActivo = ref(false)
async function cargarEjemplares() {
  cargando.value = true
  error.value = null
  try {
    // if (isBibliotecario.value && !isAdmin.value && bibliotecaPropia.value) {
    //   // Bibliotecario: solo ve su biblioteca
    //   todos.value = await obtenerEjemplaresPorBiblioteca(bibliotecaPropia.value.id)
    //   console.log('ejemplares', todos.value)
    // } else {
    //   // Admin: todos los ejemplares
    //   todos.value = await obtenerEjemplares()
    //   console.log('isadmin ejemplares', todos.value)
    // }
    if (isAdmin.value) {
      if (filtroBiblioteca.value !== '') {
        todos.value = await obtenerEjemplaresPorBiblioteca(filtroBiblioteca.value as number)
      } else {
        todos.value = await obtenerEjemplares()
      }
    } else if (isBibliotecario.value && bibliotecaPropia.value) {
      todos.value = await obtenerEjemplaresPorBiblioteca(bibliotecaPropia.value.id)
    } else {
      todos.value = []
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar ejemplares'
  } finally {
    cargando.value = false
  }
}

// ─── Filtros ──────────────────────────────────────────────────────────────
const busqueda = ref('')
const estadoFiltro = ref('')

const opcionesEstado = [
  { value: '', label: 'Todos los estados' },
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'PRESTADO', label: '🔴 Prestado' },
  { value: 'RESERVADO', label: '🔵 Reservado' },
  { value: 'DETERIORADO', label: '🟠 Deteriorado' },
  { value: 'EN_REPARACION', label: '🟣 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
  { value: 'BAJA', label: '⬛ Baja' },
  { value: 'PERDIDO', label: '⬛ Perdido' },
]

const ejemplaresFiltrados = computed(() => {
  console.log('todos', todos.value);
  let lista = todos.value
  if (busqueda.value.trim()) {
    const q = busqueda.value.toLowerCase()
    lista = lista.filter(e =>
      e.codigoEjemplar?.toLowerCase().includes(q) ||
      e.codigoTopografico?.toLowerCase().includes(q) ||
      e.ubicacionFisica?.toLowerCase().includes(q) ||
      e.edicion?.isbn?.toLowerCase().includes(q) ||
      e.edicion?.titulo?.toLowerCase().includes(q) ||
      (e.edicion as any)?.autores?.some((a: any) =>
        a.nombre?.toLowerCase().includes(q))
    )
  }
  if (estadoFiltro.value) {
    lista = lista.filter(e => e.estadoEjemplar === estadoFiltro.value)
  }
  return lista
})


// ══════════════════════════════════════════════════════════════════
// ORDENAMIENTO (Vista Ejemplares)
// ══════════════════════════════════════════════════════════════════
type SortKey = 'codigoEjemplar' | 'titulo' | 'estado' | 'fecha' | 'biblioteca'
const sortKey = ref<SortKey>('codigoEjemplar')
const sortAsc = ref(true)

function toggleSort(key: SortKey) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = true }
}

const ejemplaresOrdenados = computed(() => {
  const lista = [...ejemplaresFiltrados.value]
  lista.sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    switch (sortKey.value) {
      case 'codigoEjemplar': va = a.codigoEjemplar ?? ''; vb = b.codigoEjemplar ?? ''; break
      case 'titulo': va = a.edicion?.titulo ?? ''; vb = b.edicion?.titulo ?? ''; break
      case 'estado': va = a.estadoEjemplar ?? ''; vb = b.estadoEjemplar ?? ''; break
      case 'fecha': va = a.fechaAdquisicion ?? ''; vb = b.fechaAdquisicion ?? ''; break
      case 'biblioteca': va = a.biblioteca?.nombre ?? ''; vb = b.biblioteca?.nombre ?? ''; break
    }
    const cmp = String(va).localeCompare(String(vb), 'es', { numeric: true })
    return sortAsc.value ? cmp : -cmp
  })
  return lista
})

// ── Paginación vista ejemplares ───────────────────────────────────
const paginaEj = ref(1)
const porPaginaEj = 10
watch(ejemplaresFiltrados, () => { paginaEj.value = 1 })

const totalPaginasEj = computed(() =>
  Math.max(1, Math.ceil(ejemplaresOrdenados.value.length / porPaginaEj))
)
const ejemplaresPagina = computed(() =>
  ejemplaresOrdenados.value.slice(
    (paginaEj.value - 1) * porPaginaEj,
    paginaEj.value * porPaginaEj,
  )
)

// ══════════════════════════════════════════════════════════════════
// VISTA LIBROS AGRUPADOS
// ══════════════════════════════════════════════════════════════════
const librosExpandidos = ref<Set<number>>(new Set())

interface LibroAgrupado {
  idLibro: number
  titulo: string
  autores: string
  idioma: string
  codigoTopograficoConcat: string
  clasificacionDecimal: string
  cutterAutor: string
  cutterTitulo: string
  isbn: string          // primer ISBN
  categoria: string
  imagenPortada: string
  total: number
  disponibles: number
  prestados: number
  bibliotecas: string[]
  ejemplares: Ejemplar[]
  expandido: boolean
}

const librosAgrupados = computed<LibroAgrupado[]>(() => {
  const mapa = new Map<number, LibroAgrupado>()
  let i = 1;
  for (const ej of ejemplaresFiltrados.value) {
    i++;
    const idLibro = (ej.edicion as any)?.idLibro ?? (ej.edicion as any)?.libro?.idLibro ?? 0
    if (!mapa.has(idLibro)) {
      mapa.set(idLibro, {
        idLibro,
        titulo: ej.edicion?.titulo ?? '—titulo-',
        autores: ej.autores ?? '—sin autor(es)-',
        isbn: ej.edicion?.isbn ?? '—isbn-',
        idioma: ej.edicion?.idioma ?? '-s/n',
        codigoTopograficoConcat: ej.codigoTopograficoConcat ?? '-s/c-',
        clasificacionDecimal: ej.clasificacionDecimal ?? '-',
        cutterAutor: ej.cutterAutor ?? '-',
        cutterTitulo: ej.cutterTitulo ?? '-',
        categoria: (ej.edicion as any)?.categoria?.nombreCategoria ?? '',
        imagenPortada: ej.edicion?.imagenPortada ?? '',
        total: 0,
        disponibles: 0,
        prestados: 0,
        bibliotecas: [],
        ejemplares: [],
        expandido: false,
      })
    }
    const libro = mapa.get(idLibro)!
    libro.total++
    if (ej.estadoEjemplar === 'DISPONIBLE') libro.disponibles++
    if (ej.estadoEjemplar === 'PRESTADO') libro.prestados++
    const bib = ej.biblioteca?.nombre
    if (bib && !libro.bibliotecas.includes(bib)) libro.bibliotecas.push(bib)
    libro.ejemplares.push(ej)
  }
  return Array.from(mapa.values()).sort((a, b) =>
    a.titulo.localeCompare(b.titulo, 'es')
  )
})

// Paginación vista libros
const paginaLib = ref(1)
const porPaginaLib = 10
watch(librosAgrupados, () => { paginaLib.value = 1 })

const totalPaginasLib = computed(() =>
  Math.max(1, Math.ceil(librosAgrupados.value.length / porPaginaLib))
)
const librosPagina = computed(() =>
  librosAgrupados.value.slice(
    (paginaLib.value - 1) * porPaginaLib,
    paginaLib.value * porPaginaLib,
  )
)

// function toggleLibro(libro: LibroAgrupado) {
//   console.log('toggleLibro', libro)
//   console.log('expendido', libro.expandido)
//   libro.expandido = !libro.expandido
//   console.log('libro', libro.expendido)
// }

function toggleLibro(libro: LibroAgrupado) {
  if (librosExpandidos.value.has(libro.idLibro)) {
    librosExpandidos.value.delete(libro.idLibro)
  } else {
    librosExpandidos.value.add(libro.idLibro)
  }
}
// ─── Stats resumen ────────────────────────────────────────────────────────
const stats = computed(() => {
  const l = todos.value
  return {
    total: l.length,
    disponibles: l.filter(e => e.estadoEjemplar === 'DISPONIBLE').length,
    prestados: l.filter(e => e.estadoEjemplar === 'PRESTADO').length,
    deteriorados: l.filter(e => e.estadoEjemplar === 'DETERIORADO').length,
    reparacion: l.filter(e => ['EN_REPARACION', 'DAÑADO'].includes(e.estadoEjemplar)).length,
    inactivos: l.filter(e => ['BAJA', 'PERDIDO'].includes(e.estadoEjemplar)).length,
  }
})

// ─── Control de sub-modales ───────────────────────────────────────────────
type Modal = 'form' | 'estado' | 'historial' | 'confirmarEliminar' | 'transferir' | null

const modalActivo = ref<Modal>(null)
const ejemplarSeleccionado = ref<Ejemplar | null>(null)
const ejemplarEditando = ref<Ejemplar | null>(null)
const eliminando = ref(false)
const mostrarLibroModal = ref(false)
const mostrarLibroModalRapido = ref(false)

// Transferir
const nuevaBibliotecaId = ref<number | null>(null)
const motivoTransferir = ref('')
const transfiriendo = ref(false)
const errorTransferir = ref('')
const libroId = ref<number | null>(null)
function cerrarModal() {
  modalActivo.value = null
  ejemplarSeleccionado.value = null
  ejemplarEditando.value = null
  nuevaBibliotecaId.value = null
  motivoTransferir.value = ''
  errorTransferir.value = ''
  mostrarLibroModalRapido.value = false
}

function irANuevoEjemplar() {
  router.push('/nuevo-ejemplar')
}

function abrirCrear() {
  ejemplarEditando.value = null
  modalActivo.value = 'crear'
}

function abrirEditar(e: Ejemplar) {
  libroId.value = e.edicion?.idLibro
  ejemplarEditando.value = e
  modalActivo.value = 'editar'
}

function abrirEstado(e: Ejemplar) {
  ejemplarSeleccionado.value = e
  modalActivo.value = 'estado'
}

function abrirHistorial(e: Ejemplar) {
  ejemplarSeleccionado.value = e
  modalActivo.value = 'historial'
}

function abrirConfirmarEliminar(e: Ejemplar) {
  ejemplarSeleccionado.value = e
  modalActivo.value = 'confirmarEliminar'
}

function abrirTransferir(e: Ejemplar) {
  ejemplarSeleccionado.value = e
  modalActivo.value = 'transferir'
}
function verPdf(url: string) {
  window.open(getUrl(url), '_blank')
}

// ─── Acciones ─────────────────────────────────────────────────────────────
function onGuardado() {
  cerrarModal()
  cargarEjemplares()
  ui.toast.success('Guardado', 'Ejemplar guardado correctamente')
}

function onEstadoCambiado() {
  cerrarModal()
  cargarEjemplares()
  ui.toast.success('Estado actualizado', 'El estado del ejemplar fue cambiado')
}

async function confirmarEliminar() {
  if (!ejemplarSeleccionado.value) return
  eliminando.value = true
  try {
    await api.delete(`/ejemplares/${ejemplarSeleccionado.value.idEjemplar}`)
    ui.toast.success('Eliminado', `Ejemplar ${ejemplarSeleccionado.value.codigoEjemplar} eliminado`)
    cerrarModal()
    cargarEjemplares()
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo eliminar')
  } finally {
    eliminando.value = false
  }
}

async function confirmarTransferir() {
  if (!ejemplarSeleccionado.value || !nuevaBibliotecaId.value) return
  if (!motivoTransferir.value.trim()) { errorTransferir.value = 'El motivo es requerido'; return }
  transfiriendo.value = true
  errorTransferir.value = ''
  try {
    await transferir(
      ejemplarSeleccionado.value.idEjemplar,
      nuevaBibliotecaId.value,
      motivoTransferir.value
    )
    ui.toast.success('Transferido', 'Ejemplar transferido correctamente')
    cerrarModal()
    cargarEjemplares()
  } catch (e: unknown) {
    errorTransferir.value = e instanceof Error ? e.message : 'Error al transferir'
  } finally {
    transfiriendo.value = false
  }
}

// ─── Exportar a CSV (simple) ───────────────────────────────────────────────
function exportarCSV() {
  const cols = ['Código', 'Topográfico', 'Estado', 'Ubicación', 'ISBN', 'Título', 'Biblioteca', 'Adquisición', 'Precio']
  const filas = ejemplaresFiltrados.value.map(e => [
    e.codigoEjemplar,
    e.codigoTopografico ?? '',
    e.estadoEjemplar,
    e.ubicacionFisica ?? '',
    e.edicion?.isbn ?? '',
    e.edicion?.titulo ?? '',
    e.biblioteca?.nombre ?? '',
    e.fechaAdquisicion ?? '',
    e.precioCompra ?? '',
  ])
  const csv = [cols, ...filas].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventario-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Helpers ────────────────────────────────────────────────────────
function sortIcon(key: SortKey) {
  if (sortKey.value !== key) return 'text-slate-300'
  return sortAsc.value ? 'text-indigo-500 rotate-0' : 'text-indigo-500 rotate-180'
}

function disponibilidadColor(disponibles: number, total: number) {
  const pct = total ? disponibles / total : 0
  if (pct >= 0.6) return 'bg-emerald-500'
  if (pct >= 0.3) return 'bg-amber-400'
  return 'bg-red-500'
}
</script>

<template>
  <div class="page-container">

    <!-- ── Header ── -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Inventario de Libros</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ ejemplaresFiltrados.length }}
          ejemplar{{ ejemplaresFiltrados.length !== 1 ? 'es' : '' }}
          <template v-if="vistaActiva === 'libros'">
            · {{ librosAgrupados.length }} título{{ librosAgrupados.length !== 1 ? 's' : '' }}
          </template>
          <template v-if="isBibliotecario && !isAdmin && bibliotecaPropia">
            · <span class="text-indigo-600 font-medium">{{ bibliotecaPropia.nombre }}</span>
          </template>
          <template v-if="isAdmin && filtroBiblioteca">
            · <span class="text-indigo-600 font-medium">
              {{bibliotecas.find(b => b.id === filtroBiblioteca)?.nombre}}
            </span>
          </template>
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <!-- Toggle vista -->
        <div class="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
          <button @click="vistaActiva = 'libros'" :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            vistaActiva === 'libros'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-700']">
            <svg class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.523 5.754 19 7.5 19s3.332-.477 4.5-1.253" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.523 18.246 19 16.5 19s-3.332-.477-4.5-1.253" />
          </svg>
            Libros
          </button>
           <button @click="vistaActiva = 'ejemplares'" :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            vistaActiva === 'ejemplares'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-700']">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Ejemplares
          </button>
        </div>
        <!-- Exportar CSV -->
        <!-- <button @click="exportarCSV"
          class="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          title="Exportar a CSV">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar
        </button> -->

        <!-- Nuevo ejemplar: admin siempre, bibliotecario si tiene biblioteca -->
        <!-- <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="mostrarLibroModal = true"
          variant="primary"> -->
        <!-- <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="irANuevoEjemplar" variant="primary"> -->
        <!-- <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo ejemplarsss
        </SButton> -->
        <!-- Nuevo ejemplar: admin siempre, bibliotecario si tiene biblioteca -->
        <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="mostrarLibroModalRapido = true"
          variant="primary">
          <!-- <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="irANuevoEjemplar" variant="primary"> -->
          <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Libro
        </SButton>
        <!-- opcion 2 -->
        <!-- Nuevo ejemplar: admin siempre, bibliotecario si tiene biblioteca -->
        <!-- <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="irANuevoEjemplar" variant="primary"> -->
        <!-- <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="abrirCrear" variant="primary">
          <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo ejemplar
        </SButton> -->
      </div>
    </div>

    <!-- ── Aviso sin biblioteca ── -->
    <div v-if="isBibliotecario && !isAdmin && !bibliotecaPropia"
      class="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.07 16.5c-.77.833.193 2.5 1.732 2.5z" />
      </svg>
      <div>
        <p class="text-sm font-medium text-amber-800">Sin biblioteca asignada</p>
        <p class="text-xs text-amber-700 mt-0.5">
          Tu cuenta no tiene una biblioteca asignada. Contacta al administrador.
        </p>
      </div>
    </div>

    <!-- ── Stats ── -->
    <div class="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Total</p>
        <p class="text-2xl font-semibold text-slate-900">{{ stats.total }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Disponibles</p>
        <p class="text-2xl font-semibold text-emerald-600">{{ stats.disponibles }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Prestados</p>
        <p class="text-2xl font-semibold text-red-600">{{ stats.prestados }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">En reparación</p>
        <p class="text-2xl font-semibold text-purple-600">{{ stats.reparacion }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Deteriorados</p>
        <p class="text-2xl font-semibold text-orange-600">{{ stats.deteriorados }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Baja / Perdido</p>
        <p class="text-2xl font-semibold text-slate-500">{{ stats.inactivos }}</p>
      </SCard>
    </div>

    <!-- ── Filtros ── -->
    <SCard class="mb-5" padding="md">
      <div class="flex flex-col sm:flex-row gap-3">
        <SInput v-model="busqueda" placeholder="Buscar por código, ISBN, título, ubicación..." clearable
          class="flex-1" />
        <SSelect v-model="estadoFiltro" :options="opcionesEstado" class="sm:w-52" />


        <!-- Filtro biblioteca (solo admin) -->
        <div v-if="isAdmin" class="sm:w-60">
          <div v-if="cargandoBibs"
            class="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-xl text-sm text-slate-400">
            <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando...
          </div>
          <div v-else class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            <select v-model="filtroBiblioteca"
              class="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="">Todas las bibliotecas</option>
              <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">
                {{ bib.nombre }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </SCard>

    <!-- ── Cargando ── -->
    <div v-if="cargando" class="space-y-2">
      <SSkeleton v-for="i in 8" :key="i" width="100%" height="72px" />
    </div>

    <!-- ── Error ── -->
    <div v-else-if="error" class="text-center py-10">
      <p class="text-sm text-red-500">{{ error }}</p>
      <SButton variant="ghost" size="sm" class="mt-3" @click="cargarEjemplares">Reintentar</SButton>
    </div>

    <!-- ── Vacío ── -->
    <SEmptyState v-else-if="!ejemplaresFiltrados.length" title="Sin resultados"
      description="No se encontraron ejemplares con los filtros aplicados." icon="archive-box">
      <template #action>
        <SButton variant="ghost" size="sm" @click="busqueda = ''; estadoFiltro = ''; filtroBiblioteca = ''">
          Limpiar filtros
        </SButton>
      </template>
    </SEmptyState>

    <!-- ── Lista de ejemplares ── -->
    <template v-else class="space-y-2">
      <!-- ════════════════════════════════════════════════════════════
      VISTA 1 — EJEMPLARES (tabla + orden + paginación)
      ════════════════════════════════════════════════════════════ -->
      <template v-if="vistaActiva === 'ejemplares'">

        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">

          <!-- Tabla responsive -->
          <div class="overflow-x-auto">
            <table class="w-full min-w-[1050px] text-sm">

              <!-- Header -->
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr class="text-left">

                  <th class="px-4 py-3 font-semibold text-slate-600 w-[70px]">
                    Portada
                  </th>

                  <th class="px-4 py-3 font-semibold text-slate-600">
                    Ejemplar
                  </th>

                  <th class="px-4 py-3 font-semibold text-slate-600">
                    Libro
                  </th>

                  <th class="px-4 py-3 font-semibold text-slate-600">
                    Ubicación
                  </th>

                  <th v-if="isAdmin" class="px-4 py-3 font-semibold text-slate-600">
                    Biblioteca
                  </th>

                  <th class="px-4 py-3 font-semibold text-slate-600">
                    Estado
                  </th>

                  <th class="px-4 py-3 font-semibold text-slate-600 text-right">
                    Precio
                  </th>

                  <th class="px-4 py-3 font-semibold text-slate-600">
                    Adquisición
                  </th>

                  <th class="px-4 py-3 font-semibold text-slate-600 text-right">
                    Acciones
                  </th>

                </tr>
              </thead>

              <!-- Body -->
              <tbody class="divide-y divide-slate-100">

                <tr
                  v-for="ej in ejemplaresPagina"
                  :key="ej.idEjemplar"
                  class="group hover:bg-slate-50/80 transition-colors"
                >

                  <!-- Portada -->
                  <td class="px-4 py-3">

                    <img
                      v-if="ej.edicion?.imagenPortada"
                      :src="getUrl(ej.edicion.imagenPortada)"
                      alt="Portada"
                      class="w-10 h-14 object-cover rounded-md border border-slate-200 shadow-sm"
                    />

                    <div
                      v-else
                      class="w-10 h-14 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center text-xs text-slate-400"
                    >
                      —
                    </div>

                  </td>

                  <!-- Código ejemplar -->
                  <td class="px-4 py-3">

                    <div class="flex flex-col gap-1">

                      <span
                        class="font-mono font-semibold text-slate-900 whitespace-nowrap"
                      >
                        {{
                          ej.codigoEjemplar ||
                          ej.codigoTopograficoConcat ||
                          ej.codigoTopografico ||
                          '—'
                        }}
                      </span>

                      <span
                        v-if="ej.codigoTopografico"
                        class="font-mono text-xs text-slate-400"
                      >
                        {{ ej.codigoTopografico }}
                      </span>

                      <span
                        v-if="ej.edicion?.isbn"
                        class="font-mono text-xs text-indigo-600"
                      >
                        ISBN {{ ej.edicion.isbn }}
                      </span>

                    </div>

                  </td>

                  <!-- Libro -->
                  <td class="px-4 py-3 max-w-[280px]">

                    <div class="flex flex-col min-w-0">

                      <span
                        class="font-medium text-slate-800 truncate"
                        :title="ej.edicion?.titulo"
                      >
                        {{ ej.edicion?.titulo || 'Sin título' }}
                      </span>

                      <span class="text-xs text-slate-400 mt-0.5">
                        {{ ej.edicion?.autor || '—' }}
                      </span>

                    </div>

                  </td>

                  <!-- Ubicación -->
                  <td class="px-4 py-3">

                    <span
                      v-if="ej.ubicacionFisica"
                      class="inline-flex items-center gap-1.5 text-slate-600 whitespace-nowrap"
                    >
                      <!-- Icono ubicación -->
                      <svg
                        class="w-4 h-4 text-slate-400 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M17.657 16.657L13.414 21a2 2 0 01-2.828 0l-4.243-4.343a8 8 0 1111.314 0z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>

                      {{ ej.ubicacionFisica }}
                    </span>

                    <span v-else class="text-slate-400">
                      —
                    </span>

                  </td>

                  <!-- Biblioteca -->
                  <td
                    v-if="isAdmin"
                    class="px-4 py-3"
                  >
                    <span class="text-slate-600 whitespace-nowrap">
                      {{ ej.biblioteca?.nombre || '—' }}
                    </span>
                  </td>

                  <!-- Estado -->
                  <td class="px-4 py-3">

                    <span
                      :class="[
                        'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                        estadoEjemplarConfig[ej.estadoEjemplar]?.clases ??
                          'bg-slate-100 text-slate-600'
                      ]"
                    >

                      <span
                        :class="[
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          estadoEjemplarConfig[ej.estadoEjemplar]?.dot ??
                            'bg-slate-400'
                        ]"
                      />

                      {{
                        estadoEjemplarConfig[ej.estadoEjemplar]?.label ??
                        ej.estadoEjemplar ??
                        'Sin estado'
                      }}

                    </span>

                  </td>

                  <!-- Precio -->
                  <td class="px-4 py-3 text-right">

                    <span
                      v-if="ej.precioCompra != null"
                      class="font-medium text-slate-700 whitespace-nowrap"
                    >
                      Bs. {{ Number(ej.precioCompra).toFixed(2) }}
                    </span>

                    <span v-else class="text-slate-400">
                      —
                    </span>

                  </td>

                  <!-- Fecha -->
                  <td class="px-4 py-3">

                    <span class="text-slate-500 whitespace-nowrap">
                      {{ ej.fechaAdquisicion ?? '—' }}
                    </span>

                  </td>

                  <!-- Acciones -->
                  <td class="px-4 py-3">

                    <div class="flex items-center justify-end gap-1">

                      <!-- Historial -->
                      <button
                        @click="abrirHistorial(ej)"
                        class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Historial de estados"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </button>

                      <!-- Cambiar estado -->
                      <button
                        @click="abrirEstado(ej)"
                        :disabled="['BAJA', 'PERDIDO'].includes(ej.estadoEjemplar)"
                        class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Cambiar estado"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                          />
                        </svg>
                      </button>

                      <!-- Editar -->
                      <button
                        @click="abrirEditar(ej)"
                        :disabled="['BAJA', 'PERDIDO'].includes(ej.estadoEjemplar)"
                        class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Editar"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      <!-- PDF -->
                      <button
                        v-if="ej.edicion?.pdfUrl"
                        @click="verPdf(ej.edicion.pdfUrl)"
                        class="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Ver PDF"
                      >
                        <span class="text-sm">📄</span>
                      </button>

                      <!-- Eliminar -->
                      <button
                        v-if="isAdmin"
                        @click="abrirConfirmarEliminar(ej)"
                        :disabled="
                          !!ej.prestamoActivo ||
                          ej.estadoEjemplar === 'PRESTADO'
                        "
                        class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Eliminar"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>

                    </div>

                  </td>

                </tr>

                <!-- Estado vacío -->
                <tr v-if="!ejemplaresPagina.length">
                  <td
                    :colspan="isAdmin ? 9 : 8"
                    class="px-6 py-12 text-center"
                  >
                    <div class="flex flex-col items-center">

                      <div
                        class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3"
                      >
                        <svg
                          class="w-6 h-6 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>

                      <p class="font-medium text-slate-700">
                        No hay ejemplares
                      </p>

                      <p class="text-sm text-slate-400 mt-1">
                        No se encontraron ejemplares para mostrar.
                      </p>

                    </div>
                  </td>
                </tr>

              </tbody>

            </table>
          </div>

        </div>

        <!-- Paginación -->
        <div
          v-if="totalPaginasEj > 1"
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4"
        >

          <!-- Información -->
          <p class="text-xs text-slate-500">
            Mostrando
            <span class="font-medium text-slate-700">
              {{ (paginaEj - 1) * porPaginaEj + 1 }}
            </span>
            –
            <span class="font-medium text-slate-700">
              {{
                Math.min(
                  paginaEj * porPaginaEj,
                  ejemplaresOrdenados.length
                )
              }}
            </span>
            de
            <span class="font-medium text-slate-700">
              {{ ejemplaresOrdenados.length }}
            </span>
            ejemplares
          </p>

          <!-- Controles -->
          <div class="flex items-center gap-1">

            <!-- Anterior -->
            <button
              @click="paginaEj--"
              :disabled="paginaEj === 1"
              class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página anterior"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <!-- Números -->
            <template v-for="p in totalPaginasEj" :key="p">

              <button
                v-if="
                  Math.abs(p - paginaEj) <= 2 ||
                  p === 1 ||
                  p === totalPaginasEj
                "
                @click="paginaEj = p"
                :class="[
                  'min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition-colors',
                  p === paginaEj
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                ]"
              >
                {{ p }}
              </button>

              <span
                v-else-if="Math.abs(p - paginaEj) === 3"
                class="text-slate-400 text-sm px-1"
              >
                …
              </span>

            </template>

            <!-- Siguiente -->
            <button
              @click="paginaEj++"
              :disabled="paginaEj === totalPaginasEj"
              class="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página siguiente"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

          </div>

        </div>

      </template>


      <!-- ════════════════════════════════════════════════════════════
          VISTA 2 — CATÁLOGO DE LIBROS AGRUPADOS
          Tabla principal + detalle de ejemplares
      ════════════════════════════════════════════════════════════ -->

      <template v-else>

        <!-- ═══════════════════════════════════════════════════════
            TABLA PRINCIPAL — LIBROS
        ═════════════════════════════════════════════════════════ -->

        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

          <div class="overflow-x-auto">

            <table class="w-full min-w-[1000px] text-sm">

              <!-- ─────────────────────────────────────────────────
                  HEADER LIBROS
              ────────────────────────────────────────────────── -->

              <thead>

                <tr class="bg-slate-50 border-b border-slate-200">

                  <!-- Portada -->
                  <th
                    class="w-[72px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Portada
                  </th>

                  <!-- Libro -->
                  <th
                    class="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Información del libro
                  </th>

                  <!-- ISBN -->
                  <th
                    class="w-[150px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Codigo
                  </th>

                  <!-- Bibliotecas -->
                  <th
                    v-if="isAdmin"
                    class="w-[190px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Bibliotecas
                  </th>

                  <!-- Disponibilidad -->
                  <th
                    class="w-[150px] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Disponibilidad
                  </th>

                  <!-- Prestados -->
                  <th
                    class="w-[100px] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Prestados
                  </th>

                  <!-- Expandir -->
                  <th
                    class="w-[55px] px-3 py-3"
                    aria-label="Expandir"
                  >
                  </th>
                  <!-- Acciones -->
                  <th
                    class="w-[100px] px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Acciones
                  </th>
                </tr>

              </thead>


              <!-- ─────────────────────────────────────────────────
                  BODY LIBROS
              ────────────────────────────────────────────────── -->

              <tbody>

                <template
                  v-for="libro in librosPagina"
                  :key="libro.idLibro"
                >

                  <!-- ═══════════════════════════════════════════════
                      FILA PRINCIPAL DEL LIBRO
                  ═══════════════════════════════════════════════ -->

                  <tr
                    @click="toggleLibro(libro)"
                    class="group cursor-pointer border-b border-slate-100 transition-colors hover:bg-indigo-50/30"
                    :class="
                      librosExpandidos.has(libro.idLibro)
                        ? 'bg-indigo-50/40'
                        : 'bg-white'
                    "
                  >

                    <!-- ─────────────────────────────────────────
                        PORTADA
                    ────────────────────────────────────────── -->

                    <td class="px-4 py-3">

                      <div class="relative">

                        <img
                          v-if="libro.imagenPortada"
                          :src="getUrl(libro.imagenPortada)"
                          alt="Portada"
                          class="w-10 h-14 object-cover rounded-md border border-slate-200 shadow-sm"
                        />

                        <div
                          v-else
                          class="w-10 h-14 rounded-md border border-slate-200 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center"
                        >

                           <svg
                              class="w-5 h-5 text-slate-300"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              stroke-width="1.5"
                              aria-hidden="true"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M4.5 5.5A2.5 2.5 0 0 1 7 3h4.5v17H7a2.5 2.5 0 0 0-2.5 2.5v-17Z"
                              />
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19.5 5.5A2.5 2.5 0 0 0 17 3h-5.5v17H17a2.5 2.5 0 0 1 2.5 2.5v-17Z"
                              />
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 3v17"
                              />
                            </svg>

                        </div>

                      </div>

                    </td>


                    <!-- ─────────────────────────────────────────
                        INFORMACIÓN DEL LIBRO
                    ────────────────────────────────────────── -->

                    <td class="px-4 py-3">

                      <div class="min-w-0 max-w-[380px]">

                        <!-- Título + categoría -->

                        <div class="flex items-center gap-2 min-w-0">

                          <span
                            class="font-semibold text-slate-800 truncate group-hover:text-indigo-700 transition-colors"
                            :title="libro.titulo"
                          >
                            {{ libro.titulo }}
                          </span>

                          <span
                            v-if="libro.categoria"
                            class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-semibold"
                          >
                            {{ libro.categoria }}
                          </span>

                        </div>


                        <!-- Autores -->

                        <p
                          v-if="libro.autores"
                          class="text-xs text-slate-500 truncate mt-1"
                          :title="libro.autores"
                        >
                          {{ libro.autores }}
                        </p>


                        <!-- Indicador de ejemplares -->

                        <div class="flex items-center gap-1.5 mt-1.5">

                          <svg
                            class="w-3.5 h-3.5 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="1.5"
                              d="M4 6h16M4 10h16M4 14h16M4 18h16"
                            />
                          </svg>

                          <span class="text-[11px] text-slate-400">
                            {{ libro.total }}
                            {{ libro.total === 1 ? 'ejemplar' : 'ejemplares' }}
                          </span>

                          <span
                            v-if="librosExpandidos.has(libro.idLibro)"
                            class="text-[11px] font-medium text-indigo-500"
                          >
                            · detalle abierto
                          </span>

                        </div>

                      </div>

                    </td>


                    <!-- ─────────────────────────────────────────
                        ISBN
                    ────────────────────────────────────────── -->

                   <td class="px-4 py-3">
                    <div
                      v-if="libro.clasificacionDecimal"
                      class="flex flex-col leading-tight"
                    >
                      <!-- Clasificación -->
                      <div class="flex items-baseline gap-1.5">
                        <span
                          v-if="libro.idioma"
                          class="text-[12px] font-semibold uppercase text-indigo-500"
                        >
                          <!-- {{ libro.idioma }} -->
                          {{ libro.idioma.charAt(0) }}
                        </span>

                        <span class="font-mono text-xs font-semibold text-slate-700">
                          {{ libro.clasificacionDecimal }}
                        </span>
                      </div>

                      <!-- Cutter -->
                      <span
                        v-if="libro.cutterAutor || libro.cutterTitulo"
                        class="font-mono text-xs font-medium tracking-wide text-slate-600"
                      >
                        {{ libro.cutterAutor }}{{ libro.cutterTitulo }}
                      </span>
                    </div>

                    <span
                      v-else
                      class="text-slate-300"
                    >
                      —
                    </span>
                  </td>



                    <!-- ─────────────────────────────────────────
                        BIBLIOTECAS
                    ────────────────────────────────────────── -->

                    <td
                      v-if="isAdmin"
                      class="px-4 py-3"
                    >

                      <div
                        v-if="libro.bibliotecas?.length"
                        class="flex items-center gap-1.5 flex-wrap max-w-[190px]"
                      >

                        <span
                          v-for="bib in libro.bibliotecas.slice(0, 2)"
                          :key="bib"
                          class="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-600"
                        >
                          {{ bib }}
                        </span>

                        <span
                          v-if="libro.bibliotecas.length > 2"
                          class="inline-flex items-center px-1.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-600"
                          :title="libro.bibliotecas.slice(2).join(', ')"
                        >
                          +{{ libro.bibliotecas.length - 2 }}
                        </span>

                      </div>

                      <span
                        v-else
                        class="text-slate-300"
                      >
                        —
                      </span>

                    </td>


                    <!-- ─────────────────────────────────────────
                        DISPONIBILIDAD
                    ────────────────────────────────────────── -->

                    <td class="px-4 py-3">

                      <div class="flex flex-col items-center">

                        <div class="flex items-baseline gap-1">

                          <span
                            class="text-sm font-bold"
                            :class="
                              libro.disponibles > 0
                                ? 'text-emerald-600'
                                : 'text-red-500'
                            "
                          >
                            {{ libro.disponibles }}
                          </span>

                          <span class="text-xs text-slate-400">
                            / {{ libro.total }}
                          </span>

                        </div>


                        <!-- Barra disponibilidad -->

                        <div
                          class="w-20 h-1.5 mt-1.5 bg-slate-100 rounded-full overflow-hidden"
                        >

                          <div
                            :class="[
                              'h-full rounded-full transition-all duration-300',
                              disponibilidadColor(
                                libro.disponibles,
                                libro.total
                              )
                            ]"
                            :style="{
                              width: libro.total
                                ? `${(libro.disponibles / libro.total) * 100}%`
                                : '0%'
                            }"
                          />

                        </div>


                        <span
                          class="text-[10px] mt-1"
                          :class="
                            libro.disponibles > 0
                              ? 'text-emerald-600'
                              : 'text-red-400'
                          "
                        >
                          {{
                            libro.disponibles > 0
                              ? 'Disponible'
                              : 'Sin disponibilidad'
                          }}
                        </span>

                      </div>

                    </td>


                    <!-- ─────────────────────────────────────────
                        PRESTADOS
                    ────────────────────────────────────────── -->

                    <td class="px-4 py-3 text-center">

                      <template v-if="libro.prestados > 0">

                        <span
                          class="inline-flex items-center justify-center min-w-8 h-7 px-2 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-xs font-semibold"
                        >
                          {{ libro.prestados }}
                        </span>

                      </template>

                      <span
                        v-else
                        class="text-slate-300"
                      >
                        —
                      </span>

                    </td>


                    <!-- ─────────────────────────────────────────
                        EXPANDIR
                    ────────────────────────────────────────── -->

                    <td class="px-3 py-3">

                      <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        :class="
                          librosExpandidos.has(libro.idLibro)
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600'
                        "
                      >

                        <svg
                          class="w-4 h-4 transition-transform duration-200"
                          :class="
                            librosExpandidos.has(libro.idLibro)
                              ? 'rotate-180'
                              : ''
                          "
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >

                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 9l-7 7-7-7"
                          />

                        </svg>

                      </div>

                    </td>
                    <!-- ─────────────────────────────────────────
                        ACCIONES DEL LIBRO
                    ────────────────────────────────────────── -->

                    <td class="px-4 py-3">

                      <div class="flex items-center justify-end gap-1">

                        <!-- Editar libro -->

                        <button
                          @click.stop="abrirEditar(libro.ejemplares?.[0])"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Editar libro"
                          aria-label="Editar libro"
                        >

                          <svg
                            class="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="1.8"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"
                            />

                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M18.5 3.5a2.121 2.121 0 013 3L12 16l-4 1 1-4 9.5-9.5z"
                            />
                          </svg>

                        </button>


                        <!-- Eliminar libro -->

                        <button
                          @click.stop="eliminarLibro(libro)"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar libro"
                          aria-label="Eliminar libro"
                        >

                          <svg
                            class="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="1.8"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M3 6h18"
                            />

                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"
                            />

                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M19 6l-1 14a1 1 0 01-1 .93H7a1 1 0 01-1-.93L5 6"
                            />

                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M10 11v5M14 11v5"
                            />
                          </svg>

                        </button>

                      </div>

                    </td>

                  </tr>


                  <!-- ═══════════════════════════════════════════════
                      DETALLE — EJEMPLARES
                  ═══════════════════════════════════════════════ -->

                  <tr
                    v-if="librosExpandidos.has(libro.idLibro)"
                  >

                    <td
                      :colspan="isAdmin ? 8 : 7"
                      class="p-0"
                    >

                      <div
                        class="bg-slate-50 border-b border-slate-200"
                      >

                        <!-- ─────────────────────────────────────
                            CABECERA DEL DETALLE
                        ────────────────────────────────────── -->

                        <div
                          class="px-6 py-3 border-b border-slate-200 bg-indigo-50/50"
                        >

                          <div class="flex items-center justify-between">

                            <div class="flex items-center gap-3">

                              <!-- Icono -->

                              <div
                                class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-600 flex items-center justify-center"
                              >

                                <svg
                                  class="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="1.5"
                                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                                  />
                                </svg>

                              </div>


                              <div>

                                <div class="flex items-center gap-2">

                                  <h4
                                    class="text-sm font-semibold text-slate-700"
                                  >
                                    Ejemplares del libro
                                  </h4>

                                  <span
                                    class="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-full bg-white border border-indigo-200 text-[11px] font-semibold text-indigo-600"
                                  >
                                    {{ libro.ejemplares?.length || 0 }}
                                  </span>

                                </div>

                                <p class="text-[11px] text-slate-400 mt-0.5">
                                  Información física y estado de cada ejemplar
                                </p>

                              </div>

                            </div>


                            <!-- Indicador disponibilidad -->

                            <div class="hidden sm:flex items-center gap-2">

                              <span class="text-[11px] text-slate-400">
                                Disponibles
                              </span>

                              <span
                                class="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-[11px] font-semibold text-emerald-600"
                              >
                                {{ libro.disponibles }}
                              </span>

                            </div>

                          </div>

                        </div>


                        <!-- ─────────────────────────────────────
                            TABLA DE EJEMPLARES
                        ────────────────────────────────────── -->

                        <div class="px-4 sm:px-6 py-4">

                          <div
                            class="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm"
                          >

                            <div class="overflow-x-auto">

                              <table class="w-full min-w-[800px] text-sm">

                                <!-- HEADER EJEMPLARES -->

                                <thead>

                                  <tr
                                    class="bg-slate-100/80 border-b border-slate-200"
                                  >

                                    <th
                                      class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Código ejemplar
                                    </th>

                                    <th
                                      class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Editorial
                                    </th>
                                    <th
                                      class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Edicion
                                    </th>
                                    <th
                                      class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Año Publicación
                                    </th>

                                    <th
                                      class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Ubicación física
                                    </th>

                                    <th
                                      v-if="isAdmin"
                                      class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Biblioteca
                                    </th>

                                    <th
                                      class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Estado
                                    </th>

                                    <th
                                      class="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                    >
                                      Acciones
                                    </th>

                                  </tr>

                                </thead>


                                <!-- BODY EJEMPLARES -->

                                <tbody class="divide-y divide-slate-100">

                                  <tr
                                    v-for="ej in libro.ejemplares"
                                    :key="ej.idEjemplar"
                                    class="group hover:bg-indigo-50/30 transition-colors"
                                  >

                                    <!-- Código ejemplar -->

                                    <td class="px-4 py-3">

                                      <div class="flex items-center gap-2">

                                        <div
                                          class="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center"
                                        >

                                          <svg
                                            class="w-3.5 h-3.5 text-slate-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="1.5"
                                              d="M4 6h16M4 10h16M4 14h16M4 18h16"
                                            />
                                          </svg>

                                        </div>

                                        <span
                                          class="font-mono text-xs font-semibold text-slate-700"
                                        >
                                          {{ ej.codigoEjemplar || '—' }}
                                        </span>

                                      </div>

                                    </td>


                                    <!-- Editorial -->

                                    <td class="px-4 py-3">

                                      <span
                                        v-if="ej.edicion?.editorial "
                                        class="font-mono text-xs text-slate-500"
                                      >
                                        {{ ej.edicion?.editorial }}
                                      </span>

                                      <span
                                        v-else
                                        class="text-xs text-slate-300"
                                      >
                                        —
                                      </span>

                                    </td>
                                    <!-- Edicion -->

                                    <td class="px-4 py-3">

                                      <span
                                        v-if="ej.edicion?.editorial "
                                        class="font-mono text-xs text-slate-500"
                                      >
                                        {{ ej.edicion?.edicion }}
                                      </span>

                                      <span
                                        v-else
                                        class="text-xs text-slate-300"
                                      >
                                        —
                                      </span>

                                    </td>
                                    <!-- año publicacion -->

                                    <td class="px-4 py-3">

                                      <span
                                        v-if="ej.edicion?.anoPublicacion "
                                        class="font-mono text-xs text-slate-500"
                                      >
                                        {{ ej.edicion?.anoPublicacion }}
                                      </span>

                                      <span
                                        v-else
                                        class="text-xs text-slate-300"
                                      >
                                        —
                                      </span>

                                    </td>


                                    <!-- Ubicación -->

                                    <td class="px-4 py-3">

                                      <div
                                        v-if="ej.ubicacionFisica"
                                        class="flex items-center gap-1.5"
                                      >

                                        <svg
                                          class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="1.5"
                                            d="M17.657 16.657L13.414 21a2 2 0 01-2.828 0l-4.243-4.343a8 8 0 1111.314 0z"
                                          />
                                          <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="1.5"
                                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                          />
                                        </svg>

                                        <span
                                          class="text-xs text-slate-500 truncate max-w-[180px]"
                                        >
                                          {{ ej.ubicacionFisica }}
                                        </span>

                                      </div>

                                      <span
                                        v-else
                                        class="text-xs text-slate-300"
                                      >
                                        —
                                      </span>

                                    </td>


                                    <!-- Biblioteca -->

                                    <td
                                      v-if="isAdmin"
                                      class="px-4 py-3"
                                    >

                                      <span
                                        v-if="ej.biblioteca?.nombre"
                                        class="text-xs text-slate-500"
                                      >
                                        {{ ej.biblioteca.nombre }}
                                      </span>

                                      <span
                                        v-else
                                        class="text-xs text-slate-300"
                                      >
                                        —
                                      </span>

                                    </td>


                                    <!-- Estado -->

                                    <td class="px-4 py-3">

                                      <span
                                        :class="[
                                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                                          estadoEjemplarConfig[
                                            ej.estadoEjemplar
                                          ]?.clases ??
                                            'bg-slate-100 text-slate-600'
                                        ]"
                                      >

                                        <span
                                          :class="[
                                            'w-1.5 h-1.5 rounded-full',
                                            estadoEjemplarConfig[
                                              ej.estadoEjemplar
                                            ]?.dot ??
                                              'bg-slate-400'
                                          ]"
                                        />

                                        {{
                                          estadoEjemplarConfig[
                                            ej.estadoEjemplar
                                          ]?.label ??
                                          ej.estadoEjemplar ??
                                          'Sin estado'
                                        }}

                                      </span>

                                    </td>


                                    <!-- Acciones -->

                                    <td class="px-4 py-3">

                                      <div
                                        class="flex items-center justify-end gap-1"
                                      >

                                        <!-- Historial -->

                                        <button
                                          @click.stop="abrirHistorial(ej)"
                                          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                          title="Ver historial"
                                        >

                                          <svg
                                            class="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 01-18 0z"
                                            />
                                          </svg>

                                        </button>


                                        <!-- Cambiar estado -->

                                        <button
                                          @click.stop="abrirEstado(ej)"
                                          :disabled="
                                            ['BAJA', 'PERDIDO'].includes(
                                              ej.estadoEjemplar
                                            )
                                          "
                                          class="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                          title="Cambiar estado"
                                        >

                                          <svg
                                            class="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                            />
                                          </svg>

                                        </button>


                                        <!-- Editar -->

                                        <button
                                          @click.stop="abrirEditar(ej)"
                                          :disabled="
                                            ['BAJA', 'PERDIDO'].includes(
                                              ej.estadoEjemplar
                                            )
                                          "
                                          class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                          title="Editar ejemplar"
                                        >

                                          <svg
                                            class="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 0011-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                          </svg>

                                        </button>


                                        <!-- PDF -->

                                        <button
                                          v-if="ej.edicion?.pdfUrl"
                                          @click.stop="verPdf(ej.edicion.pdfUrl)"
                                          class="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                          title="Ver PDF"
                                        >

                                          <svg
                                            class="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                            />
                                          </svg>

                                        </button>

                                      </div>

                                    </td>

                                  </tr>


                                  <!-- ═════════════════════════════════
                                      SIN EJEMPLARES
                                  ══════════════════════════════════ -->

                                  <tr
                                    v-if="!libro.ejemplares?.length"
                                  >

                                    <td
                                      :colspan="isAdmin ? 6 : 5"
                                      class="px-6 py-8"
                                    >

                                      <div
                                        class="flex flex-col items-center justify-center"
                                      >

                                        <div
                                          class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2"
                                        >

                                          <svg
                                            class="w-5 h-5 text-slate-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="1.5"
                                              d="M4 6h16M4 10h16M4 14h16M4 18h16"
                                            />
                                          </svg>

                                        </div>

                                        <p class="text-sm font-medium text-slate-600">
                                          Sin ejemplares registrados
                                        </p>

                                        <p class="text-xs text-slate-400 mt-0.5">
                                          Este libro todavía no tiene ejemplares físicos.
                                        </p>

                                      </div>

                                    </td>

                                  </tr>

                                </tbody>

                              </table>

                            </div>

                          </div>

                        </div>

                      </div>

                    </td>

                  </tr>

                </template>


                <!-- ═══════════════════════════════════════════════
                    SIN LIBROS
                ═══════════════════════════════════════════════ -->

                <tr v-if="!librosPagina.length">

                  <td
                    :colspan="isAdmin ? 7 : 6"
                    class="px-6 py-14"
                  >

                    <div class="flex flex-col items-center text-center">

                      <div
                        class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3"
                      >

                        <svg
                          class="w-6 h-6 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>

                      </div>

                      <p class="font-medium text-slate-700">
                        No hay libros
                      </p>

                      <p class="text-sm text-slate-400 mt-1">
                        No se encontraron libros para mostrar.
                      </p>

                    </div>

                  </td>

                </tr>

              </tbody>

            </table>

          </div>

        </div>


        <!-- ═══════════════════════════════════════════════════════
            PAGINACIÓN
        ═════════════════════════════════════════════════════════ -->

        <div
          v-if="totalPaginasLib > 1"
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4"
        >

          <!-- Resumen -->

          <p class="text-xs text-slate-500">

            Mostrando

            <span class="font-medium text-slate-700">
              {{ (paginaLib - 1) * porPaginaLib + 1 }}
            </span>

            –

            <span class="font-medium text-slate-700">
              {{
                Math.min(
                  paginaLib * porPaginaLib,
                  librosAgrupados.length
                )
              }}
            </span>

            de

            <span class="font-medium text-slate-700">
              {{ librosAgrupados.length }}
            </span>

            libros

          </p>


          <!-- Controles -->

          <div class="flex items-center gap-1">

            <!-- Anterior -->

            <button
              @click="paginaLib--"
              :disabled="paginaLib === 1"
              class="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página anterior"
            >

              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>

            </button>


            <!-- Números -->

            <template
              v-for="p in totalPaginasLib"
              :key="p"
            >

              <button
                v-if="
                  Math.abs(p - paginaLib) <= 2 ||
                  p === 1 ||
                  p === totalPaginasLib
                "
                @click="paginaLib = p"
                :class="[
                  'min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition-colors',
                  p === paginaLib
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                ]"
              >
                {{ p }}
              </button>

              <span
                v-else-if="Math.abs(p - paginaLib) === 3"
                class="text-slate-400 text-sm px-1"
              >
                …
              </span>

            </template>


            <!-- Siguiente -->

            <button
              @click="paginaLib++"
              :disabled="paginaLib === totalPaginasLib"
              class="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página siguiente"
            >

              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7-7"
                />
              </svg>

            </button>

          </div>

        </div>

      </template>

    </template>

    <!-- ═══════════════════════════════════════════════════════════════
         MODALES
    ════════════════════════════════════════════════════════════════ -->

    <div v-if="pdfActivo" class="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div class="bg-white w-[80%] h-[80%] rounded-lg overflow-hidden">
        <iframe :src="getUrl(pdfActivo)" class="w-full h-full"></iframe>

        <button @click="pdfActivo = null">Cerrar</button>
      </div>
    </div>
    <LibroLoteFormModal v-if="modalActivo === 'crear'" @close="cerrarModal" @saved="onGuardado" />
    <Libroeditarmodal v-if="modalActivo === 'editar'" @close="cerrarModal" @saved="onGuardado" :libroId="libroId" />

    <LibroModal v-if="mostrarLibroModal" @close="mostrarLibroModal = false" @saved="cargarEjemplares" />
    <!-- vista actual -->
    <LibroRapidoModal v-if="mostrarLibroModalRapido" :libro-id="ejemplarSeleccionado"
      @close="mostrarLibroModalRapido = false" @saved="onGuardado" />
    <!-- Crear / Editar ejemplar -->
    <!-- <EjemplarFormModalInventario v-if="modalActivo === 'form'" :ejemplar="ejemplarEditando" @close="cerrarModal"
      @saved="onGuardado" /> -->

    <!-- <LibroFormModal v-if="mostrarFormModal" :key="mostrarFormModal ? 'open' : 'closed'" :libro="libroParaEditar"
      :categorias="categorias" @close="cerrarFormModal" @saved="onLibroGuardado" /> -->
    <!-- Cambiar estado -->
    <EjemplarEstadoModal v-if="modalActivo === 'estado' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
      @close="cerrarModal" @saved="onEstadoCambiado" />

    <!-- Historial -->
    <EjemplarHistorialModal v-if="modalActivo === 'historial' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
      @close="cerrarModal" />

    <!-- Confirmar eliminar -->
    <ConfirmModal :model-value="modalActivo === 'confirmarEliminar'" title="¿Eliminar ejemplar?" variant="danger"
      confirm-label="Sí, eliminar" :loading="eliminando" @confirm="confirmarEliminar"
      @update:model-value="(v) => { if (!v) cerrarModal() }">
      Se eliminará permanentemente el ejemplar
      <span class="font-semibold text-slate-800">
        "{{ ejemplarSeleccionado?.codigoEjemplar }}"
      </span>.
      <span class="text-xs text-slate-400 mt-2 block">Esta acción no se puede deshacer.</span>
    </ConfirmModal>

  </div>
</template>