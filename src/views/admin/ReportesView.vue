<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SButton from '@/components/ui/SButton.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import ReportePdfModal from '@/components/reportes/ReportePdfModal.vue'
import { reporteService } from '@/services/reporte.service'

const ui = useUiStore()
const auth = useAuthStore()

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Reportes' }])
  if (auth.isAdmin) fetchBibliotecas()
})

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TipoReporte =
  | 'prestamos-activos'
  | 'devoluciones-pendientes'
  | 'prestamos-por-vencer'
  | 'prestamos'
  | 'historial'
  | 'libros-mas-prestados'
  | 'libros-menos-prestados'
  | 'inventario'
  | 'estado-ejemplares'
  | 'deterioro-ejemplares'
  | 'ejemplares-sin-circulacion'
  | 'sanciones'
  | 'certificados'

type PasoVista = 'configurar' | 'previsualizar'

// ─── Bibliotecas ──────────────────────────────────────────────────────────────

const bibliotecas = ref<{ id: number; nombre: string }[]>([])

async function fetchBibliotecas() {
  try {
    const res = await import('@/services/axios').then(m => m.default.get('/bibliotecas'))
    bibliotecas.value = res.data?.data ?? res.data ?? []
  } catch { /* silencioso */ }
}

// ─── Catálogo de reportes ─────────────────────────────────────────────────────

interface CatalogoReporte {
  value: TipoReporte
  label: string
  descripcion: string
  categoria: 'operativo' | 'prestamos' | 'inventario' | 'administrativo'
  metodo: 'GET' | 'POST'
}

const CATALOGO: CatalogoReporte[] = [
  // Operativos
  { value: 'prestamos-activos',         label: 'Préstamos activos',         descripcion: 'Todos los préstamos ACTIVO / RENOVADO del día',     categoria: 'operativo',       metodo: 'GET'  },
  { value: 'devoluciones-pendientes',   label: 'Devoluciones pendientes',   descripcion: 'Préstamos VENCIDOS pendientes de devolución',       categoria: 'operativo',       metodo: 'GET'  },
  { value: 'prestamos-por-vencer',      label: 'Por vencer en N días',      descripcion: 'Préstamos próximos a vencer (ventana configurable)', categoria: 'operativo',       metodo: 'GET'  },
  // Préstamos
  { value: 'prestamos',                 label: 'Reporte de préstamos',      descripcion: 'Filtrado por estado, fechas y biblioteca',          categoria: 'prestamos',       metodo: 'POST' },
  { value: 'historial',                 label: 'Historial avanzado',        descripcion: 'Condición física, renovaciones y retrasos',         categoria: 'prestamos',       metodo: 'POST' },
  { value: 'libros-mas-prestados',      label: 'Más prestados',             descripcion: 'Ranking de libros por cantidad de préstamos',       categoria: 'prestamos',       metodo: 'GET'  },
  { value: 'libros-menos-prestados',    label: 'Menos prestados',           descripcion: 'Libros con menor circulación (descarte / reubic.)', categoria: 'prestamos',       metodo: 'GET'  },
  // Inventario
  { value: 'inventario',                label: 'Inventario',                descripcion: 'Ejemplares con estado, ubicación y categoría',      categoria: 'inventario',      metodo: 'GET'  },
  { value: 'estado-ejemplares',         label: 'Estado por biblioteca',     descripcion: 'Distribución de ejemplares por estado y sede',      categoria: 'inventario',      metodo: 'GET'  },
  { value: 'deterioro-ejemplares',      label: 'Deterioro físico',          descripcion: 'Comparación condición entrada vs. devolución',      categoria: 'inventario',      metodo: 'GET'  },
  { value: 'ejemplares-sin-circulacion',label: 'Sin circulación',           descripcion: 'Ejemplares que nunca tuvieron un préstamo',         categoria: 'inventario',      metodo: 'GET'  },
  // Administrativos
  { value: 'sanciones',                 label: 'Sanciones',                 descripcion: 'Multas y suspensiones filtradas por período',       categoria: 'administrativo',  metodo: 'POST' },
  { value: 'certificados',              label: 'Certificados no deuda',     descripcion: 'Certificados emitidos, vigentes y vencidos',        categoria: 'administrativo',  metodo: 'POST' },
]

