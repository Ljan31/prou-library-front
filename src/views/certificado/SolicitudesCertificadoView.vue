<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import api from '@/services/axios'
import CertificadosModal from './CertificadosModal.vue'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'
import CertificadoPreview from './CertificadoPreview.vue'
import { normalizeRequisitos } from '@/services/razon-certificado.service'
const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin } = usePermissions()

// ─── Types ────────────────────────────────────────────────────────────────────
type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'

interface Solicitud {
  id: number
  nombres: string
  apellidos: string
  ci: string
  matricula?: string
  email?: string
  telefono?: string
  bibliotecaId: number
  bibliotecaNombre: string
  razonId: number
  razonNombre: string
  requisitos?: string
  descripcion?: string
  estado: EstadoSolicitud
  fechaSolicitud: string
  fechaRespuesta?: string | null
  observacionRespuesta?: string | null
  atendidoPorId?: number | null
  atendidoPorNombre?: string | null
  usuarioId?: number | null   // si tiene usuario del sistema asociado
}

interface EstadoSancion {
  tieneSuspensionVigente: boolean
  tieneDeudaPendiente: boolean
  totalSancionesActivas: number
  fechaFinSuspensionMasProxima: string | null
}

// Verificación por CI en panel de solicitudes
interface EstadoSancionCI {
  usuarioId: number | null
  tieneSuspensionVigente: boolean
  tieneDeudaPendiente: boolean
  totalSancionesActivas: number
  montoTotalDeuda: number
  fechaFinProxima: string | null
}

interface EstadoPrestamosCI {
  usuarioId: number
  tienePrestamosPendientes: boolean
  prestamosActivos: number
  prestamosVencidos: number
  prestamosRenovados: number
}

interface Certificado {
  id_certificado: number
  fechaEmision: string
  fechaVencimiento: string
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  urlDescarga: string
  bibliotecaNombre?: string
  usuario?: { nombreCompleto?: string; ci?: string | number; id_usuario?: number }
  bibliotecario?: { nombreCompleto?: string }
}

interface UsuarioBusqueda {
  id_usuario: number
  username: string
  persona: { nombreCompleto: string; ci: number | string; matricula?: string | null }
}

interface Biblioteca {
  id_biblioteca: number
  nombre: string
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  if (isAdmin.value) fetchBibliotecas()
  cargarSolicitudes()
})

// ─── Tabs principales ─────────────────────────────────────────────────────────
type MainTab = 'solicitudes' | 'generar'
const mainTab = ref<MainTab>('solicitudes')

// ─── Bibliotecas (admin) ──────────────────────────────────────────────────────
const bibliotecas = ref<Biblioteca[]>([])
const selectedBibliotecaId = ref<number | null>(null)

