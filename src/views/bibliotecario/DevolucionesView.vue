<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useMedia } from '@/composables/useMedia'
import { useAuthStore } from '@/stores/auth.store'
import { useSancionStore } from '@/stores/sancion.store'
import api from '@/services/axios'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import ModalPago from '@/components/sanciones/ModalPago.vue'
import type { SancionPago } from '@/components/sanciones/ModalPago.vue'

const ui = useUiStore()
const auth = useAuthStore()
const sancionStore = useSancionStore()
const { getUrl } = useMedia()
onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Préstamos', to: '/prestamos' },
    { label: 'Devoluciones' }
  ])
  fetchPendientes()
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'RENOVADO' | 'DEVUELTO' | 'VENCIDO'
  vencido: boolean
  condicionEntrega?: string
  renovaciones?: number
  fechaPrestamo?: string
  fechaDevolucionEstimada?: string
  usuario?: {
    id_usuario?: number
    persona?: { nombreCompleto?: string; ci?: number | string }
    username?: string
  }
  ejemplar?: {
    id_ejemplar?: number
    codigoEjemplar?: string
    codigo_ejemplar?: string
    edicion?: { titulo?: string; imagenPortada?: string; editorial?: string }
    libro?: { titulo?: string }
  }
}
interface EstadoSancionUsuario {
  usuarioId: number
  tieneSuspensionVigente: boolean
  tieneDeudaPendiente: boolean
  totalSancionesActivas: number
  montoTotalDeuda: number | null
  fechaFinSuspensionMasProxima: string | null
  sanciones?: SancionResumen[]
}

interface SancionResumen {
  idSancion: number
  idPrestamo?: number
  tipoSancion: string
  montoMulta: number | null
  motivo?: string
  estado: string
  suspensionVigente: boolean
  fechaFinSuspension?: string
}
const CONDICIONES = ['EXCELENTE', 'BUENO', 'REGULAR', 'DAÑADO'] as const
type Condicion = typeof CONDICIONES[number]

const ESTADO_EJEMPLAR_OPTIONS = ['DISPONIBLE', 'DETERIORADO', 'DAÑADO', 'PERDIDO'] as const
type EstadoEjemplar = typeof ESTADO_EJEMPLAR_OPTIONS[number]

// ─── MODO: Buscar por ID o ver lista de pendientes ───────────────────────────
type Modo = 'buscar' | 'lista'
const modo = ref<Modo>('lista')

// ─── Lista de pendientes (ACTIVO/RENOVADO) ────────────────────────────────────
const pendientes = ref<Prestamo[]>([])
const pendientesLoading = ref(false)
const searchLocal = ref('')

async function fetchPendientes() {
  pendientesLoading.value = true
  try {
    const roles = auth.user?.roles ?? []
    const bibliotecaId = auth.user?.biblioteca?.[0]?.id_biblioteca

    const esAdmin = roles.includes('ROLE_ADMIN')
    const esBiblio = roles.includes('ROLE_BIBLIOTECARIO') || roles.includes('ROLE_AUXILIAR')

    let urls: string[] = []

    if (esAdmin) {
      // 🔹 ADMIN
      urls = [
        '/prestamos/estado/ACTIVO',
        '/prestamos/estado/RENOVADO',
        '/prestamos/estado/VENCIDO',
      ]
    } else if (esBiblio) {
      // 🔹 BIBLIOTECARIO / AUXILIAR
      if (!bibliotecaId) {
        pendientes.value = []
        return
      }

      urls = [
        `/prestamos/biblioteca/${bibliotecaId}?estado=ACTIVO`,
        `/prestamos/biblioteca/${bibliotecaId}?estado=RENOVADO`,
        `/prestamos/biblioteca/${bibliotecaId}?estado=VENCIDO`
      ]
    }

    const responses = await Promise.all(urls.map(url => api.get(url)))

    const listas = responses.map(r => r.data?.data ?? r.data ?? [])
    pendientes.value = listas
      .flat()
      .sort((a, b) => {
        // Vencidos primero
        if (a.vencido && !b.vencido) return -1
        if (!a.vencido && b.vencido) return 1
        return a.id_prestamo - b.id_prestamo
      })
  } catch {
    pendientes.value = []
  } finally {
    pendientesLoading.value = false
  }
}
const pendientesFiltrados = computed(() => {
  const q = searchLocal.value.toLowerCase()
  console.log('pendienes filtrados', q)
  if (!q) return pendientes.value
  return pendientes.value.filter(p => {
    const titulo = p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? ''
    const nombre = p.usuario?.persona?.nombreCompleto ?? p.usuario?.username ?? ''
    const codigo = p.ejemplar?.codigoEjemplar ?? p.ejemplar?.codigo_ejemplar ?? ''
    const ci = p.usuario?.ci?.toString() ?? ''
    const id = String(p.id_prestamo)
    return titulo.toLowerCase().includes(q) || nombre.toLowerCase().includes(q) || codigo.toLowerCase().includes(q) || id.includes(q) || ci.includes(q)
  })
})

