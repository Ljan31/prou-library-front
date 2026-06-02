<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/services/axios'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SButton from '@/components/ui/SButton.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'

const ui = useUiStore()
const auth = useAuthStore()

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Reportes' }])
  if (auth.isAdmin) fetchBibliotecas()
})

// ─── tipos ───────────────────────────────────────────────────────────────────

interface ResumenInventario {
  totalEjemplares: number
  disponibles: number
  prestados: number
  reservados: number
  deteriorados: number
  perdidos: number
}

interface DetalleEjemplar {
  idEjemplar: number
  codigoEjemplar: string
  tituloLibro: string
  isbn: string
  biblioteca: string
  estado: string
  clasificacionDecimal: string
  ubicacionFisica: string
}

interface ResumenPrestamos {
  totalPrestamos: number
  activos: number
  vencidos: number
  devueltos: number
  renovados: number
}

interface DetallePrestamo {
  idPrestamo: number
  usuario: string
  ci: string
  libro: string
  isbn: string
  biblioteca: string
  fechaPrestamo: string
  fechaDevolucionEstimada: string
  fechaDevolucionReal: string | null
  estadoPrestamo: string
  tipoPrestamo: string
  diasRetraso: number
}

interface LibroMasPrestado {
  libroId: number
  titulo: string
  isbn: string
  cantidadPrestamos: number
}

interface EstadoEjemplarBiblioteca {
  biblioteca: string
  disponibles: number
  prestados: number
  reservados: number
  reparacion: number
  perdidos: number
  danados: number
  deteriorados: number
  bajas: number
}

// ─── Bibliotecas ─────────────────────────────────────────────────────────────

const bibliotecas = ref<{ id: number; nombre: string }[]>([])

async function fetchBibliotecas() {
  try {
    const res = await api.get('/bibliotecas')
    bibliotecas.value = res.data?.data ?? res.data ?? []
  } catch { /* silencioso */ }
}

// ─── Estado de la vista ───────────────────────────────────────────────────────

type TipoReporte = 'inventario' | 'prestamos' | 'libros-mas-prestados' | 'estado-ejemplares'
type PasoVista = 'configurar' | 'previsualizar'

const paso = ref<PasoVista>('configurar')

// ─── Formulario ──────────────────────────────────────────────────────────────

const TIPOS_REPORTE: { value: TipoReporte; label: string; descripcion: string; icon: string }[] = [
  {
    value: 'inventario',
    label: 'Inventario',
    descripcion: 'Ejemplares con estado, ubicación y categoría',
    icon: 'ti-archive-box',
  },
  {
    value: 'prestamos',
    label: 'Préstamos',
    descripcion: 'Listado filtrado por estado y fechas',
    icon: 'ti-arrow-right-circle',
  },
  {
    value: 'libros-mas-prestados',
    label: 'Más prestados',
    descripcion: 'Ranking de libros por cantidad de préstamos',
    icon: 'ti-chart-bar',
  },
  {
    value: 'estado-ejemplares',
    label: 'Estado por biblioteca',
    descripcion: 'Distribución de ejemplares por estado en cada sede',
    icon: 'ti-building-library',
  },
]

const ESTADOS_PRESTAMO = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'DEVUELTO', label: 'Devuelto' },
  { value: 'VENCIDO', label: 'Vencido' },
  { value: 'RENOVADO', label: 'Renovado' },
]

const ESTADOS_EJEMPLAR = [
  { value: '', label: 'Todos los estados' },
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'PRESTADO', label: 'Prestado' },
  { value: 'RESERVADO', label: 'Reservado' },
  { value: 'EN_REPARACION', label: 'En reparación' },
  { value: 'BAJA', label: 'Baja' },
  { value: 'PERDIDO', label: 'Perdido' },
  { value: 'DETERIORADO', label: 'Deteriorado' },
  { value: 'DAÑADO', label: 'Dañado' },
]

const biblId =
  auth.user?.biblioteca?.id_biblioteca ??
  auth.user?.biblioteca?.[0]?.id_biblioteca ??
  null

