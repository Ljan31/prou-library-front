<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import TicketPrestamo, { type PrestamoTicket, type UsuarioTicket } from '@/components/bibliotecas/TicketPrestamo.vue'
import api from '@/services/axios'
import defaultBookImage from '../../assets/book-default.jpeg'

// ─── Breadcrumbs ────────────────────────────────────────────────────────────
const ui = useUiStore()
const auth = useAuthStore()

onMounted(async () => {
  ui.setBreadcrumbs([
    { label: 'Préstamos', to: '/prestamos' },
    { label: 'Nuevo Préstamo' }
  ])
  // fetchPrestamos()
  await loadBibliotecaConfig()
  fechaDevolucion.value = calcFechaDevolucion()
})

const CONDICIONES = ['EXCELENTE', 'BUENO', 'REGULAR', 'DAÑADO'] as const
type Condicion = typeof CONDICIONES[number]

const TIPOS_PRESTAMO = ['DOMICILIO', 'SALA'] as const
type TipoPrestamo = typeof TIPOS_PRESTAMO[number]

const TIPOS_DOCUMENTO = ['CI', 'MATRICULA'] as const
type TipoDocumento = typeof TIPOS_DOCUMENTO[number]

const condicionColors: Record<Condicion, string> = {
  EXCELENTE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  BUENO: 'border-blue-500 bg-blue-50 text-blue-700',
  REGULAR: 'border-amber-500 bg-amber-50 text-amber-700',
  DAÑADO: 'border-red-500 bg-red-50 text-red-700',
}

interface ReglasConfig {
  idConfig: number
  diasPrestamoMax: number | null
  renovacionesMax: number | null
  ejemplaresPermitidos: number | null
  multaPorDia: number | null
  multaMaxDias: number | null
  diasSuspension: number | null
}

interface EstadoSancion {
  usuarioId: number
  tieneSuspensionVigente: boolean
  tieneDeudaPendiente: boolean
  totalSancionesActivas: number
  fechaFinSuspensionMasProxima: string | null
}
// ─── Types ───────────────────────────────────────────────────────────────────
interface UsuarioResult {
  id_usuario: number
  username: string
  persona: {
    nombreCompleto: string
    ci: number | string
    matricula: string | null
    domicilio?: string
    celular?: string
  }
}

interface LibroResult {
  id_libro: number
  titulo: string
  isbn: string
  editorial: string
  ejemplaresDisponibles: number
}

interface Ejemplar {
  id_ejemplar: number
  codigo_ejemplar: string
  estadoEjemplar: string
  ubicacionFisica?: string
  edicion?: { titulo?: string; editorial?: string; edicion?: string; anoPublicacion?: number; isbn?: string; imagenPortada?: string }
}
interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'RENOVADO' | 'DEVUELTO'
  vencido: boolean
  usuario?: { persona?: { nombreCompleto?: string }; username?: string }
  ejemplar?: { libro?: { titulo?: string }; codigo_ejemplar?: string }
  fechaPrestamo?: string
  fechaDevolucionEstimada?: string
  fechaDevolucionReal?: string
}
// Item del lote de préstamo
interface LoteItem {
  id: string // uuid local
  libro: LibroResult | null
  ejemplar: Ejemplar | null
  condicionEntrega: Condicion
  // búsqueda
  bookQuery: string
  bookResults: LibroResult[]
  bookLoading: boolean
  bookDropdownOpen: boolean
  ejemplares: Ejemplar[]
  ejemplaresLoading: boolean
}

// ─── CONFIGURACIÓN DE BIBLIOTECA ─────────────────────────────────────────────
const configLoading = ref(false)
const reglasDomicilio = ref<ReglasConfig | null>(null)
const reglasSala = ref<ReglasConfig | null>(null)

async function loadBibliotecaConfig() {
  const biblId = auth.user?.biblioteca?.id_biblioteca ?? auth.user?.biblioteca?.[0]?.id_biblioteca
  if (!biblId) return
  configLoading.value = true
  try {
    const [rDom, rSala] = await Promise.all([
      api.get(`/configuraciones-prestamo/biblioteca/${biblId}/reglas`, { params: { tipoPrestamo: 'DOMICILIO' } }),
      api.get(`/configuraciones-prestamo/biblioteca/${biblId}/reglas`, { params: { tipoPrestamo: 'SALA' } }),
    ])
    reglasDomicilio.value = rDom.data?.data ?? rDom.data
    reglasSala.value = rSala.data?.data ?? rSala.data
  } catch {
    // Config opcional — el sistema sigue funcionando sin ella
  } finally {
    configLoading.value = false
  }
}