// ─── Búsqueda por ID ──────────────────────────────────────────────────────────
const buscarId = ref('')
const buscarLoading = ref(false)
const buscarError = ref<string | null>(null)

async function buscarPorId() {
  const id = parseInt(buscarId.value)
  if (!id) return
  buscarLoading.value = true
  buscarError.value = null
  try {
    const { data } = await api.get(`/prestamos/${id}`)
    const p: Prestamo = data.data
    if (p.estadoPrestamo === 'DEVUELTO') {
      buscarError.value = 'Este préstamo ya fue devuelto'
      return
    }
    seleccionarPrestamo(p)
  } catch {
    buscarError.value = 'No se encontró un préstamo activo con ese ID'
  } finally {
    buscarLoading.value = false
  }
}

// ─── Préstamo seleccionado para devolver ──────────────────────────────────────
const prestamoSeleccionado = ref<Prestamo | null>(null)
const sancionSeleccionada = ref<SancionPago | null>(null)
const sancionUsuario = ref<EstadoSancionUsuario | null>(null)
const sancionLoading = ref(false)

async function seleccionarPrestamo(p: Prestamo) {
  prestamoSeleccionado.value = p
  console.log('------------------------')
  console.log(prestamoSeleccionado.value)
  resetFormulario()
  sancionUsuario.value = null
  sancionSeleccionada.value = null

  // Sugerir condición igual a la de entrega
  const condEntrega = p.condicionEntrega as Condicion | undefined
  condicionDevolucion.value = condEntrega && CONDICIONES.includes(condEntrega) ? condEntrega : 'BUENO'
  // Verificar sanciones del usuario
  const usuarioId = p.usuario?.id_usuario
  if (!usuarioId) return

  sancionLoading.value = true
  try {
    const { data } = await api.get(`/sanciones/usuario/${usuarioId}/estado`)
    const estado = data?.data ?? data
    sancionUsuario.value = estado
    console.log('Seleccionar Prestamo')
    console.log('sancionUsuario', sancionUsuario.value)

    const sancionPrestamo = estado?.sanciones?.find(
      (s: any) => s.idPrestamo === p.id_prestamo
    )

    if (sancionPrestamo) {
      sancionSeleccionada.value = {
        idSancion: sancionPrestamo.idSancion,
        nombreUsuario: p.usuario?.nombreCompleto ?? '',
        ciUsuario: p.usuario?.ci ?? '',
        montoMulta: sancionPrestamo.montoMulta ?? null,
        tipoSancion: sancionPrestamo.tipoSancion,
        estado: sancionPrestamo.estado,
        fechaFinSuspension: sancionPrestamo.fechaFinSuspension ?? null,
        observaciones: null
      }
    } else {
      sancionSeleccionada.value = null
    }

  } catch {
    sancionUsuario.value = null
  } finally { sancionLoading.value = false }
}

function limpiarSeleccion() {
  prestamoSeleccionado.value = null
  devolucionError.value = null
  devolucionSuccess.value = false
}

// Bloqueo: tiene deuda pendiente Y no fue dispensado manualmente
// const bloqueadoPorDeuda = computed(() =>
//   sancionUsuario.value?.tieneDeudaPendiente === true ||
//   sancionUsuario.value?.tieneSuspensionVigente === true
// )
const bloqueadoPorPrestamo = computed(() =>
  !!sancionSeleccionada.value
)
// Forzar "omitir bloqueo" (el bibliotecario decide proceder igual)
const omitirBloqueo = ref(false)

function resetFormulario() {
  condicionDevolucion.value = 'BUENO'
  estadoEjemplar.value = 'DISPONIBLE'
  observaciones.value = ''
  devolucionError.value = null
  devolucionSuccess.value = false
  devolucionResult.value = null
  omitirBloqueo.value = false
}

const ejemplarPerdido = computed(() => estadoEjemplar.value === 'PERDIDO')

// ─── Formulario de devolución ────────────────────────────────────────────────
const condicionDevolucion = ref<Condicion>('BUENO')
const estadoEjemplar = ref<EstadoEjemplar>('DISPONIBLE')
const observaciones = ref('')
const devolucionLoading = ref(false)
const devolucionError = ref<string | null>(null)
const devolucionSuccess = ref(false)
const devolucionResult = ref<{ fechaDevolucionReal?: string; condicionDevolucion?: string } | null>(null)

