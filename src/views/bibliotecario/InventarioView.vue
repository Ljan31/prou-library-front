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
// ─── Biblioteca del usuario logueado ──────────────────────────────────────
const bibliotecaPropia = computed<BibliotecaOpcion | null>(() => {
  const lista = auth.user?.biblioteca
  if (!lista || lista.length === 0) return null

  const bib = lista[0] // 👈 tomas la primera

  const id = (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number | undefined
  const nombre = (bib.nombre ?? bib.name) as string | undefined

  return id && nombre ? { id, nombre } : null
})
onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Inventario' },
  ])
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
// ─── Carga de datos ───────────────────────────────────────────────────────
const cargando = ref(false)
const error = ref<string | null>(null)
const todos = ref<Ejemplar[]>([])

async function cargarEjemplares() {
  cargando.value = true
  error.value = null
  try {
    if (isBibliotecario.value && !isAdmin.value && bibliotecaPropia.value) {
      // Bibliotecario: solo ve su biblioteca
      todos.value = await obtenerEjemplaresPorBiblioteca(bibliotecaPropia.value.id)
      console.log('ejemplares', todos.value)
    } else {
      // Admin: todos los ejemplares
      todos.value = await obtenerEjemplares()
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
  let lista = todos.value
  if (busqueda.value.trim()) {
    const q = busqueda.value.toLowerCase()
    lista = lista.filter(e =>
      e.codigoEjemplar?.toLowerCase().includes(q) ||
      e.codigoTopografico?.toLowerCase().includes(q) ||
      e.ubicacionFisica?.toLowerCase().includes(q) ||
      e.edicion?.isbn?.toLowerCase().includes(q) ||
      e.edicion?.titulo?.toLowerCase().includes(q)
    )
  }
  if (estadoFiltro.value) {
    lista = lista.filter(e => e.estadoEjemplar === estadoFiltro.value)
  }
  return lista
})

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
}

function irANuevoEjemplar() {
  router.push('/nuevo-ejemplar')
}

function abrirCrear() {
  ejemplarEditando.value = null
  modalActivo.value = 'crear'
}