const reglasActivas = computed<ReglasConfig | null>(() =>
  tipoPrestamo.value === 'DOMICILIO' ? reglasDomicilio.value : reglasSala.value
)
const hoy = new Date().toISOString().split('T')[0]
const maxEjemplares = computed<number>(() => reglasActivas.value?.ejemplaresPermitidos ?? 5)

// ─── Paso activo ─────────────────────────────────────────────────────────────
const step = ref<1 | 2 | 3 | 4>(1)

const tipoPrestamo = ref<TipoPrestamo>('DOMICILIO')

watch(tipoPrestamo, () => {
  // Recalcular fecha devolución según config
  fechaDevolucion.value = calcFechaDevolucion()
})

function calcFechaDevolucion(): string {
  const dias = reglasActivas.value?.diasPrestamoMax ?? 14
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

// ─── TAB VIEW ────────────────────────────────────────────────────────────────
type TabView = 'nuevo' | 'lista'
const activeTab = ref<TabView>('nuevo')

// ─── PASO 1: Búsqueda de usuario ─────────────────────────────────────────────
const userQuery = ref('')
const userResults = ref<UsuarioResult[]>([])
const userLoading = ref(false)
const userDropdownOpen = ref(false)
const selectedUser = ref<UsuarioResult | null>(null)
const sancionEstado = ref<EstadoSancion | null>(null)
const sancionLoading = ref(false)
let userDebounce: ReturnType<typeof setTimeout>

watch(userQuery, (val) => {
  clearTimeout(userDebounce)
  if (!val || val.length < 2) {
    userResults.value = []
    userDropdownOpen.value = false
    return
  }
  userDebounce = setTimeout(() => searchUsers(val), 300)
})

async function searchUsers(q: string) {
  userLoading.value = true
  try {
    const { data } = await api.get('/users/search', { params: { q } })
    userResults.value = data?.data ?? []
    // userDropdownOpen.value = true
    // userDropdownOpen.value = userResults.value.length > 0
    userDropdownOpen.value = true
  } catch {
    userResults.value = []
  } finally {
    userLoading.value = false
  }
}

async function selectUser(u: UsuarioResult) {
  selectedUser.value = u
  userQuery.value = u.persona.nombreCompleto
  userDropdownOpen.value = false
  sancionEstado.value = null
  // Verificar sanciones inmediatamente
  sancionLoading.value = true
  try {
    const { data } = await api.get(`/sanciones/usuario/${u.id_usuario}/estado`)
    sancionEstado.value = data?.data ?? data
    // console.log("✅ Data final procesada:", sancionEstado.value)
  } catch (error) {
    sancionEstado.value = null
  } finally {
    sancionLoading.value = false
  }
}

function resetUser() {
  selectedUser.value = null
  userQuery.value = ''
  userResults.value = []
  step.value = 1
  resetLote()
}

function highlight(text: string, query: string): string {
  if (!query) return text
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, '<mark class="bg-indigo-100 text-indigo-700 rounded-sm px-0.5">$1</mark>')
}

const usuarioSancionado = computed(() => sancionEstado.value?.tieneDeudaPendiente === true)
// const usuarioSancionado = computed(() => sancionEstado.value?.tieneSuspensionVigente === true)
const usuarioBloqueado = computed(() => {
  if (!sancionEstado.value) return false

  return (
    sancionEstado.value.tieneSuspensionVigente === true ||
    sancionEstado.value.tieneDeudaPendiente === true
  )
})
const mensajeSancion = computed(() => {
  if (!sancionEstado.value) return ''

  const tieneSuspension = sancionEstado.value.tieneSuspensionVigente
  const tieneDeuda = sancionEstado.value.tieneDeudaPendiente

  if (tieneSuspension && tieneDeuda) {
    return 'Usuario con suspensión activa y deuda pendiente'
  }
  if (tieneSuspension) {
    return 'Usuario con suspensión vigente'
  }
  if (tieneDeuda) {
    return 'Usuario con deuda pendiente'
  }
  return ''
})
const detalleSancion = computed(() => {
  if (!sancionEstado.value) return ''

  let texto = ''

  if (sancionEstado.value.tieneSuspensionVigente && sancionEstado.value.fechaFinSuspensionMasProxima) {
    texto += `Suspensión hasta: ${sancionEstado.value.fechaFinSuspensionMasProxima}`
  }

  if (sancionEstado.value.tieneDeudaPendiente) {
    if (texto) texto += ' • '
    texto += 'Tiene deuda pendiente'
  }

  if (sancionEstado.value.totalSancionesActivas > 0) {
    if (texto) texto += ' • '
    texto += `${sancionEstado.value.totalSancionesActivas} sanciones activas`
  }

  return texto
})
// ─── PASO 2: Búsqueda de libro ───────────────────────────────────────────────