// Detección automática de deterioro
const ORDEN_CONDICION: Record<Condicion, number> = { EXCELENTE: 0, BUENO: 1, REGULAR: 2, DAÑADO: 3 }

const hayDeterioro = computed(() => {
  console.log('ejemplar', ejemplarPerdido.value)
  const entrega = prestamoSeleccionado.value?.condicionEntrega as Condicion | undefined
  if (!entrega || !condicionDevolucion.value) return false
  console.log('deteriodo', ORDEN_CONDICION[condicionDevolucion.value] > ORDEN_CONDICION[entrega])
  return ORDEN_CONDICION[condicionDevolucion.value] > ORDEN_CONDICION[entrega]
})

// Ajustar estado del ejemplar según condición
watch(condicionDevolucion, (val) => {
  if (ORDEN_CONDICION[val] >= ORDEN_CONDICION['MALO']) estadoEjemplar.value = 'DAÑADO'
  else if (ORDEN_CONDICION[val] >= ORDEN_CONDICION['REGULAR']) estadoEjemplar.value = 'DETERIORADO'
  else estadoEjemplar.value = 'DISPONIBLE'
})
const puedeConfirmar = computed(() =>
  !!prestamoSeleccionado.value &&
  (!bloqueadoPorPrestamo.value || omitirBloqueo.value) &&
  !devolucionLoading.value
)
// Si hay deterioro → forzar estado ejemplar a DETERIORADO o DAÑADO
// watch(condicionDevolucion, (val) => {
//   if (ORDEN_CONDICION[val] >= ORDEN_CONDICION['DAÑADO']) {
//     estadoEjemplar.value = 'DAÑADO'
//   } else if (ORDEN_CONDICION[val] >= ORDEN_CONDICION['REGULAR']) {
//     estadoEjemplar.value = 'DETERIORADO'
//   } else {
//     estadoEjemplar.value = 'DISPONIBLE'
//   }
// })

async function confirmarDevolucion() {
  if (!puedeConfirmar.value || !prestamoSeleccionado.value) return
  devolucionLoading.value = true
  devolucionError.value = null
  devolucionSuccess.value = false
  try {
    const { data } = await api.post('/prestamos/devolucion', {
      prestamoId: prestamoSeleccionado.value.id_prestamo,
      condicionDevolucion: condicionDevolucion.value,
      estadoEjemplar: estadoEjemplar.value,
      observaciones: observaciones.value || 'Devolución registrada',
    })
    devolucionResult.value = data.data
    devolucionSuccess.value = true
    ui.toast.success('Devuelto', 'La devolución fue registrada correctamente')
    // Refrescar lista
    fetchPendientes()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    devolucionError.value = msg ?? 'No se pudo registrar la devolución'
    ui.toast.error('Error', devolucionError.value!)
  } finally {
    devolucionLoading.value = false
  }
}