const form = ref({
  tipo: '' as TipoReporte | '',
  bibliotecaId: biblId as number | null,
  estadoPrestamo: '',
  estadoEjemplar: '',
  fechaInicio: '',
  fechaFin: '',
})

const tipoSeleccionado = computed(() =>
  TIPOS_REPORTE.find(t => t.value === form.value.tipo) ?? null
)

const mostrarEstadoPrestamo = computed(() => form.value.tipo === 'prestamos')
const mostrarEstadoEjemplar = computed(() => form.value.tipo === 'inventario')
const mostrarFechas = computed(() => form.value.tipo === 'prestamos')

const formValido = computed(() => !!form.value.tipo)

// ─── Datos previo visualización ───────────────────────────────────────────────

const loadingPreview = ref(false)
const previewError = ref<string | null>(null)

// Datos según tipo
const inventarioResumen = ref<ResumenInventario | null>(null)
const inventarioDetalle = ref<DetalleEjemplar[]>([])

const prestamosResumen = ref<ResumenPrestamos | null>(null)
const prestamosDetalle = ref<DetallePrestamo[]>([])

const librosMasPrestados = ref<{ resumen: { totalLibros: number; totalPrestamos: number }; libros: LibroMasPrestado[] } | null>(null)

const estadoEjemplares = ref<{ resumen: { totalBibliotecas: number; totalEjemplares: number }; bibliotecas: EstadoEjemplarBiblioteca[] } | null>(null)

function resetPreview() {
  inventarioResumen.value = null
  inventarioDetalle.value = []
  prestamosResumen.value = null
  prestamosDetalle.value = []
  librosMasPrestados.value = null
  estadoEjemplares.value = null
  previewError.value = null
}

async function generarPreview() {
  if (!formValido.value) return
  resetPreview()
  loadingPreview.value = true
  previewError.value = null

  try {
    const tipo = form.value.tipo as TipoReporte

    if (tipo === 'inventario') {
      const params: Record<string, unknown> = {}
      if (form.value.bibliotecaId) params.bibliotecaId = form.value.bibliotecaId
      if (form.value.estadoEjemplar) params.estado = form.value.estadoEjemplar
      const res = await api.get('/reportes/inventario', { params })
      const data = res.data?.data ?? res.data
      inventarioResumen.value = data.resumen
      inventarioDetalle.value = data.detalle ?? []
    }

    else if (tipo === 'prestamos') {
      const body: Record<string, unknown> = {}
      if (form.value.bibliotecaId) body.bibliotecaId = Number(form.value.bibliotecaId)
      if (form.value.estadoPrestamo) body.estado = form.value.estadoPrestamo
      if (form.value.fechaInicio) body.fechaInicio = form.value.fechaInicio
      if (form.value.fechaFin) body.fechaFin = form.value.fechaFin
      const res = await api.post('/reportes/prestamos', body)
      const data = res.data?.data ?? res.data
      prestamosResumen.value = data.resumen
      prestamosDetalle.value = data.prestamos ?? []
    }

    else if (tipo === 'libros-mas-prestados') {
      const params: Record<string, unknown> = {}
      if (form.value.bibliotecaId) params.bibliotecaId = form.value.bibliotecaId
      const res = await api.get('/reportes/libros-mas-prestados', { params })
      librosMasPrestados.value = res.data?.data ?? res.data
    }

    else if (tipo === 'estado-ejemplares') {
      const params: Record<string, unknown> = {}
      if (form.value.bibliotecaId) params.bibliotecaId = form.value.bibliotecaId
      const res = await api.get('/reportes/estado-ejemplares', { params })
      estadoEjemplares.value = res.data?.data ?? res.data
    }

    paso.value = 'previsualizar'
  } catch (e: any) {
    previewError.value = e?.response?.data?.message ?? 'Error al obtener los datos del reporte'
    ui.toast.error('Error', previewError.value ?? 'No se pudo cargar la vista previa')
  } finally {
    loadingPreview.value = false
  }
}

// ─── Descarga ─────────────────────────────────────────────────────────────────

const loadingDescarga = ref(false)

function formatoFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function badgeEstado(estado: string): string {
  const map: Record<string, string> = {
    ACTIVO: 'bg-emerald-100 text-emerald-800',
    DEVUELTO: 'bg-slate-100 text-slate-700',
    VENCIDO: 'bg-red-100 text-red-700',
    RENOVADO: 'bg-blue-100 text-blue-700',
    DISPONIBLE: 'bg-emerald-100 text-emerald-800',
    PRESTADO: 'bg-amber-100 text-amber-800',
    RESERVADO: 'bg-sky-100 text-sky-800',
    EN_REPARACION: 'bg-orange-100 text-orange-800',
    BAJA: 'bg-slate-200 text-slate-600',
    PERDIDO: 'bg-red-100 text-red-700',
    DETERIORADO: 'bg-yellow-100 text-yellow-800',
    DAÑADO: 'bg-rose-100 text-rose-700',
  }
  return map[estado] ?? 'bg-slate-100 text-slate-700'
}

// Máx préstamos para la barra del ranking
const maxPrestamos = computed(() =>
  librosMasPrestados.value
    ? Math.max(...(librosMasPrestados.value.libros.map(l => l.cantidadPrestamos)), 1)
    : 1
)

function descargarCSV() {
  loadingDescarga.value = true
  try {
    let csv = ''
    const tipo = form.value.tipo as TipoReporte

    if (tipo === 'inventario') {
      csv = 'ID,Código,Título,ISBN,Biblioteca,Estado,Clasificación,Ubicación\n'
      csv += inventarioDetalle.value
        .map(e => `${e.idEjemplar},"${e.codigoEjemplar}","${e.tituloLibro}","${e.isbn}","${e.biblioteca}","${e.estado}","${e.clasificacionDecimal}","${e.ubicacionFisica}"`)
        .join('\n')
    } else if (tipo === 'prestamos') {
      csv = 'ID,Usuario,CI,Libro,ISBN,Biblioteca,Fecha Préstamo,Fecha Estimada,Fecha Real,Estado,Tipo,Días Retraso\n'
      csv += prestamosDetalle.value
        .map(p => `${p.idPrestamo},"${p.usuario}","${p.ci}","${p.libro}","${p.isbn}","${p.biblioteca}","${p.fechaPrestamo}","${p.fechaDevolucionEstimada}","${p.fechaDevolucionReal ?? ''}","${p.estadoPrestamo}","${p.tipoPrestamo}",${p.diasRetraso}`)
        .join('\n')
    } else if (tipo === 'libros-mas-prestados') {
      csv = 'ID,Título,ISBN,Cantidad Préstamos\n'
      csv += (librosMasPrestados.value?.libros ?? [])
        .map(l => `${l.libroId},"${l.titulo}","${l.isbn}",${l.cantidadPrestamos}`)
        .join('\n')
    } else if (tipo === 'estado-ejemplares') {
      csv = 'Biblioteca,Disponibles,Prestados,Reservados,Reparación,Perdidos,Dañados,Deteriorados,Bajas\n'
      csv += (estadoEjemplares.value?.bibliotecas ?? [])
        .map(b => `"${b.biblioteca}",${b.disponibles},${b.prestados},${b.reservados},${b.reparacion},${b.perdidos},${b.danados},${b.deteriorados},${b.bajas}`)
        .join('\n')
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ui.toast.success('Descarga completada', 'El archivo CSV fue generado correctamente')
  } catch {
    ui.toast.error('Error', 'No se pudo generar el archivo')
  } finally {
    loadingDescarga.value = false
  }
}

function volverAConfigurar() {
  paso.value = 'configurar'
  resetPreview()
}
</script>

<template>
  <div class="page-container">

    <!-- ─── Header ──────────────────────────────────────────────────────────── -->
    <div class="flex items-start justify-between gap-4 flex-wrap mb-7">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Reportes</h1>
        <p class="text-sm text-slate-500 mt-0.5">Genera y previsualiza reportes antes de exportar</p>
      </div>
      <div v-if="paso === 'previsualizar'" class="flex items-center gap-2">
        <SButton variant="secondary" size="sm" @click="volverAConfigurar">
          <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Volver a configurar
        </SButton>
        <SButton
          size="sm"
          :loading="loadingDescarga"
          @click="descargarCSV"
        >
          <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Descargar CSV
        </SButton>
      </div>
    </div>

    <!-- ─── Paso 1: Configuración ────────────────────────────────────────────── -->
    <template v-if="paso === 'configurar'">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <!-- Selección de tipo (izquierda) -->
        <div class="lg:col-span-2 space-y-3">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tipo de reporte</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-for="tipo in TIPOS_REPORTE"
              :key="tipo.value"
              class="flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-150"
              :class="form.tipo === tipo.value
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
              @click="form.tipo = tipo.value"
            >
              <div
                class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                :class="form.tipo === tipo.value ? 'bg-indigo-100' : 'bg-slate-100'"
              >
                <i
                  :class="[tipo.icon, 'text-lg', form.tipo === tipo.value ? 'text-indigo-600' : 'text-slate-500']"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p
                  class="text-sm font-semibold"
                  :class="form.tipo === tipo.value ? 'text-indigo-700' : 'text-slate-800'"
                >{{ tipo.label }}</p>
                <p class="text-xs text-slate-500 mt-0.5 leading-snug">{{ tipo.descripcion }}</p>
              </div>
              <div v-if="form.tipo === tipo.value" class="ml-auto">
                <svg class="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- Filtros (derecha) -->
        <SCard variant="bordered" padding="lg">
          <h2 class="text-sm font-semibold text-slate-800 mb-4">Filtros</h2>
          <div class="space-y-4">

            <!-- Biblioteca -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Biblioteca
                <span class="text-slate-400 font-normal">(opcional)</span>
              </label>
              <select
                v-model="form.bibliotecaId"
                :disabled="auth.isBibliotecario"
                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Todas las bibliotecas</option>
                <option v-for="b in bibliotecas" :key="b.id" :value="b.id">{{ b.nombre }}</option>
              </select>
              <p v-if="auth.isBibliotecario" class="text-xs text-slate-400 mt-1">
                Solo puedes ver tu biblioteca asignada.
              </p>
            </div>

            <!-- Estado préstamo -->
            <div v-if="mostrarEstadoPrestamo">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Estado del préstamo</label>
              <select
                v-model="form.estadoPrestamo"
                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option v-for="e in ESTADOS_PRESTAMO" :key="e.value" :value="e.value">{{ e.label }}</option>
              </select>
            </div>

            <!-- Estado ejemplar -->
            <div v-if="mostrarEstadoEjemplar">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Estado del ejemplar</label>
              <select
                v-model="form.estadoEjemplar"
                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option v-for="e in ESTADOS_EJEMPLAR" :key="e.value" :value="e.value">{{ e.label }}</option>
              </select>
            </div>

            <!-- Rango de fechas -->
            <template v-if="mostrarFechas">
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1.5">Fecha desde</label>
                <input
                  v-model="form.fechaInicio"
                  type="date"
                  class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1.5">Fecha hasta</label>
                <input
                  v-model="form.fechaFin"
                  type="date"
                  class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </template>

            <!-- Sin filtros disponibles -->
            <div
              v-if="!mostrarEstadoPrestamo && !mostrarEstadoEjemplar && !mostrarFechas && !form.tipo"
              class="py-4 text-center"
            >
              <i class="ti ti-filter text-2xl text-slate-300 block mb-2" aria-hidden="true"/>
              <p class="text-xs text-slate-400">Selecciona un tipo de reporte para ver los filtros disponibles.</p>
            </div>
          </div>

          <!-- Error -->
          <div
            v-if="previewError"
            class="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
          >
            <i class="ti ti-alert-circle text-sm shrink-0 mt-0.5" aria-hidden="true"/>
            {{ previewError }}
          </div>

          <!-- Acción -->
          <div class="mt-5 pt-4 border-t border-slate-100">
            <SButton
              :disabled="!formValido || loadingPreview"
              :loading="loadingPreview"
              :full="true"
              @click="generarPreview"
            >
              <template v-if="!loadingPreview">
                <i class="ti ti-eye mr-1.5" aria-hidden="true"/>
              </template>
              Previsualizar reporte
            </SButton>
            <p class="text-xs text-slate-400 text-center mt-2">
              Verás los datos antes de descargar
            </p>
          </div>
        </SCard>
      </div>
    </template>

    <!-- ─── Paso 2: Vista Previa ──────────────────────────────────────────────── -->
    <template v-else-if="paso === 'previsualizar'">

      <!-- Loading skeleton -->
      <template v-if="loadingPreview">
        <div class="space-y-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SCard v-for="i in 4" :key="i" padding="lg">
              <SSkeleton width="60%" height="0.7rem" class="mb-2"/>
              <SSkeleton width="40%" height="1.75rem"/>
            </SCard>
          </div>
          <SCard padding="lg">
            <SSkeleton width="100%" height="1rem" class="mb-3"/>
            <SSkeleton v-for="j in 6" :key="j" width="100%" height="0.8rem" class="mb-2"/>
          </SCard>
        </div>
      </template>

      <!-- ── Inventario ────────────────────────────────────────────────────── -->
      <template v-else-if="form.tipo === 'inventario'">
        <!-- Chips de resumen -->
        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-slate-500 mb-1">Total</p>
            <p class="text-2xl font-bold text-slate-900 tabular-nums">{{ inventarioResumen?.totalEjemplares?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-emerald-600 mb-1">Disponibles</p>
            <p class="text-2xl font-bold text-emerald-700 tabular-nums">{{ inventarioResumen?.disponibles?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-amber-600 mb-1">Prestados</p>
            <p class="text-2xl font-bold text-amber-700 tabular-nums">{{ inventarioResumen?.prestados?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-sky-600 mb-1">Reservados</p>
            <p class="text-2xl font-bold text-sky-700 tabular-nums">{{ inventarioResumen?.reservados?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-yellow-600 mb-1">Deteriorados</p>
            <p class="text-2xl font-bold text-yellow-700 tabular-nums">{{ inventarioResumen?.deteriorados?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-red-600 mb-1">Perdidos</p>
            <p class="text-2xl font-bold text-red-700 tabular-nums">{{ inventarioResumen?.perdidos?.toLocaleString() ?? '—' }}</p>
          </SCard>
        </div>

        <!-- Tabla de detalle -->
        <SCard variant="bordered" padding="lg">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-800">Detalle de ejemplares</h2>
            <SBadge variant="info">{{ inventarioDetalle.length }} registros</SBadge>
          </div>

          <SEmptyState v-if="!inventarioDetalle.length" title="Sin ejemplares" description="No hay registros para los filtros aplicados." icon="book" size="sm"/>

          <div v-else class="overflow-x-auto -mx-2">
            <table class="w-full text-sm min-w-[700px]">
              <thead>
                <tr class="border-b border-slate-100">
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Código</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Título</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Biblioteca</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Clasificación</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Ubicación</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="ej in inventarioDetalle"
                  :key="ej.idEjemplar"
                  class="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2.5 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">{{ ej.codigoEjemplar }}</td>
                  <td class="py-2.5 px-3 text-slate-800 font-medium max-w-[200px] truncate">{{ ej.tituloLibro }}</td>
                  <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap text-xs">{{ ej.biblioteca }}</td>
                  <td class="py-2.5 px-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(ej.estado)">
                      {{ ej.estado }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ ej.clasificacionDecimal }}</td>
                  <td class="py-2.5 px-3 text-slate-600 text-xs">{{ ej.ubicacionFisica }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SCard>
      </template>

      <!-- ── Préstamos ─────────────────────────────────────────────────────── -->
      <template v-else-if="form.tipo === 'prestamos'">
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-slate-500 mb-1">Total</p>
            <p class="text-2xl font-bold text-slate-900 tabular-nums">{{ prestamosResumen?.totalPrestamos?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-emerald-600 mb-1">Activos</p>
            <p class="text-2xl font-bold text-emerald-700 tabular-nums">{{ prestamosResumen?.activos?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-red-600 mb-1">Vencidos</p>
            <p class="text-2xl font-bold text-red-700 tabular-nums">{{ prestamosResumen?.vencidos?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-slate-500 mb-1">Devueltos</p>
            <p class="text-2xl font-bold text-slate-700 tabular-nums">{{ prestamosResumen?.devueltos?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-blue-600 mb-1">Renovados</p>
            <p class="text-2xl font-bold text-blue-700 tabular-nums">{{ prestamosResumen?.renovados?.toLocaleString() ?? '—' }}</p>
          </SCard>
        </div>

        <SCard variant="bordered" padding="lg">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-800">Detalle de préstamos</h2>
            <SBadge variant="info">{{ prestamosDetalle.length }} registros</SBadge>
          </div>

          <SEmptyState v-if="!prestamosDetalle.length" title="Sin préstamos" description="No hay préstamos para los filtros aplicados." icon="book" size="sm"/>

          <div v-else class="overflow-x-auto -mx-2">
            <table class="w-full text-sm min-w-[820px]">
              <thead>
                <tr class="border-b border-slate-100">
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">#</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Usuario</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">CI</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Libro</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">F. Préstamo</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">F. Estimada</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Tipo</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Días retraso</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in prestamosDetalle"
                  :key="p.idPrestamo"
                  class="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2.5 px-3 text-xs text-slate-400 tabular-nums">{{ p.idPrestamo }}</td>
                  <td class="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{{ p.usuario }}</td>
                  <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ p.ci }}</td>
                  <td class="py-2.5 px-3 text-slate-700 max-w-[160px] truncate">{{ p.libro }}</td>
                  <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ formatoFecha(p.fechaPrestamo) }}</td>
                  <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ formatoFecha(p.fechaDevolucionEstimada) }}</td>
                  <td class="py-2.5 px-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(p.estadoPrestamo)">
                      {{ p.estadoPrestamo }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-xs text-slate-600">{{ p.tipoPrestamo }}</td>
                  <td class="py-2.5 px-3 text-right">
                    <span
                      v-if="p.diasRetraso > 0"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                    >
                      +{{ p.diasRetraso }}d
                    </span>
                    <span v-else class="text-xs text-slate-400">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SCard>
      </template>

      <!-- ── Libros más prestados ───────────────────────────────────────────── -->
      <template v-else-if="form.tipo === 'libros-mas-prestados'">
        <div class="grid grid-cols-2 gap-3 mb-5 max-w-sm">
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-slate-500 mb-1">Libros únicos</p>
            <p class="text-2xl font-bold text-slate-900 tabular-nums">{{ librosMasPrestados?.resumen?.totalLibros?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-indigo-600 mb-1">Total préstamos</p>
            <p class="text-2xl font-bold text-indigo-700 tabular-nums">{{ librosMasPrestados?.resumen?.totalPrestamos?.toLocaleString() ?? '—' }}</p>
          </SCard>
        </div>

        <SCard variant="bordered" padding="lg">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-sm font-semibold text-slate-800">Ranking de libros</h2>
            <SBadge variant="info">{{ librosMasPrestados?.libros?.length ?? 0 }} libros</SBadge>
          </div>

          <SEmptyState v-if="!librosMasPrestados?.libros?.length" title="Sin datos" description="No hay préstamos registrados para este reporte." icon="chart" size="sm"/>

          <div v-else class="space-y-3">
            <div
              v-for="(libro, idx) in librosMasPrestados.libros"
              :key="libro.libroId"
              class="flex items-center gap-3"
            >
              <!-- Posición -->
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                :class="idx === 0 ? 'bg-amber-100 text-amber-700'
                       : idx === 1 ? 'bg-slate-200 text-slate-600'
                       : idx === 2 ? 'bg-orange-100 text-orange-700'
                       : 'bg-slate-100 text-slate-500'"
              >
                {{ idx + 1 }}
              </div>
              <!-- Barra -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-medium text-slate-800 truncate max-w-[280px]">{{ libro.titulo }}</span>
                  <span class="text-xs font-semibold text-indigo-700 ml-2 tabular-nums shrink-0">{{ libro.cantidadPrestamos }} préstamos</span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-700"
                    :class="idx === 0 ? 'bg-indigo-500' : idx < 3 ? 'bg-indigo-400' : 'bg-indigo-300'"
                    :style="{ width: ((libro.cantidadPrestamos / maxPrestamos) * 100).toFixed(1) + '%' }"
                  />
                </div>
                <p class="text-xs text-slate-400 mt-0.5">ISBN: {{ libro.isbn }}</p>
              </div>
            </div>
          </div>
        </SCard>
      </template>

      <!-- ── Estado de ejemplares por biblioteca ───────────────────────────── -->
      <template v-else-if="form.tipo === 'estado-ejemplares'">
        <div class="grid grid-cols-2 gap-3 mb-5 max-w-sm">
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-slate-500 mb-1">Bibliotecas</p>
            <p class="text-2xl font-bold text-slate-900 tabular-nums">{{ estadoEjemplares?.resumen?.totalBibliotecas?.toLocaleString() ?? '—' }}</p>
          </SCard>
          <SCard padding="lg" class="text-center">
            <p class="text-xs text-indigo-600 mb-1">Total ejemplares</p>
            <p class="text-2xl font-bold text-indigo-700 tabular-nums">{{ estadoEjemplares?.resumen?.totalEjemplares?.toLocaleString() ?? '—' }}</p>
          </SCard>
        </div>

        <SCard variant="bordered" padding="lg">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-800">Estado de ejemplares por biblioteca</h2>
            <SBadge variant="info">{{ estadoEjemplares?.bibliotecas?.length ?? 0 }} bibliotecas</SBadge>
          </div>

          <SEmptyState v-if="!estadoEjemplares?.bibliotecas?.length" title="Sin datos" description="No hay información de ejemplares para mostrar." icon="book" size="sm"/>

          <div v-else class="overflow-x-auto -mx-2">
            <table class="w-full text-sm min-w-[700px]">
              <thead>
                <tr class="border-b border-slate-100">
                  <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Biblioteca</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-emerald-600">Disponibles</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-amber-600">Prestados</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-sky-600">Reservados</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-orange-600">Reparación</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-red-600">Perdidos</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-rose-600">Dañados</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-yellow-600">Deteriorados</th>
                  <th class="text-right py-2.5 px-3 text-xs font-semibold text-slate-500">Bajas</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="b in estadoEjemplares.bibliotecas"
                  :key="b.biblioteca"
                  class="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2.5 px-3 font-medium text-slate-800">{{ b.biblioteca }}</td>
                  <td class="py-2.5 px-3 text-right text-emerald-700 font-semibold tabular-nums">{{ b.disponibles.toLocaleString() }}</td>
                  <td class="py-2.5 px-3 text-right text-amber-700 font-semibold tabular-nums">{{ b.prestados.toLocaleString() }}</td>
                  <td class="py-2.5 px-3 text-right text-sky-700 tabular-nums">{{ b.reservados.toLocaleString() }}</td>
                  <td class="py-2.5 px-3 text-right text-orange-700 tabular-nums">{{ b.reparacion.toLocaleString() }}</td>
                  <td class="py-2.5 px-3 text-right tabular-nums" :class="b.perdidos > 0 ? 'text-red-700 font-semibold' : 'text-slate-400'">{{ b.perdidos.toLocaleString() }}</td>
                  <td class="py-2.5 px-3 text-right tabular-nums" :class="b.danados > 0 ? 'text-rose-700 font-semibold' : 'text-slate-400'">{{ b.danados.toLocaleString() }}</td>
                  <td class="py-2.5 px-3 text-right tabular-nums" :class="b.deteriorados > 0 ? 'text-yellow-700' : 'text-slate-400'">{{ b.deteriorados.toLocaleString() }}</td>
                  <td class="py-2.5 px-3 text-right text-slate-500 tabular-nums">{{ b.bajas.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SCard>
      </template>

      <!-- Nota de previsualización -->
      <div class="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
        <i class="ti ti-info-circle text-slate-400 text-base shrink-0" aria-hidden="true"/>
        <p class="text-xs text-slate-500">
          Esta es una <strong class="text-slate-700 font-medium">vista previa</strong> de los datos. Usa el botón <strong class="text-slate-700 font-medium">Descargar CSV</strong> para exportar todos los registros.
        </p>
      </div>
    </template>

  </div>
</template>