function crearItem(): LoteItem {
  return {
    id: Math.random().toString(36).slice(2),
    libro: null, ejemplar: null,
    condicionEntrega: null,
    bookQuery: '', bookResults: [], bookLoading: false, bookDropdownOpen: false,
    ejemplares: [], ejemplaresLoading: false,
  }
}
const lote = ref<LoteItem[]>([crearItem()])
let bookDebounces: Record<string, ReturnType<typeof setTimeout>> = {}

function agregarLibro() {
  if (lote.value.length >= maxEjemplares.value) {
    ui.toast.warning('Límite alcanzado', `Máximo ${maxEjemplares.value} ejemplares en préstamo ${tipoPrestamo.value.toLowerCase()}`)
    return
  }
  lote.value.push(crearItem())
}

function eliminarItem(id: string) {
  if (lote.value.length === 1) return
  delete bookDebounces[id]
  lote.value = lote.value.filter(i => i.id !== id)
}

function resetLote() {
  bookDebounces = {}
  lote.value = [crearItem()]
}
function onBookQueryChange(item: LoteItem, val: string) {
  clearTimeout(bookDebounces[item.id])
  if (!val || val.length < 2) { item.bookResults = []; return }
  bookDebounces[item.id] = setTimeout(() => searchBooks(item, val), 500)
}

async function searchBooks(item: LoteItem, q: string) {
  item.bookLoading = true
  try {
    const user = auth.user
    const autorizado = (user?.roles ?? []).some(r => ['ROLE_BIBLIOTECARIO', 'ROLE_AUXILIAR'].includes(r))
    const biblId = user?.biblioteca?.[0]?.id_biblioteca
    const params: Record<string, unknown> = { q }
    if (autorizado && biblId) params.bibliotecaId = biblId
    const { data } = await api.get('/libros/search', { params })
    item.bookResults = data.data ?? []
    item.bookDropdownOpen = true
  } catch { item.bookResults = [] }
  finally { item.bookLoading = false }
}

async function selectBook(item: LoteItem, b: LibroResult) {
  item.libro = b; item.bookQuery = b.titulo; item.bookDropdownOpen = false
  item.ejemplar = null; item.ejemplares = []
  item.ejemplaresLoading = true
  try {
    const biblId = auth.user?.biblioteca?.[0]?.id_biblioteca
    if (!biblId) { item.ejemplaresLoading = false; return }
    const { data } = await api.get(`/ejemplares/libro/${b.idLibro ?? b.id_libro}/biblioteca`, {
      params: { bibliotecaId: biblId, estado: 'DISPONIBLE' }
    })
    item.ejemplares = data.data ?? []
  } catch { item.ejemplares = [] }
  finally { item.ejemplaresLoading = false }
}

function resetItem(item: LoteItem) {
  item.libro = null; item.bookQuery = ''; item.bookResults = []
  item.ejemplar = null; item.ejemplares = []; item.bookDropdownOpen = false
}

const loteCompleto = computed(() =>
  lote.value.length > 0 && lote.value.every(i => i.libro && i.ejemplar)
)
// ─── PASO 4: Confirmación ─────────────────────────────────────────────────────
const fechaDevolucion = ref(calcFechaDevolucion())
// const condicionEntrega = ref<Condicion>('BUENO')
const tipoDocumento = ref<TipoDocumento>('CI')
const observaciones = ref('')
const confirmLoading = ref(false)
const confirmError = ref<string | null>(null)
const confirmSuccess = ref(false)
// const prestamoCreado = ref<{ id_prestamo: number } | null>(null)