const CATEGORIAS: { key: CatalogoReporte['categoria']; label: string; color: string }[] = [
  { key: 'operativo',      label: 'Operativos',      color: 'bg-amber-50  text-amber-800  border-amber-200'  },
  { key: 'prestamos',      label: 'Préstamos',       color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { key: 'inventario',     label: 'Inventario',      color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { key: 'administrativo', label: 'Administrativo',  color: 'bg-violet-50 text-violet-800 border-violet-200' },
]

const ESTADOS_PRESTAMO = ['', 'ACTIVO', 'DEVUELTO', 'VENCIDO', 'RENOVADO']
const ESTADOS_EJEMPLAR  = ['', 'DISPONIBLE', 'PRESTADO', 'RESERVADO', 'EN_REPARACION', 'BAJA', 'PERDIDO', 'DETERIORADO', 'DAÑADO']
const ESTADOS_SANCION   = ['', 'ACTIVA', 'PAGADA', 'CONDONADA']
const ESTADOS_CERT      = ['', 'VIGENTE', 'VENCIDO', 'ANULADO']
const TIPOS_PRESTAMO    = ['', 'SALA', 'DOMICILIO']
const TIPOS_SANCION     = ['', 'MULTA', 'SUSPENSION']

// ─── Formulario ──────────────────────────────────────────────────────────────

const paso   = ref<PasoVista>('configurar')
const tipoActivo = ref<TipoReporte | null>(null)

function infoTipo(t: TipoReporte) {
  return CATALOGO.find(c => c.value === t)!
}

const bibliotecaIdForm = ref<number | null>(
  auth.isBibliotecario
    ? (auth.user?.biblioteca?.[0]?.id_biblioteca ?? null)
    : null
)

// Filtros dinámicos según tipo
const fEstadoPrestamo  = ref('')
const fEstadoEjemplar  = ref('')
const fEstadoSancion   = ref('')
const fEstadoCert      = ref('')
const fTipoPrestamo    = ref('')
const fTipoSancion     = ref('')
const fFechaInicio     = ref('')
const fFechaFin        = ref('')
const fDias            = ref(3)
const fUsuarioId       = ref<number | null>(null)
const fCategoriaId     = ref<number | null>(null)
const fClasificacion   = ref('')

function resetFiltros() {
  fEstadoPrestamo.value  = ''
  fEstadoEjemplar.value  = ''
  fEstadoSancion.value   = ''
  fEstadoCert.value      = ''
  fTipoPrestamo.value    = ''
  fTipoSancion.value     = ''
  fFechaInicio.value     = ''
  fFechaFin.value        = ''
  fDias.value            = 3
  fUsuarioId.value       = null
  fCategoriaId.value     = null
  fClasificacion.value   = ''
}

// Qué filtros mostrar según tipo
const mostrarFechas        = computed(() => ['prestamos','historial','deterioro-ejemplares','sanciones','certificados'].includes(tipoActivo.value ?? ''))
const mostrarEstadoPrestamo= computed(() => ['prestamos','historial'].includes(tipoActivo.value ?? ''))
const mostrarEstadoEjemplar= computed(() => tipoActivo.value === 'inventario')
const mostrarEstadoSancion = computed(() => tipoActivo.value === 'sanciones')
const mostrarEstadoCert    = computed(() => tipoActivo.value === 'certificados')
const mostrarTipoPrestamo  = computed(() => tipoActivo.value === 'historial')
const mostrarTipoSancion   = computed(() => tipoActivo.value === 'sanciones')
const mostrarDias          = computed(() => tipoActivo.value === 'prestamos-por-vencer')
const mostrarUsuarioId     = computed(() => tipoActivo.value === 'historial')
const mostrarCategoriaId   = computed(() => tipoActivo.value === 'inventario')
const mostrarClasificacion = computed(() => tipoActivo.value === 'inventario')

// ─── Datos previo visualización ───────────────────────────────────────────────

const loadingPreview = ref(false)
const previewError   = ref<string | null>(null)
const previewData    = ref<Record<string, unknown> | null>(null)  // datos crudos del backend

function resetPreview() {
  previewData.value  = null
  previewError.value = null
}

// Accesos tipados cómodos
const resumen    = computed(() => (previewData.value as any)?.resumen ?? null)
const listaPrest = computed(() => (previewData.value as any)?.prestamos ?? [])
const listaLibros= computed(() => (previewData.value as any)?.libros ?? [])
const listaInv   = computed(() => (previewData.value as any)?.detalle ?? [])
const listaBibl  = computed(() => (previewData.value as any)?.bibliotecas ?? [])
const listaDet   = computed(() => (previewData.value as any)?.detalle ?? [])
const listaSinC  = computed(() => (previewData.value as any)?.ejemplares ?? [])
const listaSanc  = computed(() => (previewData.value as any)?.sanciones ?? [])
const listaCert  = computed(() => (previewData.value as any)?.certificados ?? [])

const maxPrestamos = computed(() =>
  Math.max(...(listaLibros.value.map((l: any) => l.cantidadPrestamos) as number[]), 1)
)

async function generarPreview() {
  if (!tipoActivo.value) return
  resetPreview()
  loadingPreview.value = true
  try {
    const bId = bibliotecaIdForm.value

    let res: any
    const t = tipoActivo.value

    if (t === 'prestamos-activos')          res = await reporteService.prestamosActivos(bId)
    else if (t === 'devoluciones-pendientes') res = await reporteService.devolucionesPendientes(bId)
    else if (t === 'prestamos-por-vencer')  res = await reporteService.prestamosPorVencer(bId, fDias.value)
    else if (t === 'prestamos')             res = await reporteService.prestamos({ bibliotecaId: bId, estado: fEstadoPrestamo.value || null, fechaInicio: fFechaInicio.value || null, fechaFin: fFechaFin.value || null })
    else if (t === 'historial')             res = await reporteService.historialPrestamos({ bibliotecaId: bId, usuarioId: fUsuarioId.value, estado: fEstadoPrestamo.value || null, tipoPrestamo: fTipoPrestamo.value || null, fechaInicio: fFechaInicio.value || null, fechaFin: fFechaFin.value || null })
    else if (t === 'libros-mas-prestados')  res = await reporteService.librosMasPrestados(bId)
    else if (t === 'libros-menos-prestados')res = await reporteService.librosMenosPrestados(bId)
    else if (t === 'inventario')            res = await reporteService.inventario({ bibliotecaId: bId, categoriaId: fCategoriaId.value, estado: fEstadoEjemplar.value || null, clasificacionDecimal: fClasificacion.value || null })
    else if (t === 'estado-ejemplares')     res = await reporteService.estadoEjemplares(bId)
    else if (t === 'deterioro-ejemplares')  res = await reporteService.deterioroEjemplares({ bibliotecaId: bId, fechaInicio: fFechaInicio.value || null, fechaFin: fFechaFin.value || null })
    else if (t === 'ejemplares-sin-circulacion') res = await reporteService.ejemplaresSinCirculacion(bId)
    else if (t === 'sanciones')             res = await reporteService.sanciones({ bibliotecaId: bId, tipo: fTipoSancion.value || null, estado: fEstadoSancion.value || null, fechaInicio: fFechaInicio.value || null, fechaFin: fFechaFin.value || null })
    else if (t === 'certificados')          res = await reporteService.certificados({ bibliotecaId: bId, estado: fEstadoCert.value || null, fechaInicio: fFechaInicio.value || null, fechaFin: fFechaFin.value || null })

    previewData.value = res?.data?.data ?? res?.data
    paso.value = 'previsualizar'
  } catch (e: any) {
    previewError.value = e?.response?.data?.message ?? 'Error al obtener los datos del reporte'
    ui.toast.error('Error', previewError.value ?? '')
  } finally {
    loadingPreview.value = false
  }
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function badgeEstado(estado: string) {
  const m: Record<string, string> = {
    ACTIVO:       'bg-emerald-100 text-emerald-800',
    RENOVADO:     'bg-blue-100 text-blue-800',
    VENCIDO:      'bg-red-100 text-red-700',
    DEVUELTO:     'bg-slate-100 text-slate-700',
    CANCELADO:    'bg-slate-200 text-slate-600',
    DISPONIBLE:   'bg-emerald-100 text-emerald-800',
    PRESTADO:     'bg-amber-100 text-amber-800',
    RESERVADO:    'bg-sky-100 text-sky-800',
    EN_REPARACION:'bg-orange-100 text-orange-800',
    BAJA:         'bg-slate-200 text-slate-600',
    PERDIDO:      'bg-red-100 text-red-700',
    DETERIORADO:  'bg-yellow-100 text-yellow-800',
    DAÑADO:       'bg-rose-100 text-rose-700',
    ACTIVA:       'bg-red-100 text-red-700',
    PAGADA:       'bg-emerald-100 text-emerald-800',
    CONDONADA:    'bg-slate-100 text-slate-700',
    VIGENTE:      'bg-emerald-100 text-emerald-800',
    ANULADO:      'bg-slate-200 text-slate-600',
    MULTA:        'bg-amber-100 text-amber-800',
    SUSPENSION:   'bg-red-100 text-red-700',
  }
  return m[estado] ?? 'bg-slate-100 text-slate-600'
}

function colorFila(prest: any): string {
  if (prest.vencido || prest.diasRestantes < 0)  return 'bg-red-50'
  if (prest.diasRestantes === 0)                  return 'bg-orange-50'
  if (prest.diasRestantes === 1)                  return 'bg-yellow-50'
  if (prest.estadoPrestamo === 'RENOVADO')        return 'bg-blue-50'
  return ''
}

function badgeDias(p: any): { label: string; cls: string } | null {
  if (p.vencido || p.diasRestantes < 0)  return { label: `+${Math.abs(p.diasRestantes)}d`,  cls: 'bg-red-100 text-red-700' }
  if (p.diasRestantes === 0)             return { label: 'Hoy',                              cls: 'bg-orange-100 text-orange-700' }
  if (p.diasRestantes === 1)             return { label: 'Mañana',                           cls: 'bg-yellow-100 text-yellow-800' }
  if (p.diasRestantes <= 3)             return { label: `${p.diasRestantes}d`,               cls: 'bg-yellow-50 text-yellow-700' }
  return { label: `${p.diasRestantes}d`, cls: 'bg-slate-100 text-slate-600' }
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function volverAConfigurar() {
  paso.value = 'configurar'
  resetPreview()
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const loadingCSV = ref(false)

function descargarCSV() {
  if (!previewData.value || !tipoActivo.value) return
  loadingCSV.value = true
  try {
    const t = tipoActivo.value
    let csv = ''

    const operativosPrests = ['prestamos-activos','devoluciones-pendientes','prestamos-por-vencer']
    if (operativosPrests.includes(t)) {
      csv = 'ID,Usuario,CI,Libro,Código,F.Préstamo,F.Estimada,Estado,Tipo,Días restantes,Renovaciones\n'
      csv += listaPrest.value.map((p: any) =>
        `${p.idPrestamo},"${p.nombreUsuario}","${p.ci}","${p.tituloLibro}","${p.codigoEjemplar}","${p.fechaPrestamo}","${p.fechaDevolucionEstimada}","${p.estadoPrestamo}","${p.tipoPrestamo}",${p.diasRestantes},${p.renovaciones}`
      ).join('\n')
    } else if (t === 'prestamos' || t === 'historial') {
      csv = 'ID,Usuario,CI,Libro,ISBN,Biblioteca,F.Préstamo,F.Estimada,F.Real,Estado,Tipo,Días retraso\n'
      csv += listaPrest.value.map((p: any) =>
        `${p.idPrestamo},"${p.usuario}","${p.ci}","${p.libro}","${p.isbn}","${p.biblioteca}","${p.fechaPrestamo}","${p.fechaDevolucionEstimada}","${p.fechaDevolucionReal ?? ''}","${p.estadoPrestamo}","${p.tipoPrestamo}",${p.diasRetraso}`
      ).join('\n')
    } else if (t === 'libros-mas-prestados' || t === 'libros-menos-prestados') {
      csv = 'ID,Título,ISBN,Cantidad préstamos\n'
      csv += listaLibros.value.map((l: any) => `${l.idLibro},"${l.titulo}","${l.isbn}",${l.cantidadPrestamos}`).join('\n')
    } else if (t === 'inventario') {
      csv = 'ID,Código,Título,ISBN,Biblioteca,Estado,Clasificación,Ubicación\n'
      csv += listaInv.value.map((e: any) =>
        `${e.idEjemplar},"${e.codigoEjemplar}","${e.tituloLibro}","${e.isbn}","${e.biblioteca}","${e.estado}","${e.clasificacionDecimal}","${e.ubicacionFisica}"`
      ).join('\n')
    } else if (t === 'estado-ejemplares') {
      csv = 'Biblioteca,Disponibles,Prestados,Reservados,Reparación,Perdidos,Dañados,Deteriorados,Bajas\n'
      csv += listaBibl.value.map((b: any) =>
        `"${b.nombreBiblioteca ?? b.biblioteca}",${b.disponibles},${b.prestados},${b.reservados},${b.reparacion},${b.perdidos},${b.danados},${b.deteriorados},${b.bajas}`
      ).join('\n')
    } else if (t === 'deterioro-ejemplares') {
      csv = 'ID Préstamo,ID Ejemplar,Código,Libro,ISBN,Biblioteca,Usuario,CI,Cond. Entrega,Cond. Devolución,Diferencia,F. Devolución\n'
      csv += listaDet.value.map((d: any) =>
        `${d.idPrestamo},${d.idEjemplar},"${d.codigoEjemplar}","${d.libro}","${d.isbn}","${d.biblioteca}","${d.usuario}","${d.ci}","${d.condicionEntrega}","${d.condicionDevolucion}",${d.diferenciaNivel},"${d.fechaDevolucion}"`
      ).join('\n')
    } else if (t === 'ejemplares-sin-circulacion') {
      csv = 'ID,Código,Libro,ISBN,Editorial,Biblioteca,Clasificación,Ubicación,Estado\n'
      csv += listaSinC.value.map((e: any) =>
        `${e.idEjemplar},"${e.codigoEjemplar}","${e.libro}","${e.isbn}","${e.editorial}","${e.biblioteca}","${e.clasificacionDecimal}","${e.ubicacionFisica}","${e.estadoEjemplar}"`
      ).join('\n')
    } else if (t === 'sanciones') {
      csv = 'ID,Usuario,CI,Biblioteca,Tipo,Estado,Monto,Días suspensión,Días retraso,F. Inicio,F. Fin,Libro origen\n'
      csv += listaSanc.value.map((s: any) =>
        `${s.idSancion},"${s.usuario}","${s.ci}","${s.biblioteca}","${s.tipoSancion}","${s.estadoSancion}",${s.monto ?? ''},${s.diasSuspension ?? ''},${s.diasRetraso},"${s.fechaInicio}","${s.fechaFin ?? ''}","${s.libroOrigen ?? ''}"`
      ).join('\n')
    } else if (t === 'certificados') {
      csv = 'ID,Código verificación,Usuario,CI,Biblioteca,Bibliotecario,F. Emisión,F. Vencimiento,Estado\n'
      csv += listaCert.value.map((c: any) =>
        `${c.idCertificado},"${c.codigoVerificacion}","${c.usuario}","${c.ci}","${c.biblioteca}","${c.bibliotecario}","${c.fechaEmision}","${c.fechaVencimiento}","${c.estadoCertificado}"`
      ).join('\n')
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `reporte_${tipoActivo.value}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ui.toast.success('Descarga completa', 'El archivo CSV fue generado correctamente')
  } catch {
    ui.toast.error('Error', 'No se pudo generar el archivo')
  } finally {
    loadingCSV.value = false
  }
}

// ─── Modal PDF ────────────────────────────────────────────────────────────────

const mostrarModalPdf = ref(false)

const datosPdf = computed(() => previewData.value ?? {})

const tituloBibliotecaActiva = computed(() => {
  if (!bibliotecaIdForm.value) return ''
  return bibliotecas.value.find(b => b.id === bibliotecaIdForm.value)?.nombre ?? ''
})
</script>

<template>
  <div class="page-container">

    <!-- ─── Header ───────────────────────────────────────────────────────────── -->
    <div class="flex items-start justify-between gap-4 flex-wrap mb-7">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Reportes</h1>
        <p class="text-sm text-slate-500 mt-0.5">Genera y previsualiza reportes antes de exportar</p>
      </div>
      <div v-if="paso === 'previsualizar'" class="flex items-center gap-2 flex-wrap">
        <SButton variant="secondary" size="sm" @click="volverAConfigurar">
          <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Volver
        </SButton>
        <SButton variant="outline" size="sm" @click="mostrarModalPdf = true">
          <svg class="w-4 h-4 mr-1.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          Ver PDF
        </SButton>
        <SButton size="sm" :loading="loadingCSV" @click="descargarCSV">
          <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Descargar CSV
        </SButton>
      </div>
    </div>

    <!-- ─── PASO 1: Configurar ────────────────────────────────────────────────── -->
    <template v-if="paso === 'configurar'">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <!-- Selección de tipo (2 cols) -->
        <div class="lg:col-span-2 space-y-5">
          <div v-for="cat in CATEGORIAS" :key="cat.key">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{{ cat.label }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                v-for="item in CATALOGO.filter(c => c.categoria === cat.key)"
                :key="item.value"
                class="flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-150"
                :class="tipoActivo === item.value
                  ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
                @click="tipoActivo = item.value; resetFiltros()"
              >
                <span
                  class="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                  :class="item.metodo === 'POST'
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-slate-100 text-slate-600'"
                >{{ item.metodo }}</span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold" :class="tipoActivo === item.value ? 'text-indigo-700' : 'text-slate-800'">
                    {{ item.label }}
                  </p>
                  <p class="text-xs text-slate-500 mt-0.5 leading-snug">{{ item.descripcion }}</p>
                </div>
                <svg v-if="tipoActivo === item.value" class="w-4 h-4 text-indigo-500 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Panel de filtros (1 col) -->
        <SCard variant="bordered" padding="lg" class="h-fit sticky top-4">
          <h2 class="text-sm font-semibold text-slate-800 mb-4">Filtros</h2>

          <div v-if="!tipoActivo" class="py-8 text-center">
            <i class="ti ti-filter text-3xl text-slate-300 block mb-2" aria-hidden="true"/>
            <p class="text-xs text-slate-400">Selecciona un tipo de reporte para ver los filtros disponibles.</p>
          </div>

          <div v-else class="space-y-4">

            <!-- Biblioteca -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Biblioteca</label>
              <select
                v-model="bibliotecaIdForm"
                :disabled="auth.isBibliotecario"
                class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option :value="null">Todas las bibliotecas</option>
                <option v-for="b in bibliotecas" :key="b.id" :value="b.id">{{ b.nombre }}</option>
              </select>
              <p v-if="auth.isBibliotecario" class="text-xs text-slate-400 mt-1">Limitado a tu biblioteca asignada.</p>
            </div>

            <!-- Días (por vencer) -->
            <div v-if="mostrarDias">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Ventana de días <span class="text-indigo-600 font-semibold">{{ fDias }}</span></label>
              <input v-model.number="fDias" type="range" min="1" max="30" class="w-full accent-indigo-600"/>
              <div class="flex justify-between text-xs text-slate-400 mt-1"><span>1 día</span><span>30 días</span></div>
            </div>

            <!-- Estado préstamo -->
            <div v-if="mostrarEstadoPrestamo">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Estado del préstamo</label>
              <select v-model="fEstadoPrestamo" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option v-for="e in ESTADOS_PRESTAMO" :key="e" :value="e">{{ e || 'Todos' }}</option>
              </select>
            </div>

            <!-- Tipo préstamo -->
            <div v-if="mostrarTipoPrestamo">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Tipo de préstamo</label>
              <select v-model="fTipoPrestamo" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option v-for="e in TIPOS_PRESTAMO" :key="e" :value="e">{{ e || 'Todos' }}</option>
              </select>
            </div>

            <!-- Estado ejemplar -->
            <div v-if="mostrarEstadoEjemplar">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Estado del ejemplar</label>
              <select v-model="fEstadoEjemplar" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option v-for="e in ESTADOS_EJEMPLAR" :key="e" :value="e">{{ e || 'Todos' }}</option>
              </select>
            </div>

            <!-- Clasificación decimal -->
            <div v-if="mostrarClasificacion">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Clasificación Dewey</label>
              <input v-model="fClasificacion" type="text" placeholder="Ej. 005.133" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>

            <!-- Estado sanción -->
            <div v-if="mostrarEstadoSancion">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Estado de sanción</label>
              <select v-model="fEstadoSancion" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option v-for="e in ESTADOS_SANCION" :key="e" :value="e">{{ e || 'Todos' }}</option>
              </select>
            </div>

            <!-- Tipo sanción -->
            <div v-if="mostrarTipoSancion">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Tipo de sanción</label>
              <select v-model="fTipoSancion" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option v-for="e in TIPOS_SANCION" :key="e" :value="e">{{ e || 'Todos' }}</option>
              </select>
            </div>

            <!-- Estado certificado -->
            <div v-if="mostrarEstadoCert">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Estado del certificado</label>
              <select v-model="fEstadoCert" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option v-for="e in ESTADOS_CERT" :key="e" :value="e">{{ e || 'Todos' }}</option>
              </select>
            </div>

            <!-- Fechas -->
            <template v-if="mostrarFechas">
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1.5">Fecha desde</label>
                <input v-model="fFechaInicio" type="date" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1.5">Fecha hasta</label>
                <input v-model="fFechaFin" type="date" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
              </div>
            </template>

            <!-- ID Usuario (historial) -->
            <div v-if="mostrarUsuarioId">
              <label class="block text-xs font-medium text-slate-500 mb-1.5">ID de usuario <span class="text-slate-400">(opcional)</span></label>
              <input v-model.number="fUsuarioId" type="number" placeholder="Ej. 12" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            </div>

          </div>

          <!-- Error -->
          <div v-if="previewError" class="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <i class="ti ti-alert-circle shrink-0 mt-0.5" aria-hidden="true"/>
            {{ previewError }}
          </div>

          <!-- Acción -->
          <div class="mt-5 pt-4 border-t border-slate-100">
            <SButton :disabled="!tipoActivo || loadingPreview" :loading="loadingPreview" :full="true" @click="generarPreview">
              <i v-if="!loadingPreview" class="ti ti-eye mr-1.5" aria-hidden="true"/>
              Previsualizar reporte
            </SButton>
            <p class="text-xs text-slate-400 text-center mt-2">Verás los datos antes de exportar</p>
          </div>
        </SCard>
      </div>
    </template>

    <!-- ─── PASO 2: Previsualizar ──────────────────────────────────────────────── -->
    <template v-else-if="paso === 'previsualizar'">

      <!-- Skeleton -->
      <template v-if="loadingPreview">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <SCard v-for="i in 4" :key="i" padding="lg"><SSkeleton width="60%" height="0.7rem" class="mb-2"/><SSkeleton width="40%" height="1.75rem"/></SCard>
        </div>
        <SCard padding="lg"><SSkeleton v-for="j in 5" :key="j" width="100%" height="0.8rem" class="mb-2"/></SCard>
      </template>

      <template v-else>

        <!-- Chips de resumen -->
        <div v-if="resumen" class="flex flex-wrap gap-3 mb-5">
          <SCard
            v-for="[k, v] in Object.entries(resumen).filter(([, val]) => typeof val === 'number')"
            :key="k"
            padding="lg"
            class="text-center min-w-[110px]"
          >
            <p class="text-xs text-slate-500 mb-1 leading-tight capitalize">{{ k.replace(/([A-Z])/g, ' $1').trim() }}</p>
            <p class="text-2xl font-bold text-slate-900 tabular-nums">{{ (v as number).toLocaleString() }}</p>
          </SCard>
        </div>

        <!-- ── Tabla: reportes operativos (prestamos-activos, devoluciones, por-vencer) ── -->
        <template v-if="['prestamos-activos','devoluciones-pendientes','prestamos-por-vencer'].includes(tipoActivo ?? '')">
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">{{ infoTipo(tipoActivo!).label }}</h2>
              <SBadge variant="info">{{ listaPrest.length }} registros</SBadge>
            </div>
            <SEmptyState v-if="!listaPrest.length" title="Sin registros" description="No hay préstamos para los filtros aplicados." icon="book" size="sm"/>
            <div v-else class="overflow-x-auto -mx-2">
              <table class="w-full text-sm min-w-[860px]">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Usuario</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">CI</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Libro</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Código</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">F. Estimada</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Vence en</th>
                    <th class="text-right py-2.5 px-3 text-xs font-semibold text-slate-500">Renov.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in listaPrest" :key="p.idPrestamo" class="border-b border-slate-50 transition-colors" :class="colorFila(p)">
                    <td class="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{{ p.nombreUsuario }}</td>
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ p.ci }}</td>
                    <td class="py-2.5 px-3 text-slate-700 max-w-[180px] truncate">{{ p.tituloLibro }}</td>
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ p.codigoEjemplar }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ fechaCorta(p.fechaDevolucionEstimada) }}</td>
                    <td class="py-2.5 px-3">
                      <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(p.estadoPrestamo)">{{ p.estadoPrestamo }}</span>
                    </td>
                    <td class="py-2.5 px-3">
                      <span v-if="badgeDias(p)" class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeDias(p)!.cls">{{ badgeDias(p)!.label }}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right text-xs text-slate-500 tabular-nums">{{ p.renovaciones }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SCard>
        </template>

        <!-- ── Tabla: préstamos general e historial ── -->
        <template v-else-if="['prestamos','historial'].includes(tipoActivo ?? '')">
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">{{ infoTipo(tipoActivo!).label }}</h2>
              <SBadge variant="info">{{ listaPrest.length }} registros</SBadge>
            </div>
            <SEmptyState v-if="!listaPrest.length" title="Sin préstamos" description="No hay préstamos para los filtros aplicados." icon="book" size="sm"/>
            <div v-else class="overflow-x-auto -mx-2">
              <table class="w-full text-sm min-w-[820px]">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">#</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Usuario</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Libro</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Biblioteca</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">F. Préstamo</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">F. Estimada</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th class="text-right py-2.5 px-3 text-xs font-semibold text-slate-500">Días retraso</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in listaPrest" :key="p.idPrestamo" class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="py-2.5 px-3 text-xs text-slate-400 tabular-nums">{{ p.idPrestamo }}</td>
                    <td class="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{{ p.usuario }}</td>
                    <td class="py-2.5 px-3 text-slate-700 max-w-[160px] truncate">{{ p.libro }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ p.biblioteca }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ fechaCorta(p.fechaPrestamo) }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ fechaCorta(p.fechaDevolucionEstimada) }}</td>
                    <td class="py-2.5 px-3">
                      <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(p.estadoPrestamo)">{{ p.estadoPrestamo }}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <span v-if="p.diasRetraso > 0" class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">+{{ p.diasRetraso }}d</span>
                      <span v-else class="text-xs text-slate-400">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SCard>
        </template>

        <!-- ── Libros más / menos prestados (ranking) ── -->
        <template v-else-if="['libros-mas-prestados','libros-menos-prestados'].includes(tipoActivo ?? '')">
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-sm font-semibold text-slate-800">{{ infoTipo(tipoActivo!).label }}</h2>
              <SBadge variant="info">{{ listaLibros.length }} libros</SBadge>
            </div>
            <SEmptyState v-if="!listaLibros.length" title="Sin datos" description="No hay préstamos registrados." icon="book" size="sm"/>
            <div v-else class="space-y-3">
              <div v-for="(libro, idx) in listaLibros" :key="libro.idLibro" class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  :class="idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'">
                  {{ idx + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium text-slate-800 truncate max-w-[280px]">{{ libro.titulo }}</span>
                    <span class="text-xs font-semibold text-indigo-700 ml-2 tabular-nums shrink-0">{{ libro.cantidadPrestamos }} préstamos</span>
                  </div>
                  <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700"
                      :class="idx < 3 ? 'bg-indigo-500' : 'bg-indigo-300'"
                      :style="{ width: ((libro.cantidadPrestamos / maxPrestamos) * 100).toFixed(1) + '%' }"/>
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5">ISBN: {{ libro.isbn }}</p>
                </div>
              </div>
            </div>
          </SCard>
        </template>

        <!-- ── Inventario ── -->
        <template v-else-if="tipoActivo === 'inventario'">
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">Inventario de ejemplares</h2>
              <SBadge variant="info">{{ listaInv.length }} registros</SBadge>
            </div>
            <SEmptyState v-if="!listaInv.length" title="Sin ejemplares" description="No hay registros para los filtros aplicados." icon="book" size="sm"/>
            <div v-else class="overflow-x-auto -mx-2">
              <table class="w-full text-sm min-w-[700px]">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Código</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Título</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Biblioteca</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Clasificación</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="e in listaInv" :key="e.idEjemplar" class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-600">{{ e.codigoEjemplar }}</td>
                    <td class="py-2.5 px-3 font-medium text-slate-800 max-w-[200px] truncate">{{ e.tituloLibro }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ e.biblioteca }}</td>
                    <td class="py-2.5 px-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(e.estado)">{{ e.estado }}</span></td>
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ e.clasificacionDecimal }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600">{{ e.ubicacionFisica }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SCard>
        </template>

        <!-- ── Estado ejemplares por biblioteca ── -->
        <template v-else-if="tipoActivo === 'estado-ejemplares'">
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">Estado de ejemplares por biblioteca</h2>
              <SBadge variant="info">{{ listaBibl.length }} sedes</SBadge>
            </div>
            <SEmptyState v-if="!listaBibl.length" title="Sin datos" description="No hay información de ejemplares." icon="book" size="sm"/>
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
                  <tr v-for="b in listaBibl" :key="b.idBiblioteca ?? b.biblioteca" class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="py-2.5 px-3 font-medium text-slate-800">{{ b.nombreBiblioteca ?? b.biblioteca }}</td>
                    <td class="py-2.5 px-3 text-right font-semibold text-emerald-700 tabular-nums">{{ b.disponibles.toLocaleString() }}</td>
                    <td class="py-2.5 px-3 text-right font-semibold text-amber-700 tabular-nums">{{ b.prestados.toLocaleString() }}</td>
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

        <!-- ── Deterioro físico ── -->
        <template v-else-if="tipoActivo === 'deterioro-ejemplares'">
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">Deterioro físico de ejemplares</h2>
              <SBadge variant="info">{{ listaDet.length }} registros</SBadge>
            </div>
            <SEmptyState v-if="!listaDet.length" title="Sin registros" description="No hay devoluciones con deterioro en el período." icon="book" size="sm"/>
            <div v-else class="overflow-x-auto -mx-2">
              <table class="w-full text-sm min-w-[820px]">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Ejemplar</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Libro</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Usuario</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Cond. entrada</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Cond. salida</th>
                    <th class="text-center py-2.5 px-3 text-xs font-semibold text-slate-500">Δ Nivel</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">F. Devolución</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in listaDet" :key="d.idPrestamo" class="border-b border-slate-50 transition-colors" :class="d.diferenciaNivel >= 2 ? 'bg-red-50' : d.diferenciaNivel > 0 ? 'bg-yellow-50' : ''">
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-600">{{ d.codigoEjemplar }}</td>
                    <td class="py-2.5 px-3 text-slate-700 max-w-[160px] truncate">{{ d.libro }}</td>
                    <td class="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{{ d.usuario }}</td>
                    <td class="py-2.5 px-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(d.condicionEntrega)">{{ d.condicionEntrega }}</span></td>
                    <td class="py-2.5 px-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(d.condicionDevolucion)">{{ d.condicionDevolucion }}</span></td>
                    <td class="py-2.5 px-3 text-center">
                      <span v-if="d.diferenciaNivel > 0" class="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">▼ {{ d.diferenciaNivel }}</span>
                      <span v-else-if="d.diferenciaNivel < 0" class="text-xs text-emerald-600 font-medium">▲ {{ Math.abs(d.diferenciaNivel) }}</span>
                      <span v-else class="text-xs text-slate-400">—</span>
                    </td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ fechaCorta(d.fechaDevolucion) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SCard>
        </template>

        <!-- ── Ejemplares sin circulación ── -->
        <template v-else-if="tipoActivo === 'ejemplares-sin-circulacion'">
          <!-- KPI extra del root -->
          <div v-if="previewData" class="flex flex-wrap gap-3 mb-5">
            <SCard padding="lg" class="text-center min-w-[130px]">
              <p class="text-xs text-slate-500 mb-1">Sin historial</p>
              <p class="text-2xl font-bold text-slate-900">{{ (previewData as any).totalEjemplaresNuncaPrestados?.toLocaleString() ?? '—' }}</p>
            </SCard>
            <SCard padding="lg" class="text-center min-w-[130px]">
              <p class="text-xs text-red-600 mb-1">% sin circulación</p>
              <p class="text-2xl font-bold text-red-700">{{ (previewData as any).porcentajeSinCirculacion?.toFixed(1) ?? '—' }}%</p>
            </SCard>
          </div>
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">Ejemplares sin circulación</h2>
              <SBadge variant="info">{{ listaSinC.length }} registros</SBadge>
            </div>
            <SEmptyState v-if="!listaSinC.length" title="Sin registros" description="Todos los ejemplares tienen al menos un préstamo." icon="book" size="sm"/>
            <div v-else class="overflow-x-auto -mx-2">
              <table class="w-full text-sm min-w-[700px]">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Código</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Libro</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Editorial</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Biblioteca</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="e in listaSinC" :key="e.idEjemplar" class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-600">{{ e.codigoEjemplar }}</td>
                    <td class="py-2.5 px-3 font-medium text-slate-800 max-w-[180px] truncate">{{ e.libro }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600">{{ e.editorial }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ e.biblioteca }}</td>
                    <td class="py-2.5 px-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(e.estadoEjemplar)">{{ e.estadoEjemplar }}</span></td>
                    <td class="py-2.5 px-3 text-xs text-slate-600">{{ e.ubicacionFisica }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SCard>
        </template>

        <!-- ── Sanciones ── -->
        <template v-else-if="tipoActivo === 'sanciones'">
          <!-- Métricas monetarias -->
          <div v-if="resumen" class="grid grid-cols-3 gap-3 mb-5">
            <SCard padding="lg" class="text-center">
              <p class="text-xs text-slate-500 mb-1">Monto generado</p>
              <p class="text-xl font-bold text-slate-900 tabular-nums">Bs {{ resumen.montoTotalGenerado?.toFixed(2) ?? '0.00' }}</p>
            </SCard>
            <SCard padding="lg" class="text-center">
              <p class="text-xs text-emerald-600 mb-1">Monto cobrado</p>
              <p class="text-xl font-bold text-emerald-700 tabular-nums">Bs {{ resumen.montoTotalPagado?.toFixed(2) ?? '0.00' }}</p>
            </SCard>
            <SCard padding="lg" class="text-center">
              <p class="text-xs text-red-600 mb-1">Monto pendiente</p>
              <p class="text-xl font-bold text-red-700 tabular-nums">Bs {{ resumen.montoPendiente?.toFixed(2) ?? '0.00' }}</p>
            </SCard>
          </div>
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">Detalle de sanciones</h2>
              <SBadge variant="info">{{ listaSanc.length }} registros</SBadge>
            </div>
            <SEmptyState v-if="!listaSanc.length" title="Sin sanciones" description="No hay sanciones para los filtros aplicados." icon="book" size="sm"/>
            <div v-else class="overflow-x-auto -mx-2">
              <table class="w-full text-sm min-w-[820px]">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Usuario</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">CI</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Biblioteca</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Tipo</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th class="text-right py-2.5 px-3 text-xs font-semibold text-slate-500">Monto</th>
                    <th class="text-right py-2.5 px-3 text-xs font-semibold text-slate-500">Días retraso</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Libro origen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in listaSanc" :key="s.idSancion" class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{{ s.usuario }}</td>
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ s.ci }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ s.biblioteca }}</td>
                    <td class="py-2.5 px-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(s.tipoSancion)">{{ s.tipoSancion }}</span></td>
                    <td class="py-2.5 px-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(s.estadoSancion)">{{ s.estadoSancion }}</span></td>
                    <td class="py-2.5 px-3 text-right text-xs tabular-nums" :class="s.monto ? 'font-semibold text-slate-800' : 'text-slate-400'">{{ s.monto != null ? 'Bs ' + Number(s.monto).toFixed(2) : '—' }}</td>
                    <td class="py-2.5 px-3 text-right text-xs tabular-nums" :class="s.diasRetraso > 0 ? 'text-red-700 font-semibold' : 'text-slate-400'">{{ s.diasRetraso > 0 ? `+${s.diasRetraso}d` : '—' }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 max-w-[160px] truncate">{{ s.libroOrigen ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SCard>
        </template>

        <!-- ── Certificados ── -->
        <template v-else-if="tipoActivo === 'certificados'">
          <SCard variant="bordered" padding="lg">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-slate-800">Certificados de no deuda</h2>
              <SBadge variant="info">{{ listaCert.length }} registros</SBadge>
            </div>
            <SEmptyState v-if="!listaCert.length" title="Sin certificados" description="No hay certificados para los filtros aplicados." icon="document-check" size="sm"/>
            <div v-else class="overflow-x-auto -mx-2">
              <table class="w-full text-sm min-w-[760px]">
                <thead>
                  <tr class="border-b border-slate-100">
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Cód. verificación</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Usuario</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">CI</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Biblioteca</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Bibliotecario</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">F. Emisión</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">F. Vencimiento</th>
                    <th class="text-left py-2.5 px-3 text-xs font-semibold text-slate-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in listaCert" :key="c.idCertificado" class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="py-2.5 px-3 font-mono text-xs text-indigo-600">{{ c.codigoVerificacion }}</td>
                    <td class="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">{{ c.usuario }}</td>
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-500">{{ c.ci }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ c.biblioteca }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ c.bibliotecario }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ fechaCorta(c.fechaEmision) }}</td>
                    <td class="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{{ fechaCorta(c.fechaVencimiento) }}</td>
                    <td class="py-2.5 px-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="badgeEstado(c.estadoCertificado)">{{ c.estadoCertificado }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SCard>
        </template>

        <!-- Nota inferior -->
        <div class="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
          <i class="ti ti-info-circle text-slate-400 shrink-0" aria-hidden="true"/>
          <p class="text-xs text-slate-500">
            Vista previa de los datos. Usa <strong class="text-slate-700">Ver PDF</strong> para previsualizar y descargar en PDF, o <strong class="text-slate-700">Descargar CSV</strong> para exportar todos los registros.
          </p>
        </div>

      </template>
    </template>

    <!-- ─── Modal PDF ──────────────────────────────────────────────────────────── -->
    <ReportePdfModal
      v-model="mostrarModalPdf"
      :tipo="tipoActivo ?? ''"
      :datos="datosPdf"
      :titulo-biblioteca="tituloBibliotecaActiva"
    />

  </div>
</template>