async function fetchBibliotecas() {
  try {
    const { data } = await api.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch { bibliotecas.value = [] }
}

const bibliotecarioId = computed(() => auth.user?.biblioteca?.[0]?.id_biblioteca ?? null)
const targetBibliotecaId = computed(() =>
  isAdmin.value ? selectedBibliotecaId.value : bibliotecarioId.value
)

// ─────────────────────────────────────────────────────────────────────────────
// ══ SECCIÓN A: SOLICITUDES ══
// ─────────────────────────────────────────────────────────────────────────────

type EstadoFiltro = '' | 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
const filtroEstado = ref<EstadoFiltro>('')
const busqueda = ref('')
const solicitudes = ref<Solicitud[]>([])
const cargando = ref(false)
const errorCarga = ref<string | null>(null)
let busquedaDebounce: ReturnType<typeof setTimeout>

watch(busqueda, () => {
  clearTimeout(busquedaDebounce)
  busquedaDebounce = setTimeout(cargarSolicitudes, 350)
})
watch([filtroEstado, targetBibliotecaId], cargarSolicitudes)

async function cargarSolicitudes() {
  const bibId = targetBibliotecaId.value
  if (!bibId) return
  cargando.value = true
  errorCarga.value = null
  try {
    const params: Record<string, unknown> = {}
    if (filtroEstado.value) params.estado = filtroEstado.value
    const { data } = await api.get(`/solicitudes-certificado/biblioteca/${bibId}`, { params })
    solicitudes.value = data.data ?? data ?? []
  } catch (e: unknown) {
    errorCarga.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'No se pudieron cargar las solicitudes'
    solicitudes.value = []
  } finally {
    cargando.value = false
  }
}

// Filtro local por búsqueda
const solicitudesFiltradas = computed(() => {
  if (!busqueda.value.trim()) return solicitudes.value
  const q = busqueda.value.toLowerCase()
  return solicitudes.value.filter(s =>
    `${s.nombres} ${s.apellidos}`.toLowerCase().includes(q) ||
    s.ci.includes(q) ||
    (s.matricula ?? '').toLowerCase().includes(q) ||
    s.razonNombre.toLowerCase().includes(q)
  )
})

// Stats de solicitudes
const statsSOlicitudes = computed(() => ({
  total:     solicitudes.value.length,
  pendientes: solicitudes.value.filter(s => s.estado === 'PENDIENTE').length,
  aprobadas:  solicitudes.value.filter(s => s.estado === 'APROBADA').length,
  rechazadas: solicitudes.value.filter(s => s.estado === 'RECHAZADA').length,
}))

// ─── Panel de detalle de solicitud ───────────────────────────────────────────
const solicitudSeleccionada = ref<Solicitud | null>(null)
const cargandoDetalle = ref(false)

// Estado de sanciones y préstamos del solicitante (verificado por CI)
const verificandoSolicitante = ref(false)
const sancionSolicitante = ref<EstadoSancionCI | null>(null)
const prestamosSolicitante = ref<EstadoPrestamosCI | null>(null)

async function verDetalle(s: Solicitud) {
  // Si cambia de solicitud, limpiar estado previo
  if (solicitudSeleccionada.value?.id !== s.id) {
    sancionSolicitante.value = null
    prestamosSolicitante.value = null
  }
  solicitudSeleccionada.value = s
  cargandoDetalle.value = true
  console.log(solicitudSeleccionada.value)
  // Cargar detalle completo + verificar estado por CI en paralelo (solo PENDIENTE)
  const tasks: Promise<void>[] = [
    api.get(`/solicitudes-certificado/${s.id}`)
      .then(({ data }) => { 
        // solicitudSeleccionada.value = data.data ?? data 
        const solicitud = data.data ?? data
        solicitudSeleccionada.value = {
          ...solicitud,
          requisitos: normalizeRequisitos(solicitud.requisitos)
        }
      })
      .catch(() => { /* usar datos del listado */ }),
  ]

  if (s.estado === 'PENDIENTE' && s.ci) {
    verificandoSolicitante.value = true
    tasks.push(
      Promise.all([
        api.get(`/sanciones/usuario/ci/${s.ci}/estado`),
        api.get(`/prestamos/estado-usuario/${targetBibliotecaId.value}/${s.ci}`),
      ]).then(([sancionRes, prestamosRes]) => {
        sancionSolicitante.value = sancionRes.data.data ?? sancionRes.data
        prestamosSolicitante.value = prestamosRes.data.data ?? prestamosRes.data
      }).catch(() => {
        sancionSolicitante.value = null
        prestamosSolicitante.value = null
      }).finally(() => {
        verificandoSolicitante.value = false
      })
    )
  }

  await Promise.all(tasks)
  cargandoDetalle.value = false
}

function cerrarDetalle() {
  solicitudSeleccionada.value = null
  motivoRechazo.value = ''
  showRechazoForm.value = false
  sancionSolicitante.value = null
  prestamosSolicitante.value = null
}

// Computed: ¿tiene problemas el solicitante?
const solicitanteTieneSuspension = computed(() => sancionSolicitante.value?.tieneSuspensionVigente ?? false)
const solicitanteTieneDeuda = computed(() => sancionSolicitante.value?.tieneDeudaPendiente ?? false)
const solicitanteTienePrestamos = computed(() => prestamosSolicitante.value?.tienePrestamosPendientes ?? false)
const solicitanteTieneProblemas = computed(() =>
  solicitanteTieneSuspension.value || solicitanteTienePrestamos.value
)

// ─── Aprobar solicitud ────────────────────────────────────────────────────────
const aprobando = ref(false)
const observacionAprobacion = ref('')

async function aprobarSolicitud(id: number) {
  aprobando.value = true
  try {
    const params: Record<string, string> = {}
    if (observacionAprobacion.value.trim()) params.observacion = observacionAprobacion.value.trim()
    await api.patch(`/solicitudes-certificado/${id}/aprobar`, null, { params })
    ui.toast.success('Solicitud aprobada', 'La solicitud fue aprobada. Ahora puedes generar el certificado.')
    await cargarSolicitudes()
    // Refrescar detalle
    if (solicitudSeleccionada.value?.id === id) {
      await verDetalle({ ...solicitudSeleccionada.value })
    }
    observacionAprobacion.value = ''
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'No se pudo aprobar la solicitud'
    ui.toast.error('Error', msg)
  } finally {
    aprobando.value = false
  }
}

// ─── Rechazar solicitud ───────────────────────────────────────────────────────
const rechazando = ref(false)
const motivoRechazo = ref('')
const showRechazoForm = ref(false)

async function rechazarSolicitud(id: number) {
  if (!motivoRechazo.value.trim()) {
    ui.toast.error('Motivo requerido', 'Debes ingresar el motivo del rechazo')
    return
  }
  rechazando.value = true
  try {
    await api.patch(`/solicitudes-certificado/${id}/rechazar`, null, {
      params: { observacion: motivoRechazo.value.trim() }
    })
    ui.toast.success('Solicitud rechazada', 'La solicitud fue rechazada.')
    await cargarSolicitudes()
    if (solicitudSeleccionada.value?.id === id) {
      await verDetalle({ ...solicitudSeleccionada.value })
    }
    motivoRechazo.value = ''
    showRechazoForm.value = false
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'No se pudo rechazar la solicitud'
    ui.toast.error('Error', msg)
  } finally {
    rechazando.value = false
  }
}

const diasValidezSolicitud = ref(30)
const generandoDesdeSolicitud = ref(false)
const certGeneradoDesdeSolicitud = ref<Certificado | null>(null)

async function generarDesdeSolicitud() {
  if (!solicitudSeleccionada.value) return

  generandoDesdeSolicitud.value = true

  try {
    const payload: any = {
      usuarioId: solicitudSeleccionada.value.usuarioId || null,
      bibliotecaId: targetBibliotecaId.value,
      diasValidez: diasValidezSolicitud.value,
      // Datos adicionales por si no tiene cuenta
      nombres: solicitudSeleccionada.value.nombres,
      apellidos: solicitudSeleccionada.value.apellidos,
      ci: solicitudSeleccionada.value.ci,
      solicitudId: solicitudSeleccionada.value.id
    }

    const { data } = await api.post('/certificados', payload)

    if (data.success) {
      certGeneradoDesdeSolicitud.value = data.data
      ui.toast.success('¡Certificado generado!', 'El certificado se generó correctamente.')

      // Recargar detalle
      await verDetalle(solicitudSeleccionada.value)
    } else {
      ui.toast.error('Error', data.message || 'No se pudo generar el certificado')
    }
  } catch (e: any) {
    const msg = e.response?.data?.message ?? 'Error al generar certificado'
    ui.toast.error('Error', msg)
  } finally {
    generandoDesdeSolicitud.value = false
  }
}


// Certificados existentes del solicitante
const certificadosExistentes = ref<Certificado[]>([])
const cargandoCertificadosExistentes = ref(false)

async function cargarCertificadosExistentes() {
  if (!solicitudSeleccionada.value?.ci || !targetBibliotecaId.value) return
  
  cargandoCertificadosExistentes.value = true
  try {
    const { data } = await api.get('/certificados/usuarioCi', {
      params: {
        ci: solicitudSeleccionada.value.ci,
        bibliotecaId: targetBibliotecaId.value
      }
    })
    certificadosExistentes.value = data.data ?? []
  } catch (e) {
    certificadosExistentes.value = []
  } finally {
    cargandoCertificadosExistentes.value = false
  }
}

// Llamar cuando se abre el detalle de una solicitud aprobada
watch(() => solicitudSeleccionada.value?.estado, (estado) => {
  if (estado === 'APROBADA' && solicitudSeleccionada.value?.ci) {
    cargarCertificadosExistentes()
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// ══ SECCIÓN B: GENERAR DIRECTAMENTE ══
// ─────────────────────────────────────────────────────────────────────────────

// Búsqueda de usuario
const userQuery = ref('')
const userResults = ref<UsuarioBusqueda[]>([])
const userLoading = ref(false)
const userDropdownOpen = ref(false)
const selectedUser = ref<UsuarioBusqueda | null>(null)
let userDebounce: ReturnType<typeof setTimeout>

watch(userQuery, (val) => {
  clearTimeout(userDebounce)
  if (!val || val.length < 2) { userResults.value = []; userDropdownOpen.value = false; return }
  userDebounce = setTimeout(() => searchUsers(val), 300)
})

async function searchUsers(q: string) {
  userLoading.value = true
  try {
    const { data } = await api.get('/users/search', { params: { q } })
    userResults.value = data?.data ?? []
    userDropdownOpen.value = true
  } catch { userResults.value = [] }
  finally { userLoading.value = false }
}

function selectUser(u: UsuarioBusqueda) {
  selectedUser.value = u
  userQuery.value = u.persona.nombreCompleto
  userDropdownOpen.value = false
  verificarEstudiante(u.id_usuario)
}

function resetUser() {
  selectedUser.value = null
  userQuery.value = ''
  userResults.value = []
  estadoSancionUsuario.value = null
  certificadosUsuario.value = []
  certGenerado.value = null
  certError.value = null
  showCertsModal.value = false
}

// Verificación automática del estudiante seleccionado
const verificandoEstudiante = ref(false)
const estadoSancionUsuario = ref<EstadoSancion | null>(null)
const certificadosUsuario = ref<Certificado[]>([])

async function verificarEstudiante(userId: number) {
  verificandoEstudiante.value = true
  estadoSancionUsuario.value = null
  certificadosUsuario.value = []
  try {
    const [sancionRes, certRes] = await Promise.all([
      api.get(`/sanciones/usuario/${userId}/estado`),
      api.get(`/certificados/usuario/${userId}`, {
        params: targetBibliotecaId.value ? { bibliotecaId: targetBibliotecaId.value } : {}
      }),
    ])
    estadoSancionUsuario.value = sancionRes.data.data ?? sancionRes.data
    certificadosUsuario.value = certRes.data.data ?? []
  } catch {
    ui.toast.error('Error', 'No se pudo verificar el estado del estudiante')
  } finally {
    verificandoEstudiante.value = false
  }
}

const estudianteTieneSuspension = computed(() => estadoSancionUsuario.value?.tieneSuspensionVigente ?? false)
const estudianteTieneDeuda = computed(() => estadoSancionUsuario.value?.tieneDeudaPendiente ?? false)
const estudianteTieneVigente = computed(() => certificadosUsuario.value.some(c => c.estadoCertificado === 'VIGENTE'))

const puedeGenerar = computed(() =>
  !!selectedUser.value &&
  !!targetBibliotecaId.value &&
  !verificandoEstudiante.value &&
  !estudianteTieneSuspension.value &&
  !estudianteTieneVigente.value
)

// Generación
const diasValidez = ref(2)
const generandoCert = ref(false)
const certError = ref<string | null>(null)
const certGenerado = ref<Certificado | null>(null)

async function generarCertificado() {
  if (!puedeGenerar.value) return
  generandoCert.value = true
  certError.value = null
  certGenerado.value = null
  try {
    const { data } = await api.post('/certificados', {
      usuarioId: selectedUser.value!.id_usuario,
      bibliotecaId: targetBibliotecaId.value,
      diasValidez: diasValidez.value,
    })
    if (data.success) {
      certGenerado.value = data.data
      ui.toast.success('Certificado generado', 'El certificado fue emitido correctamente')
      await verificarEstudiante(selectedUser.value!.id_usuario)
    } else {
      certError.value = data.message ?? 'No se pudo generar el certificado'
      ui.toast.error('Error', certError.value!)
    }
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'Error al generar certificado'
    certError.value = msg
    ui.toast.error('Error', msg)
  } finally {
    generandoCert.value = false
  }
}

function abrirImprimirDesdeSolicitud() {
  if (certGeneradoDesdeSolicitud.value) {
    abrirImprimir(certGeneradoDesdeSolicitud.value)
  }
}

function nuevaGeneracion() {
  certGeneradoDesdeSolicitud.value = null
  diasValidezSolicitud.value = 2
}

// Anular certificado
const anulandoId = ref<number | null>(null)
const showCertsModal = ref(false)

async function anularCertificado(id: number) {
  anulandoId.value = id
  try {
    await api.patch(`/certificados/${id}/anular`)
    ui.toast.success('Anulado', 'El certificado fue anulado')
    if (selectedUser.value) verificarEstudiante(selectedUser.value.id_usuario)
  } catch {
    ui.toast.error('Error', 'No se pudo anular el certificado')
  } finally {
    anulandoId.value = null
  }
}

// PDF Viewer + Print
const pdfViewerShow = ref(false)
const pdfViewerCertId = ref<number | null>(null)
const showPrintPreview = ref(false)
const printCert = ref<Certificado | null>(null)

function abrirVisor(id: number) { pdfViewerCertId.value = id; pdfViewerShow.value = true }
function abrirImprimir(cert: Certificado) { printCert.value = cert; showPrintPreview.value = true }

const qrUrl = computed(() => {
  if (!certGenerado.value?.codigo_verificacion) return ''
  const url = `${window.location.origin}/certificados?tab=validar&codigo=${certGenerado.value.codigo_verificacion}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&ecc=M&margin=2`
})

function highlight(text: string, query: string): string {
  if (!query) return text
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, '<mark class="bg-indigo-100 text-indigo-700 rounded-sm px-0.5">$1</mark>')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateTime(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function estadoCertClasses(estado: string) {
  return ({ VIGENTE: 'bg-emerald-100 text-emerald-700', VENCIDO: 'bg-amber-100 text-amber-700', ANULADO: 'bg-red-100 text-red-700' })[estado] ?? 'bg-slate-100 text-slate-600'
}

const ESTADO_SOL_CONFIG: Record<EstadoSolicitud, { label: string; badge: string; dot: string }> = {
  PENDIENTE: { label: 'Pendiente',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  APROBADA:  { label: 'Aprobada',   badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  RECHAZADA: { label: 'Rechazada',  badge: 'bg-red-100 text-red-700',        dot: 'bg-red-500' },
}
</script>

<template>
  <div class="space-y-5">

    <!-- Subcomponentes globales -->
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false"/>
    <CertificadoPreview
      v-if="showPrintPreview && printCert"
      :certificado="printCert"
      :nombre-usuario="printCert.usuario?.nombreCompleto ?? selectedUser?.persona.nombreCompleto ?? ''"
      :ci-usuario="String(printCert.usuario?.ci ?? selectedUser?.persona.ci ?? '')"
      @close="showPrintPreview = false"
    />
    <CertificadosModal
      :show="showCertsModal"
      :certificados="certificadosUsuario"
      :titulo="`Certificados de ${selectedUser?.persona.nombreCompleto ?? 'este usuario'}`"
      :can-anular="true"
      :anulando-id="anulandoId"
      @close="showCertsModal = false"
      @anular="anularCertificado"
      @ver-pdf="abrirVisor"
      @imprimir="abrirImprimir"
    />

    <!-- ── Selector biblioteca (solo admin) ── -->
    <div v-if="isAdmin" class="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0">Admin</span>
      <select v-model="selectedBibliotecaId"
        class="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
        <option :value="null">Seleccionar biblioteca...</option>
        <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">{{ b.nombre }}</option>
      </select>
    </div>

    <!-- ═══════════════════ A: SOLICITUDES ═══════════════════ -->
    <div v-if="mainTab === 'solicitudes'" class="space-y-4">

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-xs text-slate-400 mb-1">Total</p>
          <p class="text-2xl font-bold text-slate-800">{{ statsSOlicitudes.total }}</p>
        </div>
        <div class="bg-white rounded-xl border border-amber-200 p-4">
          <p class="text-xs text-slate-400 mb-1">Pendientes</p>
          <p class="text-2xl font-bold text-amber-600">{{ statsSOlicitudes.pendientes }}</p>
        </div>
        <div class="bg-white rounded-xl border border-emerald-200 p-4">
          <p class="text-xs text-slate-400 mb-1">Aprobadas</p>
          <p class="text-2xl font-bold text-emerald-600">{{ statsSOlicitudes.aprobadas }}</p>
        </div>
        <div class="bg-white rounded-xl border border-red-200 p-4">
          <p class="text-xs text-slate-400 mb-1">Rechazadas</p>
          <p class="text-2xl font-bold text-red-500">{{ statsSOlicitudes.rechazadas }}</p>
        </div>
      </div>

      <!-- Filtros + búsqueda -->
      <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <!-- Búsqueda -->
        <div class="relative flex-1 min-w-48">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input v-model="busqueda" type="text" placeholder="Buscar por nombre, CI o razón..."
            class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"/>
        </div>
        <!-- Filtros de estado -->
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="f in [
              { v: '',           l: 'Todos',     dot: 'bg-slate-400' },
              { v: 'PENDIENTE',  l: 'Pendientes', dot: 'bg-amber-500' },
              { v: 'APROBADA',   l: 'Aprobadas',  dot: 'bg-emerald-500' },
              { v: 'RECHAZADA',  l: 'Rechazadas', dot: 'bg-red-500' },
            ]"
            :key="f.v"
            @click="filtroEstado = f.v as EstadoFiltro"
            :class="['h-9 px-3 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5',
              filtroEstado === f.v
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600']"
          >
            <span v-if="f.v" :class="['w-1.5 h-1.5 rounded-full', f.dot]"/>
            {{ f.l }}
          </button>
        </div>
        <!-- Refresh -->
        <button @click="cargarSolicitudes"
          class="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all flex-shrink-0"
          title="Actualizar">
          <svg class="w-4 h-4" :class="{ 'animate-spin': cargando }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      <!-- Contenido: lista + panel de detalle -->
      <div class="flex gap-4" :class="solicitudSeleccionada ? 'items-start' : ''">

        <!-- Lista de solicitudes -->
        <div :class="['bg-white rounded-xl border border-slate-200 overflow-hidden transition-all', solicitudSeleccionada ? 'w-2/5 flex-shrink-0' : 'flex-1']">

          <!-- Loading -->
          <div v-if="cargando" class="p-4 space-y-3">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-slate-100 animate-pulse flex-shrink-0"/>
              <div class="flex-1 space-y-1.5">
                <div class="h-3 bg-slate-100 rounded animate-pulse w-2/5"/>
                <div class="h-2.5 bg-slate-100 rounded animate-pulse w-1/3"/>
              </div>
              <div class="h-6 w-20 bg-slate-100 rounded-full animate-pulse"/>
            </div>
          </div>

          <!-- Error -->
          <div v-else-if="errorCarga" class="flex flex-col items-center justify-center py-14 gap-3">
            <svg class="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p class="text-sm text-slate-500">{{ errorCarga }}</p>
            <button @click="cargarSolicitudes" class="text-sm text-indigo-600 hover:underline font-medium">Reintentar</button>
          </div>

          <!-- Vacío -->
          <div v-else-if="!solicitudesFiltradas.length" class="flex flex-col items-center justify-center py-14 gap-3">
            <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p class="text-sm font-medium text-slate-500">No hay solicitudes</p>
            <p class="text-xs text-slate-400">con el filtro actual</p>
          </div>

          <!-- Filas -->
          <div v-else class="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
            <button
              v-for="s in solicitudesFiltradas"
              :key="s.id"
              @click="verDetalle(s)"
              :class="[
                'w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left',
                solicitudSeleccionada?.id === s.id ? 'bg-indigo-50/60' : ''
              ]"
            >
              <!-- Avatar inicial -->
              <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                {{ s.nombres.charAt(0).toUpperCase() }}
              </div>
              <!-- Info -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-slate-800 truncate capitalize">
                  {{ s.nombres }} {{ s.apellidos }}
                </p>
                <p class="text-xs text-slate-400 truncate">
                  CI: {{ s.ci }}
                  <span v-if="!solicitudSeleccionada"> · {{ s.razonNombre }}</span>
                </p>
                <p class="text-[10px] text-slate-400">{{ formatDateTime(s.fechaSolicitud) }}</p>
              </div>
              <!-- Badge estado -->
              <div class="flex-shrink-0">
                <span :class="['text-xs font-bold px-2.5 py-1 rounded-full', ESTADO_SOL_CONFIG[s.estado].badge]">
                  {{ ESTADO_SOL_CONFIG[s.estado].label }}
                </span>
              </div>
            </button>
          </div>

          <!-- Contador -->
          <div v-if="solicitudesFiltradas.length" class="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
            <p class="text-xs text-slate-400">{{ solicitudesFiltradas.length }} solicitud(es)</p>
          </div>
        </div>

        <!-- Panel de detalle -->
        <Transition name="slide-right">
          <div v-if="solicitudSeleccionada"
            class="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0">

            <!-- Header del detalle -->
            <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0">
                {{ solicitudSeleccionada.nombres.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-slate-900 text-sm capitalize truncate">
                  {{ solicitudSeleccionada.nombres }} {{ solicitudSeleccionada.apellidos }}
                </h3>
                <span :class="['text-xs font-bold px-2 py-0.5 rounded-full', ESTADO_SOL_CONFIG[solicitudSeleccionada.estado].badge]">
                  {{ ESTADO_SOL_CONFIG[solicitudSeleccionada.estado].label }}
                </span>
              </div>
              <button @click="cerrarDetalle" class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Loading detalle -->
            <div v-if="cargandoDetalle" class="p-5 space-y-3">
              <div v-for="i in 4" :key="i" class="h-10 bg-slate-100 rounded-xl animate-pulse"/>
            </div>

            <!-- Contenido del detalle -->
            <div v-else class="p-5 space-y-5 overflow-y-auto max-h-[460px]">

              <!-- Datos del solicitante -->
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Datos del solicitante</p>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div class="bg-slate-50 rounded-xl p-3">
                    <p class="text-xs text-slate-400 mb-0.5">CI</p>
                    <p class="font-semibold text-slate-800">{{ solicitudSeleccionada.ci }}</p>
                  </div>
                  <div v-if="solicitudSeleccionada.matricula" class="bg-slate-50 rounded-xl p-3">
                    <p class="text-xs text-slate-400 mb-0.5">Matrícula</p>
                    <p class="font-semibold text-slate-800">{{ solicitudSeleccionada.matricula }}</p>
                  </div>
                  <div v-if="solicitudSeleccionada.email" class="col-span-2 bg-slate-50 rounded-xl p-3">
                    <p class="text-xs text-slate-400 mb-0.5">Correo</p>
                    <p class="font-medium text-slate-700">{{ solicitudSeleccionada.email }}</p>
                  </div>
                  <div v-if="solicitudSeleccionada.telefono" class="bg-slate-50 rounded-xl p-3">
                    <p class="text-xs text-slate-400 mb-0.5">Teléfono</p>
                    <p class="font-medium text-slate-700">{{ solicitudSeleccionada.telefono }}</p>
                  </div>
                  <div v-if="solicitudSeleccionada.usuarioId" class="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                    <p class="text-xs text-indigo-400 mb-0.5">Usuario del sistema</p>
                    <p class="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                      </svg>
                      Cuenta registrada
                    </p>
                  </div>
                </div>
              </div>

              <!-- Tipo de certificado -->
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tipo de certificado</p>
                <div class="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                  <p class="font-semibold text-indigo-800 text-sm">{{ solicitudSeleccionada.razonNombre }}</p>
                  <p v-if="solicitudSeleccionada.requisitos" class="text-xs text-indigo-600">
                    <strong>Requisitos:</strong>
                    {{ normalizeRequisitos(solicitudSeleccionada.requisitos).join(', ') }}
                  </p>
                  <p class="text-xs text-slate-500">
                    Biblioteca: <strong>{{ solicitudSeleccionada.bibliotecaNombre }}</strong>
                  </p>
                </div>
              </div>

              <!-- Observaciones / descripción -->
              <div v-if="solicitudSeleccionada.descripcion">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Observaciones del solicitante</p>
                <div class="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p class="text-sm text-slate-700">{{ solicitudSeleccionada.descripcion }}</p>
                </div>
              </div>

              <!-- Historial / fechas -->
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Historial</p>
                <div class="space-y-2 text-xs">
                  <div class="flex items-center gap-2.5">
                    <div class="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0"/>
                    <span class="text-slate-500">Solicitado el</span>
                    <span class="font-medium text-slate-700">{{ formatDateTime(solicitudSeleccionada.fechaSolicitud) }}</span>
                  </div>
                  <div v-if="solicitudSeleccionada.fechaRespuesta" class="flex items-center gap-2.5">
                    <div :class="['w-2 h-2 rounded-full flex-shrink-0', solicitudSeleccionada.estado === 'APROBADA' ? 'bg-emerald-500' : 'bg-red-500']"/>
                    <span class="text-slate-500">{{ solicitudSeleccionada.estado === 'APROBADA' ? 'Aprobado' : 'Rechazado' }} el</span>
                    <span class="font-medium text-slate-700">{{ formatDateTime(solicitudSeleccionada.fechaRespuesta) }}</span>
                  </div>
                  <div v-if="solicitudSeleccionada.atendidoPorNombre" class="flex items-center gap-2.5">
                    <div class="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"/>
                    <span class="text-slate-500">Atendido por</span>
                    <span class="font-medium text-slate-700">{{ solicitudSeleccionada.atendidoPorNombre }}</span>
                  </div>
                  <div v-if="solicitudSeleccionada.observacionRespuesta" class="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <p class="text-slate-500 mb-0.5">Observación:</p>
                    <p class="font-medium text-slate-700">{{ solicitudSeleccionada.observacionRespuesta }}</p>
                  </div>
                </div>
              </div>

              <!-- ── VERIFICACIÓN DE ESTADO DEL SOLICITANTE ── -->
              <div v-if="solicitudSeleccionada.estado === 'PENDIENTE'" class="space-y-3 pt-2 border-t border-slate-100">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  Verificación del solicitante
                  <span v-if="verificandoSolicitante" class="flex items-center gap-1 text-indigo-500 font-normal normal-case tracking-normal">
                    <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    verificando...
                  </span>
                </p>

                <!-- Verificando -->
                <div v-if="verificandoSolicitante" class="space-y-2">
                  <div class="h-10 bg-slate-100 rounded-xl animate-pulse"/>
                  <div class="h-10 bg-slate-100 rounded-xl animate-pulse"/>
                </div>

                <template v-else-if="sancionSolicitante !== null || prestamosSolicitante !== null">

                  <!-- SUSPENSIÓN ACTIVA -->
                  <div v-if="solicitanteTieneSuspension"
                    class="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div class="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <p class="text-xs font-bold text-red-800">Suspensión activa</p>
                      <p class="text-xs text-red-600 mt-0.5">
                        Tiene suspensión vigente
                        <span v-if="sancionSolicitante?.fechaFinProxima">
                          hasta el <strong>{{ formatDate(sancionSolicitante.fechaFinProxima) }}</strong>
                        </span>.
                        <span v-if="sancionSolicitante?.totalSancionesActivas"> ({{ sancionSolicitante.totalSancionesActivas }} sanción/es activa/s)</span>
                      </p>
                    </div>
                  </div>

                  <!-- DEUDA PENDIENTE -->
                  <div v-if="solicitanteTieneDeuda"
                    class="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div class="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <p class="text-xs font-bold text-amber-800">Deuda pendiente</p>
                      <p class="text-xs text-amber-600 mt-0.5">
                        Tiene deuda pendiente
                        <span v-if="sancionSolicitante?.montoTotalDeuda">
                          por <strong>Bs. {{ sancionSolicitante.montoTotalDeuda.toFixed(2) }}</strong>
                        </span>.
                      </p>
                    </div>
                  </div>

                  <!-- PRÉSTAMOS PENDIENTES -->
                  <div v-if="solicitanteTienePrestamos"
                    class="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <div class="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <p class="text-xs font-bold text-red-800">Préstamos pendientes</p>
                      <div class="flex flex-wrap gap-2 mt-1">
                        <span v-if="prestamosSolicitante?.prestamosActivos"
                          class="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold">
                          {{ prestamosSolicitante.prestamosActivos }} activo(s)
                        </span>
                        <span v-if="prestamosSolicitante?.prestamosVencidos"
                          class="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                          {{ prestamosSolicitante.prestamosVencidos }} vencido(s)
                        </span>
                        <span v-if="prestamosSolicitante?.prestamosRenovados"
                          class="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                          {{ prestamosSolicitante.prestamosRenovados }} renovado(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- TODO OK -->
                  <div v-if="!solicitanteTieneSuspension && !solicitanteTieneDeuda && !solicitanteTienePrestamos"
                    class="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                    <p class="text-xs text-emerald-700">Sin suspensiones, deudas ni préstamos pendientes. Puede aprobar el certificado.</p>
                  </div>

                  <!-- Recomendación de rechazo si tiene problemas -->
                  <div v-if="solicitanteTieneProblemas"
                    class="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-[10px] text-slate-500 leading-relaxed">
                      Se recomienda <strong>rechazar</strong> esta solicitud mientras el estudiante tenga
                      <span v-if="solicitanteTieneSuspension">suspensión activa</span><span v-if="solicitanteTieneSuspension && solicitanteTienePrestamos">, </span><span v-if="solicitanteTienePrestamos">préstamos sin devolver</span>.
                      Puedes indicar el motivo en el campo de rechazo.
                    </p>
                  </div>

                </template>
              </div>

              <!-- ── ACCIONES ── -->
              <div v-if="solicitudSeleccionada.estado === 'PENDIENTE'" class="space-y-3 pt-2 border-t border-slate-100">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones</p>

                <!-- Observación de aprobación (opcional) -->
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Observación (opcional)</label>
                  <input
                    v-model="observacionAprobacion"
                    type="text"
                    placeholder="Ej. Todo correcto, documentos verificados"
                    class="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                  />
                </div>

                <!-- Botón Aprobar — deshabilitado si tiene suspensión o préstamos pendientes -->
                 <div v-if="!isAdmin">

                   <button
                     @click="aprobarSolicitud(solicitudSeleccionada.id)"
                     :disabled="aprobando || isAdmin || (solicitanteTieneSuspension || solicitanteTienePrestamos)"
                     :title="
                     isAdmin ? 'Los administradores no pueden aprobar solicitudes': solicitanteTieneSuspension ? 'No se puede aprobar: tiene suspensión activa'
                       : solicitanteTienePrestamos ? 'No se puede aprobar: tiene préstamos sin devolver'
                       : 'Aprobar solicitud'"
                     :class="['w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all',
                       aprobando || isAdmin || solicitanteTieneSuspension || solicitanteTienePrestamos
                         ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                         : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200']"
                   >
                     <svg v-if="aprobando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                       <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                       <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                     </svg>
                     <svg v-else-if="solicitanteTieneSuspension || solicitanteTienePrestamos" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                         d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                     </svg>
                     <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                     </svg>
                     {{ aprobando ? 'Aprobando...'
                     : isAdmin ? 'Solo bibliotecarios pueden aprobar'
                       : solicitanteTieneSuspension ? 'No disponible (suspensión activa)'
                       : solicitanteTienePrestamos ? 'No disponible (préstamos pendientes)'
                       : 'Aprobar solicitud' }}
                   </button>
   
                   <!-- Rechazar: toggle form -->
                   <div v-if="!showRechazoForm">
                     <button
                       @click="() => {
                         showRechazoForm = true
                         // Pre-llenar motivo si tiene problemas
                         if (solicitanteTieneSuspension && solicitanteTienePrestamos)
                           motivoRechazo = 'Cuenta con suspensión activa y préstamos sin devolver.'
                         else if (solicitanteTieneSuspension)
                           motivoRechazo = 'Cuenta con suspensión activa' + (sancionSolicitante?.fechaFinProxima ? ` hasta el ${formatDate(sancionSolicitante.fechaFinProxima)}.` : '.')
                         else if (solicitanteTienePrestamos)
                           motivoRechazo = `Tiene ${(prestamosSolicitante?.prestamosActivos ?? 0) + (prestamosSolicitante?.prestamosVencidos ?? 0)} préstamo(s) pendiente(s) sin devolver.`
                       }"
                       class="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-all"
                     >
                       <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                       </svg>
                       Rechazar solicitud
                     </button>
                   </div>
   
                   <!-- Form de rechazo -->
                   <div v-else class="space-y-2">
                     <label class="block text-xs font-medium text-red-600 mb-1">Motivo del rechazo <span class="text-red-400">*</span></label>
                     <textarea
                       v-model="motivoRechazo"
                       rows="2"
                       placeholder="Ej. Tiene préstamos activos sin devolver, suspensión vigente..."
                       class="w-full px-3 py-2 text-xs border border-red-200 bg-red-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 transition-all resize-none placeholder:text-red-300"
                     />
                     <div class="flex gap-2">
                       <button
                         @click="rechazarSolicitud(solicitudSeleccionada.id)"
                         :disabled="rechazando || !motivoRechazo.trim()"
                         class="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-all"
                       >
                         <svg v-if="rechazando" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                           <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                           <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                         </svg>
                         {{ rechazando ? 'Rechazando...' : 'Confirmar rechazo' }}
                       </button>
                       <button @click="showRechazoForm = false; motivoRechazo = ''"
                         class="px-3 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium rounded-lg transition-all">
                         Cancelar
                       </button>
                     </div>
                   </div>
                 </div>
              </div>

              <!-- Si está APROBADA: mostrar botón para generar el certificado (si tiene usuarioId) -->
              <!-- Si está APROBADA: Generar certificado directamente -->
              <div v-if="solicitudSeleccionada.estado === 'APROBADA'" class="pt-2 border-t border-slate-100 space-y-5">

                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Generar certificado</p>

                <!-- Estado actual -->
                <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div class="flex items-start gap-3">
                    <svg class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                    </svg>
                    <div>
                      <p class="text-sm font-medium text-emerald-800">Solicitud aprobada</p>
                      <p class="text-xs text-emerald-600 mt-1">
                        {{ solicitudSeleccionada.usuarioId ? 'Estudiante con cuenta registrada.' : 'Generación sin cuenta asociada.' }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Certificados ya existentes -->
                <div v-if="certificadosExistentes.length > 0" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p class="text-xs font-bold text-amber-700 mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                    YA EXISTEN CERTIFICADOS PARA ESTE ESTUDIANTE
                  </p>
                  
                  <div class="space-y-3">
                    <div v-for="cert in certificadosExistentes" :key="cert.id_certificado" 
                      class="flex items-center justify-between bg-white rounded-lg border border-amber-100 p-3 text-sm">
                      <div>
                        <p class="font-medium">Emitido: {{ formatDate(cert.fechaEmision) }}</p>
                        <p class="text-xs text-slate-500">Vence: {{ formatDate(cert.fechaVencimiento) }}</p>
                        <span :class="['text-[10px] px-2 py-0.5 rounded-full', estadoCertClasses(cert.estadoCertificado)]">
                          {{ cert.estadoCertificado }}
                        </span>
                      </div>
                      <div class="flex gap-2">
                        <button @click="abrirVisor(cert.id_certificado)"
                          class="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                          Ver PDF
                        </button>
                        <button @click="abrirImprimir(cert)"
                          class="px-3 py-1.5 text-xs border border-slate-300 hover:bg-slate-50 rounded-lg">
                          Imprimir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Formulario de generación (solo si no hay vigentes o quiere generar otro) -->
                <div v-if="!certGeneradoDesdeSolicitud" class="space-y-4">
                  <div class="flex items-center gap-2 text-xs text-slate-500">
                    <div class="flex-1 h-px bg-slate-200"></div>
                    <span>GENERAR NUEVO CERTIFICADO</span>
                    <div class="flex-1 h-px bg-slate-200"></div>
                  </div>

                  <button
                    @click="generarDesdeSolicitud"
                    :disabled="generandoDesdeSolicitud"
                    class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <svg v-if="generandoDesdeSolicitud" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <span>Generar Certificado Ahora</span>
                  </button>
                </div>

                <!-- Certificado recién generado -->
                <div v-else class="space-y-4">
                  <!-- ... (mantén tu bloque actual de éxito) ... -->
                  <div class="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                      </svg>
                    </div>
                    <div class="flex-1">
                      <p class="font-semibold text-emerald-800">¡Certificado generado exitosamente!</p>
                      <p class="text-xs text-emerald-600 mt-0.5">El certificado ha sido emitido.</p>
                    </div>
                  </div>

                  <div class="flex flex-col sm:flex-row gap-3">
                    <button @click="abrirVisor(certGeneradoDesdeSolicitud.id_certificado)" class="flex-1 ...">
                      Ver PDF
                    </button>
                    <button @click="abrirImprimirDesdeSolicitud" class="flex-1 ...">
                      Imprimir
                    </button>
                    <button @click="nuevaGeneracion" class="px-5 py-3 ...">
                      Nuevo
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </Transition>

      </div>
    </div>

    <!-- ═══════════════════ B: GENERAR DIRECTO ═══════════════════ -->
    <div v-if="mainTab === 'generar'" class="space-y-5">

      <div v-if="!certGenerado" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
 

        <div class="p-5 space-y-5">
          <!-- Buscador de usuario -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Buscar estudiante <span class="text-red-400">*</span></label>
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input v-model="userQuery" type="text" placeholder="Buscar por nombre, CI o matrícula..."
                :disabled="!!selectedUser"
                class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-400"/>
              <div v-if="userLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                <svg class="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
              <!-- Dropdown -->
              <div v-if="userDropdownOpen && userResults.length && !selectedUser"
                class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                <button v-for="u in userResults" :key="u.id_usuario" @click="selectUser(u)"
                  class="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0">
                  <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                    {{ u.persona.nombreCompleto.charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-slate-800 capitalize" v-html="highlight(u.persona.nombreCompleto, userQuery)"/>
                    <p class="text-xs text-slate-400">CI: {{ u.persona.ci }}<span v-if="u.persona.matricula"> · Mat: {{ u.persona.matricula }}</span></p>
                  </div>
                </button>
              </div>
              <div v-else-if="userDropdownOpen && !userResults.length && !userLoading && !selectedUser"
                class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-20 py-6 text-center">
                <p class="text-sm text-slate-400">Sin resultados para "{{ userQuery }}"</p>
              </div>
            </div>
          </div>

          <!-- Usuario seleccionado -->
          <div v-if="selectedUser" class="flex items-center gap-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <div class="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold flex-shrink-0">
              {{ selectedUser.persona.nombreCompleto.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-slate-800 text-sm capitalize">{{ selectedUser.persona.nombreCompleto }}</p>
              <p class="text-xs text-slate-500">CI: {{ selectedUser.persona.ci }}<span class="text-slate-400"> · @{{ selectedUser.username }}</span></p>
            </div>
            <button @click="resetUser" class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Cambiar
            </button>
          </div>

          <!-- Verificación automática -->
          <template v-if="selectedUser">
            <div v-if="verificandoEstudiante" class="space-y-1.5">
              <div class="h-10 bg-slate-100 rounded-xl animate-pulse"/>
              <p class="text-xs text-center text-slate-400">Verificando sanciones y certificados...</p>
            </div>
            <template v-else>
              <!-- Suspensión -->
              <div v-if="estudianteTieneSuspension" class="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636"/>
                  </svg>
                  <div>
                    <p class="text-sm font-bold text-red-800">Estudiante con suspensión activa</p>
                    <p class="text-xs text-red-600 mt-0.5">
                      Suspensión vigente
                      <span v-if="estadoSancionUsuario?.fechaFinSuspensionMasProxima">
                        hasta el <strong>{{ formatDate(estadoSancionUsuario.fechaFinSuspensionMasProxima) }}</strong>
                      </span>. No se puede emitir el certificado.
                    </p>
                    <p v-if="estadoSancionUsuario?.tieneDeudaPendiente" class="text-xs text-red-500 mt-1">
                      También tiene {{ estadoSancionUsuario.totalSancionesActivas }} multa(s) pendiente(s).
                    </p>
                  </div>
                </div>
              </div>

              <!-- Deuda (advertencia) -->
              <div v-else-if="estudianteTieneDeuda" class="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <p class="text-xs text-amber-700 flex-1">
                  Tiene <strong>{{ estadoSancionUsuario?.totalSancionesActivas }}</strong> multa(s) pendiente(s).
                  Puedes generar el certificado, pero considera informarle.
                </p>
              </div>

              <!-- OK -->
              <div v-else-if="!estudianteTieneVigente" class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                <p class="text-xs text-emerald-700">Sin sanciones activas ni certificados vigentes. Puede generar.</p>
              </div>

              <!-- Ya tiene vigente -->
              <div v-if="certificadosUsuario.length > 0"
                class="flex items-center gap-3 p-3 rounded-xl border text-sm"
                :class="estudianteTieneVigente ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span class="flex-1 text-xs">
                  <strong>{{ certificadosUsuario.length }}</strong> certificado(s)
                  <span v-if="estudianteTieneVigente"> — <strong>{{ certificadosUsuario.filter(c => c.estadoCertificado === 'VIGENTE').length }} VIGENTE(s)</strong>, no se puede generar otro</span>
                  <span v-else> — ninguno vigente</span>.
                </span>
                <button @click="showCertsModal = true"
                  class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  :class="estudianteTieneVigente ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                  Ver
                </button>
              </div>

              <!-- Días de validez -->
              <div v-if="!estudianteTieneSuspension && !estudianteTieneVigente">
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Días de validez</label>
                <div class="flex items-center gap-3">
                  <button @click="diasValidez = Math.max(1, diasValidez - 1)"
                    class="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
                  </button>
                  <span class="text-lg font-bold text-slate-800 w-8 text-center">{{ diasValidez }}</span>
                  <button @click="diasValidez = Math.min(30, diasValidez + 1)"
                    class="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  </button>
                  <span class="text-xs text-slate-400">días (máx. 30)</span>
                </div>
              </div>
            </template>
          </template>

          <!-- Error -->
          <div v-if="certError" class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            {{ certError }}
          </div>

          <!-- Botón generar -->
          <button @click="generarCertificado" :disabled="!puedeGenerar || generandoCert"
            :class="['w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              puedeGenerar && !generandoCert
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
            <svg v-if="generandoCert" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            {{ generandoCert ? 'Generando...'
              : isAdmin && !targetBibliotecaId ? 'Selecciona una biblioteca'
              : !selectedUser ? 'Selecciona un estudiante'
              : estudianteTieneSuspension ? 'No disponible (suspensión activa)'
              : estudianteTieneVigente ? 'Ya tiene certificado vigente'
              : verificandoEstudiante ? 'Verificando...'
              : 'Generar Certificado' }}
          </button>
        </div>
      </div>

      <!-- Certificado generado -->
      <Transition name="fade">
        <div v-if="certGenerado" class="space-y-4">
          <div class="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-emerald-800 text-sm">¡Certificado generado exitosamente!</p>
              <p class="text-xs text-emerald-600 mt-0.5">
                El certificado de <strong class="capitalize">{{ selectedUser?.persona.nombreCompleto }}</strong> fue emitido. El estudiante recibirá una notificación.
              </p>
            </div>
          </div>

          <!-- Preview del cert + acciones -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <h3 class="font-semibold text-slate-800 text-sm">Certificado emitido</h3>
              </div>
              <span :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoCertClasses(certGenerado.estadoCertificado)]">
                {{ certGenerado.estadoCertificado }}
              </span>
            </div>

            <div class="p-5 space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p class="text-slate-400 mb-0.5">Estudiante</p>
                  <p class="font-semibold text-slate-800 capitalize">{{ selectedUser?.persona.nombreCompleto }}</p>
                  <p class="text-slate-500 mt-0.5">CI: {{ selectedUser?.persona.ci }}</p>
                </div>
                <div class="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p class="text-slate-400 mb-0.5">Código</p>
                  <p class="font-mono font-semibold text-indigo-700 break-all">{{ certGenerado.codigo_verificacion }}</p>
                </div>
                <div class="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p class="text-slate-400 mb-0.5">Emitido</p>
                  <p class="font-medium text-slate-700">{{ formatDateTime(certGenerado.fechaEmision) }}</p>
                </div>
                <div class="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p class="text-slate-400 mb-0.5">Vence</p>
                  <p class="font-medium text-emerald-700">{{ formatDateTime(certGenerado.fechaVencimiento) }}</p>
                </div>
              </div>
              <!-- QR mini -->
              <div class="flex items-center justify-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <img v-if="qrUrl" :src="qrUrl" alt="QR" class="w-20 h-20 rounded-lg" loading="lazy"/>
                <div v-else class="w-20 h-20 bg-slate-200 rounded-lg animate-pulse"/>
                <div>
                  <p class="text-xs font-semibold text-slate-700 mb-1">Código QR de verificación</p>
                  <p class="text-xs text-slate-400 leading-relaxed">El estudiante puede escanear este QR para verificar la autenticidad del certificado.</p>
                </div>
              </div>
            </div>

            <div class="px-5 pb-5 flex flex-col sm:flex-row gap-3">
              <button @click="abrirVisor(certGenerado.id_certificado)"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-[0.98]">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                PDF oficial
              </button>
              <button @click="abrirImprimir(certGenerado)"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                </svg>
                Imprimir
              </button>
              <button @click="certGenerado = null; resetUser()"
                class="sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Nuevo
              </button>
            </div>
          </div>
        </div>
      </Transition>

    </div>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(8px); }

.slide-right-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.slide-right-leave-active { transition: opacity 0.15s ease; }
.slide-right-enter-from { opacity: 0; transform: translateX(16px); }
.slide-right-leave-to { opacity: 0; }
</style>