function nuevaDevolucion() {
  limpiarSeleccion()
  buscarId.value = ''
  buscarError.value = null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const condicionColors: Record<Condicion, string> = {
  EXCELENTE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  BUENO: 'border-blue-500 bg-blue-50 text-blue-700',
  REGULAR: 'border-amber-500 bg-amber-50 text-amber-700',
  DAÑADO: 'border-red-500 bg-red-50 text-red-700',
}

const condicionTextColors: Record<Condicion, string> = {
  EXCELENTE: 'text-emerald-600',
  BUENO: 'text-blue-600',
  REGULAR: 'text-amber-600',
  DAÑADO: 'text-red-600',
}

const estadoEjemplarColors: Record<EstadoEjemplar, string> = {
  DISPONIBLE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  DETERIORADO: 'border-amber-500 bg-amber-50 text-amber-700',
  DAÑADO: 'border-red-500 bg-red-50 text-red-700',
  PERDIDO: 'border-slate-500 bg-slate-100 text-slate-700',
}

function diasVencido(fecha?: string): number {
  if (!fecha) return 0
  const diff = Date.now() - new Date(fecha).getTime()
  return Math.floor(diff / 86400000)
}

const sancionPrestamoActual = computed(() => {
  if (!sancionUsuario.value?.sanciones || !prestamoSeleccionado.value) {
    return null
  }

  return sancionUsuario.value.sanciones.find(
    s => s.idPrestamo === prestamoSeleccionado.value.id_prestamo
  )
})

// ─── Modal de PAGO inline (para saldar deuda antes de devolver) ───────────────
const modalPagoOpen = ref(false)
const metodoPago = ref('')
const observacionesPago = ref('')
const pagoLoading = ref(false)
const sancionParaPagar = ref<SancionResumen | null>(null)

const METODOS_PAGO = ['Efectivo', 'Transferencia bancaria', 'QR', 'Depósito bancario', 'Otro']

function abrirPagoDeuda() {
  // Tomar la primera sanción activa con deuda
  const primera = sancionUsuario.value?.sanciones?.find(s => s.estado === 'ACTIVA' && s.montoMulta)
  sancionParaPagar.value = primera ?? null
  metodoPago.value = ''; observacionesPago.value = ''
  modalPagoOpen.value = true
}

async function confirmarPagoDeuda() {
  if (!metodoPago.value || !sancionParaPagar.value) return
  pagoLoading.value = true
  try {
    await sancionStore.registrarPago(sancionParaPagar.value.idSancion, {
      metodoPago: metodoPago.value,
      observaciones: observacionesPago.value || undefined,
    })
    ui.toast.success('Pago registrado', 'La deuda fue saldada')
    modalPagoOpen.value = false
    // Re-verificar sanciones del usuario
    const uid = prestamoSeleccionado.value?.usuario?.id_usuario
    console.log('uid', uid)
    if (uid) {
      const { data } = await api.get(`/sanciones/usuario/${uid}/estado`)
      sancionUsuario.value = data?.data ?? data
      console.log('sancionUsuario', sancionUsuario.value)
    }
  } catch {
    ui.toast.error('Error', 'No se pudo registrar el pago')
  } finally { pagoLoading.value = false }
}

// ─── Modal de SANCIÓN por deterioro / pérdida ─────────────────────────────────
const modalSancionOpen = ref(false)
const sancionMotivo = ref<'DANIO_EJEMPLAR' | 'PERDIDA_EJEMPLAR'>('DANIO_EJEMPLAR')
const sancionMonto = ref('')
const sancionObs = ref('')
const sancionLoading2 = ref(false)

const MOTIVOS_SANCION = [
  { value: 'DANIO_EJEMPLAR', label: 'Daño al ejemplar' },
  { value: 'PERDIDA_EJEMPLAR', label: 'Pérdida del ejemplar' },
]

function abrirModalSancion(motivo: 'DANIO_EJEMPLAR' | 'PERDIDA_EJEMPLAR') {
  sancionMotivo.value = motivo
  sancionMonto.value = ''
  sancionObs.value = motivo === 'PERDIDA_EJEMPLAR'
    ? `Ejemplar perdido. Código: ${prestamoSeleccionado.value?.ejemplar?.codigoEjemplar ?? ''}`
    : `Ejemplar devuelto con daños. Condición entrega: ${prestamoSeleccionado.value?.condicionEntrega} → Devolución: ${condicionDevolucion.value}`
  modalSancionOpen.value = true
}

async function confirmarSancion() {
  const prestamo = prestamoSeleccionado.value
  if (!prestamo) return
  sancionLoading2.value = true
  try {
    const bibliotecaId = auth.user?.biblioteca?.id_biblioteca ?? auth.user?.biblioteca?.[0]?.id_biblioteca ?? 1
    await sancionStore.registrarManual({
      usuarioId: prestamo.usuario?.id_usuario ?? 0,
      bibliotecaId,
      prestamoId: prestamo.id_prestamo,
      motivo: sancionMotivo.value,
      montoFijo: sancionMonto.value ? parseFloat(sancionMonto.value) : null,
      observaciones: sancionObs.value || undefined,
    })
    ui.toast.success('Sanción aplicada', 'La sanción fue registrada correctamente')
    modalSancionOpen.value = false
    nuevaDevolucion()
  } catch {
    ui.toast.error('Error', 'No se pudo registrar la sanción')
  } finally { sancionLoading2.value = false }
}

function getPrestamoCardClass(p: Prestamo) {
  if (p.vencido || p.estadoPrestamo === 'VENCIDO') {
    return 'bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100'
  }

  return prestamoSeleccionado.value?.id_prestamo === p.id_prestamo
    ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
    : ''
}

</script>

<template>
  <div class="page-container space-y-6">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Devoluciones</h1>
        <p class="text-sm text-slate-500 mt-0.5">Registra la devolución de ejemplares prestados</p>
      </div>
      <!-- Modos -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
        <button @click="modo = 'lista'; limpiarSeleccion()" :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          modo === 'lista' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']">
          Lista pendientes
        </button>
        <button @click="modo = 'buscar'; limpiarSeleccion()" :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          modo === 'buscar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']">
          Buscar por ID
        </button>
      </div>
    </div>

    <!-- ═══════ LAYOUT PRINCIPAL ═══════ -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

      <!-- Columna izquierda: selector de préstamo -->
      <div class="lg:col-span-2 space-y-4">

        <!-- MODO: Lista de pendientes -->
        <div v-if="modo === 'lista'" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 space-y-3">
            <p class="font-semibold text-slate-800 text-sm">Préstamos pendientes</p>
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input v-model="searchLocal" type="text" placeholder="Filtrar..."
                class="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
            </div>
          </div>

          <!-- Loading -->
          <div v-if="pendientesLoading" class="p-4 space-y-2">
            <div v-for="i in 3" :key="i" class="h-16 bg-slate-100 rounded-xl animate-pulse" />
          </div>

          <!-- Sin pendientes -->
          <div v-else-if="!pendientesFiltrados.length" class="py-12 text-center">
            <div class="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p class="text-sm font-medium text-slate-500">¡Sin pendientes!</p>
            <p class="text-xs text-slate-400 mt-0.5">Todos los préstamos están al día</p>
          </div>

          <!-- Lista -->
          <div v-else class="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
            <button v-for="p in pendientesFiltrados" :key="p.id_prestamo" @click="seleccionarPrestamo(p)"
              :class="['w-full px-5 py-3.5 text-left transition-all hover:bg-slate-50',
                getPrestamoCardClass(p)]">
              <div class="flex items-start gap-3">
                <img v-if="p.ejemplar?.edicion?.imagenPortada" :src="getUrl(p.ejemplar.edicion.imagenPortada)"
                  alt="portada"
                  class="w-12 h-16 object-cover rounded-md border border-slate-200 shadow-sm flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-xs font-bold text-slate-400">#{{ p.id_prestamo }}</span>
                    <span v-if="p.vencido" class="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                      VENCIDO {{ diasVencido(p.fechaDevolucionEstimada) }}d
                    </span>
                    <span v-else class="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">{{
                      p.estadoPrestamo }}</span>
                  </div>
                  <p class="text-sm font-semibold text-slate-800 truncate leading-tight">
                    {{ p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? 'Sin título' }}
                  </p>
                  <p class="text-xs text-slate-600 truncate">
                    {{ p.usuario?.nombreCompleto ?? p.usuario?.username }}
                    <span class="text-slate-400">CI: {{ p.usuario?.ci }}</span>
                  </p>
                  <p class="text-xs text-slate-400">Vence: {{ formatDate(p.fechaDevolucionEstimada) }}</p>
                </div>
                <div v-if="prestamoSeleccionado?.id_prestamo === p.id_prestamo"
                  class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- MODO: Buscar por ID -->
        <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <p class="font-semibold text-slate-800 text-sm">Buscar préstamo por ID</p>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono">#</span>
              <input v-model="buscarId" type="number" placeholder="Ej: 7" @keydown.enter="buscarPorId"
                class="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
            </div>
            <button @click="buscarPorId" :disabled="!buscarId || buscarLoading"
              :class="['px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5',
                buscarId && !buscarLoading ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
              <svg v-if="buscarLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar
            </button>
          </div>
          <div v-if="buscarError"
            class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01" />
            </svg>
            {{ buscarError }}
          </div>
          <!-- Resultado de búsqueda -->
          <div v-if="prestamoSeleccionado && modo === 'buscar'"
            class="p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-indigo-400">#{{ prestamoSeleccionado.id_prestamo }}</span>
              <span v-if="prestamoSeleccionado.vencido" class="text-xs font-bold text-red-600">VENCIDO</span>
              <span v-else class="text-xs text-emerald-600 font-medium">{{ prestamoSeleccionado.estadoPrestamo }}</span>
            </div>
            <p class="text-sm font-semibold text-slate-800">
              {{ prestamoSeleccionado.ejemplar?.edicion?.titulo ?? prestamoSeleccionado.ejemplar?.libro?.titulo }}
            </p>
            <p class="text-xs text-slate-500 capitalize">
              {{ prestamoSeleccionado.usuario?.persona?.nombreCompleto ?? prestamoSeleccionado.usuario?.username }}
            </p>
            <p class="text-xs text-slate-400">Vence: {{ formatDate(prestamoSeleccionado.fechaDevolucionEstimada) }}</p>
          </div>
        </div>
      </div>

      <!-- Columna derecha: formulario de devolución -->
      <div class="lg:col-span-3">

        <!-- Sin selección -->
        <div v-if="!prestamoSeleccionado"
          class="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col items-center justify-center py-16 text-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p class="font-semibold text-slate-500">Selecciona un préstamo</p>
          <p class="text-sm text-slate-400 mt-1 max-w-xs">Elige un préstamo de la lista o busca por ID para registrar la
            devolución</p>
        </div>

        <!-- Éxito -->
        <div v-else-if="devolucionSuccess"
          class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-8 text-center space-y-4">
            <div class="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg class="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p class="text-lg font-bold text-slate-800">¡Devolución registrada!</p>
              <p class="text-sm text-slate-500 mt-1">El ejemplar ha sido devuelto correctamente</p>
            </div>

            <!-- Detalle del resultado -->
            <div v-if="devolucionResult" class="bg-slate-50 rounded-xl p-4 text-sm space-y-2 text-left">
              <div class="flex justify-between">
                <span class="text-slate-500">Préstamo #</span>
                <span class="font-medium">{{ prestamoSeleccionado.id_prestamo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Condición devuelta</span>
                <span
                  :class="['font-semibold', condicionTextColors[devolucionResult.condicionDevolucion as Condicion] ?? 'text-slate-700']">
                  {{ devolucionResult.condicionDevolucion }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Fecha real</span>
                <span class="font-medium">{{ formatDate(devolucionResult.fechaDevolucionReal) }}</span>
              </div>
            </div>

            <!-- Alerta de deterioro post-devolución + botones de sanción -->
            <div v-if="hayDeterioro || ejemplarPerdido" class="space-y-3">
              <div
                class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 text-left">
                <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{{
                  ejemplarPerdido
                    ? 'El ejemplar fue reportado como perdido.'
                    : 'El sistema detectó deterioro en la devolución.'
                }}
                  ¿Deseas aplicar una sanción al usuario?
                </span>
              </div>
              <div class="flex gap-2">
                <button v-if="hayDeterioro && !ejemplarPerdido" @click="abrirModalSancion('DANIO_EJEMPLAR')"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center justify-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Aplicar sanción por daño
                </button>
                <button v-if="ejemplarPerdido" @click="abrirModalSancion('PERDIDA_EJEMPLAR')"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Aplicar sanción por pérdida
                </button>
                <button @click="nuevaDevolucion"
                  class="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                  Omitir
                </button>
              </div>
            </div>

            <button v-else @click="nuevaDevolucion"
              class="w-full py-3 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              Registrar otra devolución
            </button>
          </div>
        </div>

        <!-- Formulario de devolución -->
        <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <!-- Header con info del préstamo -->
          <div :class="[
            'px-6 py-4 border-b',
            prestamoSeleccionado?.vencido
              ? 'bg-red-50 border-red-200'
              : 'bg-slate-50 border-slate-100'
          ]">
            <div class="flex items-start gap-4">
              <img v-if="prestamoSeleccionado.ejemplar?.edicion?.imagenPortada"
                :src="getUrl(prestamoSeleccionado.ejemplar.edicion.imagenPortada)" alt="portada"
                class="w-12 h-16 object-cover rounded-lg border border-slate-200 flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="text-xs font-bold text-slate-400">#{{ prestamoSeleccionado.id_prestamo }}</span>
                  <span v-if="prestamoSeleccionado.vencido"
                    class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    ⚠️ VENCIDO hace {{ diasVencido(prestamoSeleccionado.fechaDevolucionEstimada) }} días
                  </span>
                  <span v-else class="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {{ prestamoSeleccionado.estadoPrestamo }}
                  </span>
                </div>
                <p class="font-semibold text-slate-800 truncate">
                  {{ prestamoSeleccionado.ejemplar?.edicion?.titulo ?? prestamoSeleccionado.ejemplar?.libro?.titulo }}
                </p>
                <div class="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                  <span class="capitalize">{{ prestamoSeleccionado.usuario?.nombreCompleto ??
                    prestamoSeleccionado.usuario?.username }}</span>
                  <span>·</span>
                  <span>{{ prestamoSeleccionado.ejemplar?.codigoEjemplar ??
                    prestamoSeleccionado.ejemplar?.codigo_ejemplar }}</span>
                  <span>· Prestado: {{ formatDate(prestamoSeleccionado.fechaPrestamo) }}</span>
                </div>
              </div>
              <button @click="limpiarSeleccion"
                class="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div  :class="[
            'p-6 space-y-6',
            prestamoSeleccionado?.vencido
              ? 'bg-red-50/30'
              : ''
          ]">
            <!-- ═══ BLOQUE DE SANCIONES ACTIVAS ═══════════════════════════ -->
            <div v-if="sancionLoading"
              class="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-500">
              <svg class="w-4 h-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Verificando sanciones del usuario...
            </div>

            <!-- <div v-else-if="bloqueadoPorDeuda && sancionUsuario" -->
            <div v-else-if="bloqueadoPorPrestamo && sancionPrestamoActual"
              class="rounded-xl border-2 border-red-200 overflow-hidden">
              <!-- Banner de alerta -->
              <div class="flex items-center gap-3 px-4 py-3 bg-red-50">
                <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-red-700">Usuario con sanciones activas</p>
                  <p class="text-xs text-red-600 mt-0.5">
                    <span v-if="sancionUsuario.tieneDeudaPendiente">
                      Deuda pendiente: <strong>Bs {{ sancionPrestamoActual?.montoMulta?.toFixed(2) ?? '—' }}</strong>
                    </span>
                    <span v-if="sancionUsuario.tieneSuspensionVigente && sancionUsuario.tieneDeudaPendiente"> · </span>
                    <span v-if="sancionUsuario.tieneSuspensionVigente">
                      Suspensión hasta: <strong>{{ sancionUsuario.fechaFinSuspensionMasProxima ?? '—' }}</strong>
                    </span>
                  </p>
                </div>
              </div>

              <!-- Opciones de resolución -->
              <div class="px-4 py-3 bg-white space-y-3">
                <p class="text-xs text-slate-500 font-medium">¿Cómo deseas proceder?</p>
                <div class="flex flex-col gap-2">
                  <!-- Registrar pago -->
                  <button v-if="sancionUsuario.tieneDeudaPendiente" @click="abrirPagoDeuda"
                    class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 transition-all text-left">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-emerald-800">Registrar pago de deuda</p>
                      <p class="text-xs text-emerald-600">Saldar la deuda antes de procesar la devolución</p>
                    </div>
                    <svg class="w-4 h-4 text-emerald-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <!-- Proceder de todos modos (override del bibliotecario) -->
                  <button @click="omitirBloqueo = true"
                    class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left">
                    <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M13 16h-1v-4h-1m1-4h.01" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-slate-700">Proceder de todas formas</p>
                      <p class="text-xs text-slate-500">Registrar la devolución ignorando la sanción pendiente</p>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Banner si el bibliotecario decide omitir -->
              <div v-if="omitirBloqueo"
                class="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-t border-amber-200">
                <svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01" />
                </svg>
                <p class="text-xs text-amber-700 font-medium">Continuando con sanción pendiente. Completa el formulario
                  y confirma la devolución.</p>
                <button @click="omitirBloqueo = false"
                  class="ml-auto text-amber-500 hover:text-amber-700 text-xs underline">Cancelar</button>
              </div>
            </div>

            <!-- Sanción OK / sin sanciones -->
            <div v-else-if="sancionUsuario && !bloqueadoPorPrestamo"
              class="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Usuario sin sanciones activas — puede proceder con la devolución
            </div>

            <!-- Comparación de condición -->
            <!-- <div> -->
            <div :class="{ 'opacity-50 pointer-events-none': bloqueadoPorPrestamo && !omitirBloqueo }">

              <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-semibold text-slate-700">Condición del ejemplar</label>
                <span v-if="hayDeterioro"
                  class="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01" />
                  </svg>
                  Deterioro detectado
                </span>
              </div>

              <!-- Comparación visual entrega → devolución -->
              <div class="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
                <div class="flex-1 text-center">
                  <p class="text-xs text-slate-400 mb-1">Al entregar</p>
                  <span
                    :class="['inline-block px-3 py-1.5 rounded-lg text-xs font-bold border-2',
                      condicionColors[(prestamoSeleccionado.condicionEntrega as Condicion) ?? 'BUENO'] ?? 'border-slate-200 bg-slate-50 text-slate-500']">
                    {{ prestamoSeleccionado.condicionEntrega ?? 'N/D' }}
                  </span>
                </div>
                <svg class="w-5 h-5 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div class="flex-1 text-center">
                  <p class="text-xs text-slate-400 mb-1">Al devolver</p>
                  <span :class="['inline-block px-3 py-1.5 rounded-lg text-xs font-bold border-2',
                    condicionColors[condicionDevolucion]]">
                    {{ condicionDevolucion }}
                  </span>
                </div>
              </div>

              <!-- Selector de condición devolución -->
              <div class="grid grid-cols-4 gap-2">
                <button v-for="c in CONDICIONES" :key="c" @click="condicionDevolucion = c"
                  :class="['py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
                    condicionDevolucion === c ? condicionColors[c] : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                  {{ c }}
                </button>
              </div>
            </div>

            <!-- Estado físico del ejemplar -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-3">Estado físico del ejemplar</label>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="e in ESTADO_EJEMPLAR_OPTIONS" :key="e" @click="estadoEjemplar = e"
                  :class="['py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
                    estadoEjemplar === e ? estadoEjemplarColors[e] : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                  <span v-if="e === 'DISPONIBLE'">✓ DISPONIBLE</span>
                  <span v-else-if="e === 'DETERIORADO'">⚠ DETERIORADO</span>
                  <span v-else-if="e === 'DAÑADO'">✗ DAÑADO</span>
                  <span v-else>⊘ PERDIDO</span>
                </button>
              </div>
              <!-- Sugerencia automática -->
              <p v-if="hayDeterioro" class="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01" />
                </svg>
                Estado sugerido automáticamente · Puedes ajustarlo
              </p>
              <!-- Aviso de pérdida -->
              <div v-if="ejemplarPerdido"
                class="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>El ejemplar será marcado como <strong>perdido</strong>. Se podrá aplicar sanción por pérdida
                  tras
                  confirmar la devolución.</span>
              </div>
            </div>

            <!-- Observaciones -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Observaciones</label>
              <textarea v-model="observaciones" rows="3"
                :placeholder="ejemplarPerdido ? 'Describe las circunstancias de la pérdida...' : hayDeterioro ? 'Describe el daño observado...' : 'Notas adicionales (opcional)...'"
                class="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none" />
            </div>

            <!-- Error -->
            <div v-if="devolucionError"
              class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ devolucionError }}
            </div>

            <!-- Botón confirmar -->
            <button @click="confirmarDevolucion" :disabled="!puedeConfirmar" :class="['w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              puedeConfirmar
                ? ejemplarPerdido
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200 active:scale-[0.98]'
                  : hayDeterioro
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 active:scale-[0.98]'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
              <svg v-if="devolucionLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <svg v-else-if="ejemplarPerdido" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <svg v-else-if="hayDeterioro" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{
                devolucionLoading ? 'Registrando...' :
                  !puedeConfirmar && bloqueadoPorPrestamo ? 'Resuelve la sanción para continuar' :
                    ejemplarPerdido ? 'Confirmar devolución — ejemplar perdido' :
                      hayDeterioro ? 'Confirmar devolución con deterioro' :
                        'Confirmar devolución'
              }}
            </button>

          </div>


        </div>
      </div>
    </div>
    <!-- modales -->
    <!-- ═══ MODAL: PAGO DE DEUDA INLINE ══════════════════════════════════════ -->
    <ModalPago v-model="modalPagoOpen" :sancion="sancionSeleccionada" @pagado="fetchPendientes" />
    <!-- <ModalPago v-model="modalPagoOpen" :sancion="sancionSeleccionada" @pagado="seleccionarPrestamo" /> -->

    <!-- ═══ MODAL: SANCIÓN POR DETERIORO / PÉRDIDA ═══════════════════════════ -->
    <SModal v-model="modalSancionOpen"
      :title="sancionMotivo === 'PERDIDA_EJEMPLAR' ? 'Sanción por pérdida' : 'Sanción por daño'" size="md">
      <div class="space-y-4">
        <!-- Info del préstamo / ejemplar -->
        <div class="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-slate-500">Préstamo</span>
            <span class="font-medium">#{{ prestamoSeleccionado?.id_prestamo }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Ejemplar</span>
            <span class="font-medium">{{ prestamoSeleccionado?.ejemplar?.codigoEjemplar ??
              prestamoSeleccionado?.ejemplar?.codigo_ejemplar }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Usuario</span>
            <span class="font-medium capitalize">{{ prestamoSeleccionado?.usuario?.persona?.nombreCompleto ??
              prestamoSeleccionado?.usuario?.username }}</span>
          </div>
          <div v-if="sancionMotivo === 'DANIO_EJEMPLAR'" class="flex justify-between">
            <span class="text-slate-500">Condición</span>
            <span class="font-medium">
              <span :class="condicionTextColors[(prestamoSeleccionado?.condicionEntrega as Condicion) ?? 'BUENO']">{{
                prestamoSeleccionado?.condicionEntrega }}</span>
              → <span :class="condicionTextColors[condicionDevolucion]">{{ condicionDevolucion }}</span>
            </span>
          </div>
        </div>

        <!-- Motivo (editable) -->
        <SSelect v-model="sancionMotivo" label="Motivo" :options="[
          { value: 'DANIO_EJEMPLAR', label: 'Daño al ejemplar' },
          { value: 'PERDIDA_EJEMPLAR', label: 'Pérdida del ejemplar' },
        ]" :required="true" />

        <!-- Monto -->
        <SInput v-model="sancionMonto" label="Monto de multa (Bs)" type="number" placeholder="Ej: 50.00"
          help-text="Dejar en blanco para aplicar monto según configuración" />

        <!-- Observaciones -->
        <SInput v-model="sancionObs" type="textarea" label="Observaciones"
          placeholder="Describe el estado del ejemplar u otras notas relevantes..." />
      </div>
      <template #footer>
        <SButton variant="secondary" @click="modalSancionOpen = false">Cancelar</SButton>
        <SButton variant="danger" :loading="sancionLoading2" @click="confirmarSancion">
          Aplicar sanción
        </SButton>
      </template>
    </SModal>
  </div>

</template>