function abrirEditar(e: Ejemplar) {
  console.log('editar', e)
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
    await api.delete(`/api/ejemplares/${ejemplarSeleccionado.value.idEjemplar}`)
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
</script>

<template>
  <div class="page-container">

    <!-- ── Header ── -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Inventario de Ejemplares</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ ejemplaresFiltrados.length }} ejemplar{{ ejemplaresFiltrados.length !== 1 ? 'es' : '' }}
          <template v-if="isBibliotecario && !isAdmin && bibliotecaPropia">
            · <span class="text-indigo-600 font-medium">{{ bibliotecaPropia.nombre }}</span>
          </template>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <!-- Exportar CSV -->
        <button @click="exportarCSV"
          class="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          title="Exportar a CSV">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar
        </button>

        <!-- Nuevo ejemplar: admin siempre, bibliotecario si tiene biblioteca -->
        <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="abrirCrear" variant="primary">
          <!-- <SButton v-if="isAdmin || (isBibliotecario && bibliotecaPropia)" @click="irANuevoEjemplar" variant="primary"> -->
          <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo ejemplar
        </SButton>
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
    <SEmptyState v-else-if="!ejemplaresFiltrados.length" title="Sin ejemplares"
      description="No se encontraron ejemplares con los filtros aplicados." icon="archive-box">
      <template #action>
        <SButton variant="ghost" size="sm" @click="busqueda = ''; estadoFiltro = ''">
          Limpiar filtros
        </SButton>
      </template>
    </SEmptyState>

    <!-- ── Lista de ejemplares ── -->
    <div v-else class="space-y-2">
      <div v-for="ej in ejemplaresFiltrados" :key="ej.idEjemplar"
        class="flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all">
        <!-- Estado dot + badge -->

        <div class="flex-shrink-0">
          <!-- <img v-if="ej.edicion?.imagenPortada" :src="ej.edicion.imagenPortada" alt="Portada"
            class="w-12 h-16 object-cover rounded-md border border-slate-200 shadow-sm" /> -->
          <img v-if="ej.edicion?.imagenPortada" :src="getUrl(ej.edicion.imagenPortada)" alt="Portada"
            class="w-12 h-16 object-cover rounded-md border border-slate-200 shadow-sm" />
          <div v-else
            class="w-12 h-16 bg-slate-100 rounded-md border border-slate-200 flex items-center justify-center text-xs text-slate-400">
            —
          </div>
        </div>

        <!-- Info principal -->
        <div class="flex-1 min-w-0">
          <div class="mb-1">
            <span :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              estadoEjemplarConfig[ej.estadoEjemplar]?.clases ?? 'bg-slate-100 text-slate-600']">

              <span :class="['w-1.5 h-1.5 rounded-full',
                estadoEjemplarConfig[ej.estadoEjemplar]?.dot ?? 'bg-slate-400']" />

              {{ estadoEjemplarConfig[ej.estadoEjemplar]?.label ?? ej.estadoEjemplar }}
            </span>
          </div>
          <!-- Fila 1: código + ISBN -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono text-sm font-semibold text-slate-900">{{ ej.codigoEjemplar }}</span>
            <span class="text-slate-300 text-xs">|</span>
            <span class="text-xs text-slate-500 font-mono">{{ ej.codigoTopografico }}</span>
            <template v-if="ej.edicion?.isbn">
              <span class="text-slate-300 text-xs">·</span>
              <span class="text-xs text-indigo-600 font-mono">{{ ej.edicion.isbn }}</span>
            </template>
          </div>
          <!-- Fila 2: libro + ubicación + biblioteca -->
          <div class="flex items-center gap-2 flex-wrap mt-0.5">
            <span v-if="ej.edicion?.titulo" class="text-xs text-slate-700 truncate max-w-xs">
              {{ ej.edicion.titulo }}
            </span>
            <template v-if="ej.ubicacionFisica">
              <span class="text-slate-300 text-xs">·</span>
              <span class="text-xs text-slate-500">{{ ej.ubicacionFisica }}</span>
            </template>
            <!-- Solo admin ve la biblioteca (el bibliotecario ya sabe cuál es la suya) -->
            <template v-if="isAdmin && ej.biblioteca?.nombre">
              <span class="text-slate-300 text-xs">·</span>
              <span class="text-xs text-slate-400">{{ ej.biblioteca.nombre }}</span>
            </template>
          </div>
        </div>

        <!-- Precio + fecha (columna secundaria, oculta en móvil) -->
        <div class="hidden md:block text-right flex-shrink-0">
          <p class="text-sm text-slate-700">
            {{ ej.precioCompra != null ? `Bs. ${ej.precioCompra.toFixed(2)}` : '—' }}
          </p>
          <p class="text-xs text-slate-400">{{ ej.fechaAdquisicion ?? '—' }}</p>
        </div>

        <!-- Acciones -->
        <div class="flex items-center gap-1 flex-shrink-0">

          <!-- Historial -->
          <button @click="abrirHistorial(ej)"
            class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Historial de estados">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <!-- Cambiar estado -->
          <button @click="abrirEstado(ej)" :disabled="['BAJA', 'PERDIDO'].includes(ej.estadoEjemplar)"
            class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Cambiar estado">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>

          <!-- Editar -->
          <button @click="abrirEditar(ej)" :disabled="['BAJA', 'PERDIDO'].includes(ej.estadoEjemplar)"
            class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Editar">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <!-- Transferir (solo admin) -->
          <button v-if="isAdmin" @click="abrirTransferir(ej)"
            :disabled="['BAJA', 'PERDIDO', 'PRESTADO'].includes(ej.estadoEjemplar)"
            class="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Transferir a otra biblioteca">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button v-if="ej.edicion?.pdfUrl" @click="verPdf(ej.edicion.pdfUrl)"
            class="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Ver PDF">
            📄
          </button>
          <!-- Eliminar (solo admin, y si no está prestado) -->
          <button v-if="isAdmin" @click="abrirConfirmarEliminar(ej)"
            :disabled="!!ej.prestamoActivo || ej.estadoEjemplar === 'PRESTADO'"
            class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Eliminar">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

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

    <!-- Transferir a otra biblioteca (solo admin) -->
    <Teleport to="body" v-if="modalActivo === 'transferir' && ejemplarSeleccionado">
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="cerrarModal">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div>
              <h2 class="text-base font-semibold text-slate-900">Transferir ejemplar</h2>
              <p class="text-xs text-slate-500 mt-0.5 font-mono">{{ ejemplarSeleccionado.codigoEjemplar }}</p>
            </div>
            <button @click="cerrarModal"
              class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-4">
            <!-- Info del ejemplar actual -->
            <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div class="flex-1">
                <p class="text-xs text-slate-500">Biblioteca actual</p>
                <p class="text-sm font-medium text-slate-900">
                  {{ ejemplarSeleccionado.biblioteca?.nombre ?? 'Sin biblioteca' }}
                </p>
              </div>
              <svg class="w-5 h-5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>

            <!-- ID de nueva biblioteca (en un sistema real sería un select cargado) -->
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">ID de la biblioteca destino *</label>
              <input v-model.number="nuevaBibliotecaId" type="number" placeholder="Ej. 3"
                class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p class="text-xs text-slate-400 mt-1">
                Ingresa el ID de la biblioteca a la que se transferirá el ejemplar.
              </p>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Motivo *</label>
              <textarea v-model="motivoTransferir" rows="2" placeholder="Redistribución de recursos..."
                class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            <p v-if="errorTransferir" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {{ errorTransferir }}
            </p>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button @click="cerrarModal"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button @click="confirmarTransferir" :disabled="transfiriendo || !nuevaBibliotecaId"
              class="px-5 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
              <svg v-if="transfiriendo" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Transferir
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>