const canConfirm = computed(() =>
  !!selectedUser.value && loteCompleto.value && !!fechaDevolucion.value && !usuarioBloqueado.value &&
  lote.value.every(item => !!item.condicionEntrega)
)
async function confirmarPrestamo() {
  if (!canConfirm.value) return
  confirmLoading.value = true
  confirmError.value = null
  confirmSuccess.value = false
  prestamosParaTicket.value = []
  const biblId = auth.user?.biblioteca?.id_biblioteca ?? auth.user?.biblioteca?.[0]?.id_biblioteca ?? 1

  try {
    const resultados = await Promise.all(
      lote.value.map(item =>
        api.post('/prestamos', {
          usuarioId: selectedUser.value!.id_usuario,
          ejemplarId: item.ejemplar!.id_ejemplar,
          bibliotecaId: biblId,
          tipoPrestamo: tipoPrestamo.value,
          condicionEntrega: item.condicionEntrega,
          tipoDocumentoGarantia: tipoDocumento.value,
          fechaDevolucionEstimada: tipoPrestamo.value === 'SALA' ? null : fechaDevolucion.value,
          observaciones: observaciones.value || 'Préstamo registrado',
        }).then(r => ({
          id_prestamo: r.data?.data?.id_prestamo ?? r.data?.id_prestamo,
          ejemplar: item.ejemplar!,
          libro: item.libro!,
        }))
      )
    )

    prestamosParaTicket.value = resultados.map((p: any) => ({
      ...p,
      tipoDocumentoGarantia: tipoDocumento.value,
      bibliotecarioPrestamo: {
        id_usuario: auth.user.id,
        username: auth.user.username,
        nombreCompleto: auth.user.persona.nombreCompleto,
        ci: auth.user.persona.ci,
        email: auth.user.persona.email ?? null
      }
    }))
    usuarioParaTicket.value = selectedUser.value as UsuarioTicket
    confirmSuccess.value = true
    ui.toast.success('¡Préstamos registrados!', `Se registraron ${resultados.length} préstamo(s) correctamente`)
    // setTimeout(() => resetForm(), 2000)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    confirmError.value = msg ?? 'No se pudo registrar uno o más préstamos'
    ui.toast.error('Error', confirmError.value!)
  } finally {
    confirmLoading.value = false
  }
}

function resetForm() {
  resetUser()
  step.value = 1
  fechaDevolucion.value = calcFechaDevolucion()
  tipoPrestamo.value = 'DOMICILIO'
  // condicionEntrega.value = 'BUENO';
  tipoDocumento.value = 'CI'
  observaciones.value = ''
  confirmSuccess.value = false
  confirmError.value = null
  prestamosParaTicket.value = []; usuarioParaTicket.value = null
  // fetchPrestamos()
}
// ─── TICKET DE IMPRESIÓN ──────────────────────────────────────────────────────
const showTicket = ref(false)
const prestamosParaTicket = ref<PrestamoTicket[]>([])
const usuarioParaTicket = ref<UsuarioTicket | null>(null)
// const prestamosCreados = ref<{ id_prestamo: number; ejemplar?: Ejemplar; libro?: LibroResult }[]>([])

function abrirTicket() { showTicket.value = true }
function cerrarTicket() { showTicket.value = false }

function imprimirTicket() {
  const el = document.getElementById('ticket-print-area')
  if (!el) return
  const w = window.open('', '_blank', 'width=380,height=700')
  if (!w) return
  w.document.write(`
    <html><head><title>Ticket Préstamo SIGEB</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; font-size: 11px; width: 350px; padding: 12px; color: #000; }
      .logo { text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 2px; margin-bottom: 4px; }
      .subtitle { text-align: center; font-size: 9px; color: #555; margin-bottom: 12px; border-bottom: 1px dashed #999; padding-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      td { padding: 2px 4px; font-size: 10px; vertical-align: top; }
      td:first-child { font-weight: bold; width: 38%; }
      .divider { border-top: 1px dashed #999; margin: 8px 0; }
      .section-title { font-weight: bold; font-size: 10px; margin: 6px 0 3px; text-transform: uppercase; }
      .firma { margin-top: 28px; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 9px; }
    </style></head><body>
    ${el.innerHTML}
    </body></html>
  `)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 300)
}

function formatDateTicket(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const now = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })

</script>

<template>
  <div class="space-y-6">

    <!-- Stepper -->
    <div class="flex items-center gap-0">
      <template v-for="(label, i) in ['Usuario', 'Libros', 'Confirmar']" :key="i">
        <div class="flex items-center gap-2">
          <div :class="[
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
            step > i + 1
              ? 'bg-emerald-500 text-white'
              : step === i + 1
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-slate-200 text-slate-400'
          ]">
            <svg v-if="step > i + 1" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span :class="[
            'text-xs font-medium hidden sm:block',
            step === i + 1 ? 'text-indigo-600' : step > i + 1 ? 'text-emerald-600' : 'text-slate-400'
          ]">{{ label }}</span>
        </div>
        <div v-if="i < 2"
          :class="['flex-1 h-0.5 mx-2 transition-colors duration-500', step > i + 1 ? 'bg-emerald-400' : 'bg-slate-200']" />
      </template>
    </div>

    <!-- Cards del flujo -->
    <div class="">
      <!-- ═══ PASO 1: USUARIO ═══ -->
      <div v-if="step === 1" class="max-w-xl space-y-4">

        <!-- Tipo de préstamo -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p class="text-sm font-semibold text-slate-700 mb-3">Tipo de préstamo <span class="text-red-400">*</span></p>
          <div class="grid grid-cols-2 gap-3">
            <button v-for="t in TIPOS_PRESTAMO" :key="t" @click="tipoPrestamo = t"
              :class="['py-4 rounded-xl border-2 transition-all text-left px-4',
                tipoPrestamo === t ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white']">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-lg">{{ t === 'DOMICILIO' ? '🏠' : '📖' }}</span>
                <span :class="['text-sm font-bold', tipoPrestamo === t ? 'text-indigo-700' : 'text-slate-700']">{{ t
                }}</span>
              </div>
              <p class="text-xs text-slate-400">
                <template v-if="t === 'DOMICILIO'">
                  {{ reglasActivas?.diasPrestamoMax ? `${reglasActivas.diasPrestamoMax} días · Max
                  ${reglasActivas.ejemplaresPermitidos ?? '?'} ej.` : 'Préstamo para llevar a casa' }}
                </template>
                <template v-else>
                  {{ reglasSala?.ejemplaresPermitidos ? `Max ${reglasSala.ejemplaresPermitidos} ej. · Sin límite de
                  días` : 'Solo dentro de la biblioteca' }}
                </template>
              </p>
            </button>
          </div>
        </div>

        <!-- Buscar usuario -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div :class="['w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                selectedUser ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700']">1</div>
              <span class="font-semibold text-slate-800">Buscar Usuario</span>
            </div>
            <button v-if="selectedUser" @click="resetUser"
              class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cambiar
            </button>
          </div>
          <div class="p-5">
            <!-- Usuario seleccionado -->
            <template v-if="selectedUser">
              <div :class="['flex items-center gap-3 p-3 rounded-xl border',
                usuarioSancionado ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100']">
                <div :class="['w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                  usuarioSancionado ? 'bg-red-500' : 'bg-indigo-600']">
                  {{ selectedUser.persona.nombreCompleto.charAt(0).toUpperCase() }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-slate-800 text-sm capitalize">{{ selectedUser.persona.nombreCompleto }}
                  </p>
                  <p class="text-xs text-slate-500">CI: {{ selectedUser.persona.ci }}<span
                      v-if="selectedUser.persona.matricula"> · Mat: {{ selectedUser.persona.matricula }}</span></p>
                </div>
                <div v-if="sancionLoading">
                  <svg class="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
                <svg v-else-if="!usuarioBloqueado" class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <svg v-else class="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <!-- Alerta de sanción -->
              <div v-if="usuarioBloqueado && sancionEstado"
                class="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div class="flex-1">
                  <p class="font-semibold">{{ mensajeSancion }}</p>
                  <p class="text-xs mt-1 text-red-600">{{ detalleSancion }}</p>
                </div>
              </div>
              <!-- Botón continuar -->
              <button v-if="!usuarioBloqueado && !sancionLoading" @click="step = 2"
                class="mt-4 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                Continuar con selección de libros
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <!-- Mensaje si está bloqueado -->
              <div v-else-if="usuarioBloqueado" class="mt-4 text-center text-red-600 text-sm font-medium">
                Este usuario no puede realizar préstamos en este momento
              </div>
            </template>
            <!-- Buscador -->
            <div v-else class="relative">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input v-model="userQuery" type="text" placeholder="Buscar por nombre, CI o matrícula..."
                  class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                <div v-if="userLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg class="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
              </div>
              <div v-if="userDropdownOpen && userResults.length"
                class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                <button v-for="u in userResults" :key="u.id_usuario" @click="selectUser(u)"
                  class="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0">
                  <div
                    class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs flex-shrink-0">
                    {{ u.persona.nombreCompleto.charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-slate-800 capitalize"
                      v-html="highlight(u.persona.nombreCompleto, userQuery)" />
                    <p class="text-xs text-slate-400">CI: {{ u.persona.ci }}<span v-if="u.persona.matricula"> · Mat: {{
                      u.persona.matricula }}</span></p>
                  </div>
                </button>
              </div>
              <div v-else-if="userDropdownOpen && !userResults.length && !userLoading"
                class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-20 py-6 text-center">
                <p class="text-sm text-slate-400">Sin resultados para "{{ userQuery }}"</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ PASO 2: LOTE DE LIBROS ═══ -->
      <div v-if="step === 2" class="space-y-4">
        <!-- <div v-if="step === 2" class="grid grid-cols-1 lg:grid-cols-2 gap-6"> -->

        <!-- Info usuario + tipo -->
        <div class="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div
            class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {{ selectedUser?.persona.nombreCompleto.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-800 capitalize">{{ selectedUser?.persona.nombreCompleto }}</p>
            <p class="text-xs text-slate-400">CI: {{ selectedUser?.persona.ci }}</p>
          </div>
          <span :class="['text-xs font-bold px-2.5 py-1 rounded-full',
            tipoPrestamo === 'DOMICILIO' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700']">
            {{ tipoPrestamo === 'DOMICILIO' ? '🏠 DOMICILIO' : '📖 SALA' }}
          </span>
          <button @click="step = 1"
            class="text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium">Cambiar</button>
        </div>

        <!-- Límite -->
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-slate-700">
            Libros seleccionados
            <span class="ml-2 text-xs font-normal text-slate-400">({{ lote.length }}/{{ maxEjemplares }} ejemplares
              permitidos)</span>
          </p>
          <button @click="agregarLibro" :disabled="lote.length >= maxEjemplares" :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
            lote.length < maxEjemplares
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Agregar libro
          </button>
        </div>

        <!-- Ítems del lote -->
        <!-- <div class="space-y-4"> -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="(item, idx) in lote" :key="item.id"
            class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
            <div class="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div :class="['w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold',
                  item.ejemplar ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700']">
                  {{ idx + 1 }}
                </div>
                <span class="text-sm font-semibold text-slate-700">
                  {{ item.libro ? item.libro.titulo : `Libro ${idx + 1}` }}
                </span>
              </div>
              <button v-if="lote.length > 1" @click="eliminarItem(item.id)"
                class="text-slate-300 hover:text-red-500 transition-colors p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="p-4 space-y-4">
              <!-- Libro seleccionado -->
              <div v-if="item.libro"
                class="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800">{{ item.libro.titulo }}</p>
                  <p class="text-xs text-slate-500">{{ item.libro.isbn }} · {{ item.libro.editorial }}</p>
                </div>
                <button @click="resetItem(item)" class="text-slate-300 hover:text-red-400 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div v-if="item.ejemplar" @click="item.ejemplar = null"
                class="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition">

                <img :src="item.ejemplar.edicion?.imagenPortada || defaultBookImage"
                  class="w-10 h-14 object-cover rounded-lg border border-slate-100" />

                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800">
                    {{ item.ejemplar.codigoEjemplar }}
                  </p>
                  <p class="text-xs text-slate-500">
                    {{ item.ejemplar.edicion?.editorial }} · {{ item.ejemplar.edicion?.edicion }}
                  </p>
                  <p v-if="item.ejemplar.ubicacionFisica" class="text-xs text-emerald-600 font-medium">
                    📍 {{ item.ejemplar.ubicacionFisica }}
                  </p>
                </div>

                <span class="text-xs text-emerald-700 font-semibold">
                  Cambiar
                </span>
              </div>

              <!-- Búsqueda de libro -->
              <div v-else class="relative">
                <div class="relative">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input v-model="item.bookQuery" type="text" :placeholder="`Buscar libro ${idx + 1}...`"
                    @input="onBookQueryChange(item, item.bookQuery)"
                    class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                  <div v-if="item.bookLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg class="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </div>
                </div>
                <div v-if="item.bookDropdownOpen && item.bookResults.length"
                  class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
                  <button v-for="b in item.bookResults" :key="b.id_libro" @click="selectBook(item, b)"
                    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-800" v-html="highlight(b.titulo, item.bookQuery)" />
                      <p class="text-xs text-slate-400">{{ b.isbn }} · {{ b.editorial }}</p>
                    </div>
                    <span :class="['text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                      b.ejemplaresDisponibles > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500']">
                      {{ b.ejemplaresDisponibles > 0 ? `✓ ${b.ejemplaresDisponibles}` : '✗ 0' }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Selección de ejemplar (si hay libro) -->
              <div v-if="item.libro && !item.ejemplar">
                <p class=" text-xs font-medium text-slate-500 mb-2">Seleccionar ejemplar</p>
                <div v-if="item.ejemplaresLoading" class="space-y-2">
                  <div v-for="i in 2" :key="i" class="h-16 bg-slate-100 rounded-xl animate-pulse" />
                </div>
                <div v-else-if="!item.ejemplares.length"
                  class="text-center py-4 bg-red-50 rounded-xl border border-red-100">
                  <p class="text-sm text-red-600 font-medium">No hay ejemplares disponibles</p>
                </div>
                <div v-else class="space-y-2">
                  <button v-for="ej in item.ejemplares" :key="ej.id_ejemplar" @click="item.ejemplar = ej" :class="['w-full flex gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left',
                    item.ejemplar?.id_ejemplar === ej.id_ejemplar
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50']">
                    <img :src="ej.edicion?.imagenPortada || defaultBookImage" alt=""
                      class="w-10 h-14 object-cover rounded-lg border border-slate-100 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold text-slate-800 leading-tight">{{ ej.codigoEjemplar }}</p>
                      <p class="text-xs text-slate-500 mt-0.5">{{ ej.edicion?.editorial }} · {{ ej.edicion?.edicion }}
                      </p>
                      <p v-if="ej.ubicacionFisica" class="text-xs text-indigo-500 font-medium mt-0.5">📍 {{
                        ej.ubicacionFisica }}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1 flex-shrink-0">
                      <div class="w-2 h-2 rounded-full bg-emerald-500" />
                      <div v-if="item.ejemplar?.id_ejemplar === ej.id_ejemplar"
                        class="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                        <svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Botón siguiente -->
        <div class="flex gap-3">
          <button @click="step = 1"
            class="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Volver
          </button>
          <button @click="step = 3" :disabled="!loteCompleto"
            :class="['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              loteCompleto ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
            Continuar a confirmación
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>


      <!-- ═══ PASO 3: CONFIRMAR ═══ -->
      <div v-if="step === 3" class="">
        <!-- <div v-if="step === 3" class="max-w-2xl space-y-5"> -->

        <!-- Éxito -->
        <div v-if="confirmSuccess"
          class="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div class="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg class="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="text-lg font-bold text-slate-800">¡{{ prestamosParaTicket.length }} préstamo(s) registrado(s)!</p>
            <p class="text-sm text-slate-500 mt-1">{{ selectedUser?.persona.nombreCompleto }}</p>
          </div>
          <div class="flex gap-3 justify-center">
            <button @click="abrirTicket"
              class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition-all flex items-center gap-2">
              🖨️ Imprimir Ticket
            </button>
            <button @click="resetForm"
              class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all">
              Nuevo préstamo
            </button>
          </div>
        </div>

        <template v-else>
          <!-- Resumen del lote -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100">
              <p class="font-semibold text-slate-800">Resumen del préstamo</p>
            </div>
            <div class="p-5 space-y-3">
              <!-- Usuario -->
              <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div
                  class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {{ selectedUser?.persona.nombreCompleto.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-slate-800 capitalize">{{ selectedUser?.persona.nombreCompleto }}
                  </p>
                  <p class="text-xs text-slate-400">CI: {{ selectedUser?.persona.ci }}</p>
                </div>
                <span :class="['ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
                  tipoPrestamo === 'DOMICILIO' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700']">
                  {{ tipoPrestamo }}
                </span>
              </div>
              <!-- Libros -->
              <div v-for="(item, i) in lote" :key="item.id" class="border border-slate-100 rounded-xl p-3 space-y-3">
                <!-- 🔹 Fila superior: info -->
                <div class="flex items-center gap-3">
                  <span class="text-xs font-bold text-slate-400 w-5 text-center">
                    {{ i + 1 }}
                  </span>

                  <img :src="item.ejemplar.edicion?.imagenPortada || defaultBookImage"
                    class="w-10 h-14 object-cover rounded-lg border border-slate-100" />

                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-slate-800 truncate">
                      {{ item.libro?.titulo }}
                    </p>
                    <p class="text-xs text-slate-400">
                      Ej: {{ item.ejemplar?.codigoEjemplar }}
                    </p>
                  </div>
                </div>

                <!-- 🔹 Fila inferior: condición -->
                <div>
                  <p class="text-xs text-slate-500 font-medium mb-2">
                    Condición al entregar
                  </p>

                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button v-for="c in CONDICIONES" :key="c" @click="item.condicionEntrega = c" :class="[
                      'py-2 rounded-lg text-xs font-semibold border-2 transition',
                      item.condicionEntrega === c
                        ? condicionColors[c]
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    ]">
                      {{ c }}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Formulario -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">

            <!-- Condición de entrega -->
            <!-- <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Condición física al entregar <span
                  class="text-red-400">*</span></label>
              <div class="grid grid-cols-4 gap-2">
                <button v-for="c in CONDICIONES" :key="c" @click="condicionEntrega = c"
                  :class="['py-2.5 rounded-xl border-2 text-xs font-semibold transition-all',
                    condicionEntrega === c ? condicionColors[c] : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                  {{ c }}
                </button>
              </div>
            </div> -->

            <!-- Documento de garantía -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-2">Documento de garantía <span
                  class="text-red-400">*</span></label>
              <div class="grid grid-cols-3 gap-2">
                <button v-for="t in TIPOS_DOCUMENTO" :key="t" @click="tipoDocumento = t"
                  :class="['py-2 rounded-xl border-2 text-xs font-semibold transition-all',
                    tipoDocumento === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                  {{ t === 'CI' ? '🪪 Carnet de Identidad' : '🎓 Matrícula' }}
                </button>
              </div>
            </div>

            <!-- Fecha de devolución (solo DOMICILIO) -->
            <div v-if="tipoPrestamo === 'DOMICILIO'">
              <label class="block text-sm font-semibold text-slate-700 mb-1.5">
                Fecha de devolución estimada
                <span v-if="reglasActivas?.diasPrestamoMax" class="text-xs font-normal text-slate-400 ml-1">({{
                  reglasActivas.diasPrestamoMax }} días según config)</span>
              </label>
              <input v-model="fechaDevolucion" type="date" :min="hoy"
                class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
            </div>
            <!-- <div v-else
              class="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01" />
              </svg>
              Préstamo en sala — sin fecha límite de devolución
            </div> -->

            <!-- Observaciones -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1.5">Observaciones (opcional)</label>
              <textarea v-model="observaciones" rows="2" placeholder="Notas adicionales..."
                class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none" />
            </div>

            <!-- Error -->
            <div v-if="confirmError"
              class="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ confirmError }}
            </div>
          </div>

          <!-- Botones -->
          <div class="flex gap-3">
            <button @click="step = 2"
              class="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Volver
            </button>
            <button @click="confirmarPrestamo" :disabled="!canConfirm || confirmLoading" :class="['flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              canConfirm && !confirmLoading
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
              <svg v-if="confirmLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ confirmLoading ? 'Registrando...' : `Confirmar ${lote.length} préstamo(s)` }}
            </button>
          </div>
        </template>
      </div>

      <!-- ═══ TICKET MODAL (componente reutilizable) ═══ -->
      <TicketPrestamo v-model="showTicket" :prestamos="prestamosParaTicket" :usuario="usuarioParaTicket"
        :tipo="tipoPrestamo" :fecha-devolucion="fechaDevolucion" :biblioteca-nombre="auth.bibliotecaNombre[0]" />


    </div>
  </div>
</template>