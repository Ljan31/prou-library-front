<script setup lang="ts">
/**
 * CertificadosEstudiante.vue
 *
 * Flujo:
 *  1. Selecciona biblioteca → carga razones + (si logueado) verifica préstamos y sanciones
 *  2. Si está logueado → datos se autocompletan desde auth.user
 *     Si NO está logueado → llena el formulario manualmente (sin verificación)
 *  3. Selecciona razón → muestra descripción y requisitos que debe traer
 *  4. Envía solicitud → POST /api/certificados/solicitar
 *  5. Muestra éxito con los requisitos a llevar al recoger el certificado
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import api from '@/services/axios'
import {
  razonCertificadoService,
  mapRazon,
  REQUISITO_LABELS,
  type RazonCertificado,
} from '@/services/razon-certificado.service'
import CertificadosModal from './CertificadosModal.vue'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'
import CertificadoPreview from './CertificadoPreview.vue'

const ui = useUiStore()
const auth = useAuthStore()
const { isEstudiante } = usePermissions()

// ─── Types ────────────────────────────────────────────────────────────────────
interface Biblioteca {
  id_biblioteca: number
  nombre: string
  direccion?: string
}

interface Certificado {
  id_certificado: number
  fechaEmision: string
  fechaVencimiento: string
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  urlDescarga: string
  bibliotecaNombre?: string
  usuario?: { nombreCompleto?: string; ci?: string | number }
  bibliotecario?: { nombreCompleto?: string }
}

interface SolicitudResponse {
  id: number
  nombres: string
  apellidos: string
  ci: string
  bibliotecaId: number
  bibliotecaNombre: string
  razonId: number
  razonNombre: string
  requisitos: string
  descripcion?: string
  estado: 'PENDIENTE' | 'PROCESADA' | 'RECHAZADA'
  fechaSolicitud: string
  email?: string
}

interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'RENOVADO' | 'DEVUELTO' | 'VENCIDO' | 'CANCELADO'
  vencido: boolean
  fechaDevolucionEstimada?: string
  biblioteca?: { id_biblioteca?: number; nombre?: string }
  ejemplar?: { libro?: { titulo?: string }; codigo_ejemplar?: string }
}

interface EstadoSancion {
  tieneSuspensionVigente: boolean
  tieneDeudaPendiente: boolean
  totalSancionesActivas: number
  fechaFinSuspensionMasProxima: string | null
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchBibliotecas()
  if (isEstudiante.value && auth.user?.id) {
    await Promise.all([
      fetchCertificadosUsuario(auth.user.id),
      fetchEstadoGlobal(),
      fetchMisSolicitudes(),
    ])
    autocompletarFormulario()
  }
})

// ─── Bibliotecas ──────────────────────────────────────────────────────────────
const bibliotecas = ref<Biblioteca[]>([])
const selectedBibliotecaId = ref<number | null>(null)

async function fetchBibliotecas() {
  try {
    const { data } = await api.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch { bibliotecas.value = [] }
}

// Al cambiar biblioteca: cargar razones y (si logueado) verificar estado
watch(selectedBibliotecaId, async (id) => {
  razones.value = []
  form.value.razonCertificadoId = null
  prestamosEnBiblioteca.value = []
  if (!id) return
  // Cargar en paralelo
  const tasks: Promise<void>[] = [cargarRazones(id)]
  if (isEstudiante.value && auth.user?.id) {
    tasks.push(verificarEstadoEnBiblioteca(id))
  }
  await Promise.all(tasks)
})

// ─── Razones dinámicas por biblioteca ─────────────────────────────────────────
const razones = ref<RazonCertificado[]>([])
const razonesLoading = ref(false)

async function cargarRazones(bibliotecaId: number) {
  razonesLoading.value = true
  try {
    const data = await razonCertificadoService.getByBiblioteca(bibliotecaId)
    razones.value = (Array.isArray(data) ? data : []).map(mapRazon).filter(r => r.activo)
  } catch {
    razones.value = []
    ui.toast.error('Error', 'No se pudieron cargar las razones para esta biblioteca')
  } finally {
    razonesLoading.value = false
  }
}

const selectedRazon = computed<RazonCertificado | null>(() =>
  razones.value.find(r => r.idRazon === form.value.razonCertificadoId) ?? null
)

const requisitosRazon = computed<string[]>(() => {
  if (!selectedRazon.value?.requisitos?.length) return []
  return selectedRazon.value.requisitos.map(r => REQUISITO_LABELS[r] ?? r)
})

// ─── Verificación de estado (solo usuarios logueados) ─────────────────────────
const verificandoEstado = ref(false)
const estadoSancion = ref<EstadoSancion | null>(null)
const prestamos = ref<Prestamo[]>([])           // todos mis préstamos
const prestamosEnBiblioteca = ref<Prestamo[]>([]) // activos/renovados en la biblioteca elegida

// Estado global: sanciones + todos los préstamos
async function fetchEstadoGlobal() {
  if (!auth.user?.id) return
  try {
    const [sancionRes, prestamosRes] = await Promise.all([
      api.get(`/sanciones/usuario/${auth.user.id}/estado`),
      api.get('/prestamos/mis-prestamos'),
    ])
    estadoSancion.value = sancionRes.data.data ?? sancionRes.data
    prestamos.value = prestamosRes.data.data ?? []
  } catch {
    // silencioso — si falla, no bloqueamos
  }
}

// Verificar específicamente préstamos en la biblioteca seleccionada
async function verificarEstadoEnBiblioteca(bibliotecaId: number) {
  verificandoEstado.value = true
  try {
    // Filtrar los préstamos activos/renovados que pertenecen a esta biblioteca
    prestamosEnBiblioteca.value = prestamos.value.filter(p =>
      (p.estadoPrestamo === 'ACTIVO' || p.estadoPrestamo === 'RENOVADO') &&
      p.biblioteca?.id_biblioteca === bibliotecaId
    )
  } finally {
    verificandoEstado.value = false
  }
}

// Computed del estado en la biblioteca seleccionada
const tieneSuspension = computed(() => estadoSancion.value?.tieneSuspensionVigente ?? false)
const tieneDeudaGlobal = computed(() => estadoSancion.value?.tieneDeudaPendiente ?? false)
const tienePrestamosPendientesEnBiblioteca = computed(() => prestamosEnBiblioteca.value.length > 0)

// Bloqueo: suspensión o préstamos activos en esa biblioteca
const bloqueado = computed(() => {
  if (!isEstudiante.value) return false
  if (!selectedBibliotecaId.value) return false
  return tieneSuspension.value || tienePrestamosPendientesEnBiblioteca.value
})

const motivoBloqueo = computed<string | null>(() => {
  if (!isEstudiante.value || !selectedBibliotecaId.value) return null
  if (tieneSuspension.value) return 'Tu cuenta tiene una suspensión activa. No puedes solicitar certificados hasta que finalice.'
  if (tienePrestamosPendientesEnBiblioteca.value)
    return `Tienes ${prestamosEnBiblioteca.value.length} préstamo(s) activo(s) en esta biblioteca. Debes devolverlos antes de solicitar el certificado.`
  return null
})

// ─── Certificados existentes del usuario logueado ─────────────────────────────
const certificadosUsuario = ref<Certificado[]>([])
const certLoading = ref(false)

async function fetchCertificadosUsuario(userId: number) {
  certLoading.value = true
  try {
    const { data } = await api.get(`/certificados/usuario/${userId}`)
    certificadosUsuario.value = data.data ?? []
  } catch { certificadosUsuario.value = [] }
  finally { certLoading.value = false }
}

// ─── Mis solicitudes (solo estudiantes logueados) ─────────────────────────────
const misSolicitudes = ref<MiSolicitud[]>([])
const solicitudesLoading = ref(false)
const solicitudesPage = ref(0)
const solicitudesTotalPages = ref(0)
const solicitudesTotalElements = ref(0)
const showSolicitudesPanel = ref(false)
const solicitudDetalle = ref<MiSolicitud | null>(null)

async function fetchMisSolicitudes(page = 0) {
  if (!isEstudiante.value) return
  solicitudesLoading.value = true
  try {
    const { data } = await api.get('/solicitudes-certificado/mis-solicitudes', {
      params: { page, size: 5, sortBy: 'fechaSolicitud', direction: 'desc' }
    })
    // Spring Page response
    const pageData = data.data ?? data
    misSolicitudes.value = pageData.content ?? pageData ?? []
    solicitudesTotalPages.value = pageData.totalPages ?? 1
    solicitudesTotalElements.value = pageData.totalElements ?? misSolicitudes.value.length
    solicitudesPage.value = page
  } catch {
    misSolicitudes.value = []
  } finally {
    solicitudesLoading.value = false
  }
}

function toggleSolicitudesPanel() {
  showSolicitudesPanel.value = !showSolicitudesPanel.value
  if (showSolicitudesPanel.value && misSolicitudes.value.length === 0) {
    fetchMisSolicitudes()
  }
}

// ─── Formulario ───────────────────────────────────────────────────────────────
const form = ref({
  nombres: '',
  apellidos: '',
  ci: '',
  matricula: '',
  email: '',
  telefono: '',
  razonCertificadoId: null as number | null,
  descripcion: '',
})

function autocompletarFormulario() {
  const p = auth.user?.persona
  if (!p) return
  // Separar nombreCompleto en nombres / apellidos por la mitad
  const partes = (p.nombreCompleto ?? '').trim().split(' ')
  const mitad = Math.ceil(partes.length / 2)
  form.value.nombres   = partes.slice(0, mitad).join(' ')
  form.value.apellidos = partes.slice(mitad).join(' ')
  form.value.ci        = String(p.ci ?? '')
  form.value.matricula = p.matricula ?? ''
  form.value.email     = p.email ?? ''
  form.value.telefono  = p.celular ?? ''
}

const formErrors = ref<Record<string, string>>({})

function validarFormulario(): boolean {
  const e: Record<string, string> = {}
  if (!form.value.nombres.trim())          e.nombres    = 'El nombre es obligatorio'
  if (!form.value.apellidos.trim())        e.apellidos  = 'Los apellidos son obligatorios'
  if (!form.value.ci.trim())               e.ci         = 'El CI es obligatorio'
  if (!selectedBibliotecaId.value)         e.biblioteca = 'Selecciona una biblioteca'
  if (!form.value.razonCertificadoId)      e.razon      = 'Selecciona la razón del certificado'
  if (form.value.descripcion.length > 500) e.descripcion = 'Máximo 500 caracteres'
  formErrors.value = e
  return Object.keys(e).length === 0
}

// ─── Envío ────────────────────────────────────────────────────────────────────
const solicitando = ref(false)
const solicitudExitosa = ref(false)
const solicitudData = ref<SolicitudResponse | null>(null)
const solicitudError = ref<string | null>(null)

// Capturar requisitos de la razón seleccionada antes de limpiar el form
const requisitosAlEnviar = ref<string[]>([])

async function solicitarCertificado() {
  if (!validarFormulario()) return
  if (bloqueado.value) return
  solicitando.value = true
  solicitudError.value = null
  // Guardar los requisitos antes de limpiar
  requisitosAlEnviar.value = [...requisitosRazon.value]
  try {
    const payload: Record<string, unknown> = {
      bibliotecaId:        selectedBibliotecaId.value,
      nombres:             form.value.nombres.trim(),
      apellidos:           form.value.apellidos.trim(),
      ci:                  form.value.ci.trim(),
      razonCertificadoId:  form.value.razonCertificadoId,
    }
    if (form.value.matricula.trim()) payload.matricula    = form.value.matricula.trim()
    if (form.value.descripcion.trim()) payload.descripcion = form.value.descripcion.trim()
    if (form.value.email.trim())     payload.email        = form.value.email.trim()
    if (form.value.telefono.trim())  payload.telefono     = form.value.telefono.trim()

    const { data } = await api.post('/solicitudes-certificado', payload)
    if (data.success) {
      solicitudData.value = data.data
      solicitudExitosa.value = true
      ui.toast.success('Solicitud enviada', 'Los encargados de la biblioteca han sido notificados.')
    } else {
      solicitudError.value = data.message ?? 'No se pudo registrar la solicitud'
      ui.toast.error('Error', solicitudError.value!)
    }
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'Error al enviar la solicitud'
    solicitudError.value = msg
    ui.toast.error('Error', msg)
  } finally {
    solicitando.value = false
  }
}

function resetFormulario() {
  solicitudExitosa.value = false
  solicitudData.value    = null
  solicitudError.value   = null
  selectedBibliotecaId.value = null
  form.value = { nombres: '', apellidos: '', ci: '', matricula: '', email: '', telefono: '', razonCertificadoId: null, descripcion: '' }
  formErrors.value = {}
  razones.value = []
  prestamosEnBiblioteca.value = []
  requisitosAlEnviar.value = []
  solicitudDetalle.value = null
  if (isEstudiante.value) {
    autocompletarFormulario()
    fetchMisSolicitudes()        // refrescar lista de solicitudes
  }
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────
const showModal      = ref(false)
const pdfViewerShow  = ref(false)
const pdfViewerCertId = ref<number | null>(null)
const showPrint      = ref(false)
const printCert      = ref<Certificado | null>(null)

function abrirVisor(id: number)           { pdfViewerCertId.value = id; pdfViewerShow.value = true }
function abrirImprimir(cert: Certificado) { printCert.value = cert; showPrint.value = true }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function estadoCertClasses(e: string) {
  return ({ VIGENTE: 'bg-emerald-100 text-emerald-700', VENCIDO: 'bg-amber-100 text-amber-700', ANULADO: 'bg-red-100 text-red-700' })[e] ?? 'bg-slate-100 text-slate-600'
}

function estadoPrestamoLabel(p: Prestamo) {
  if (p.vencido) return 'VENCIDO'
  return p.estadoPrestamo
}

function estadoPrestamoClass(p: Prestamo) {
  if (p.vencido || p.estadoPrestamo === 'VENCIDO') return 'bg-red-100 text-red-700'
  if (p.estadoPrestamo === 'ACTIVO')   return 'bg-emerald-100 text-emerald-700'
  if (p.estadoPrestamo === 'RENOVADO') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

function inputClass(field: string) {
  return formErrors.value[field]
    ? 'border-red-300 bg-red-50 focus:ring-red-400'
    : 'border-slate-200 bg-white focus:ring-indigo-400'
}
</script>

<template>
  <div class="space-y-6">

    <!-- Subcomponentes -->
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false"/>
    <CertificadoPreview
      v-if="showPrint && printCert"
      :certificado="printCert"
      :nombre-usuario="printCert.usuario?.nombreCompleto ?? ''"
      :ci-usuario="String(printCert.usuario?.ci ?? '')"
      @close="showPrint = false"
    />
    <CertificadosModal
      :show="showModal"
      :certificados="certificadosUsuario"
      titulo="Mis certificados"
      :can-anular="false"
      @close="showModal = false"
      @ver-pdf="abrirVisor"
      @imprimir="abrirImprimir"
    />

    <!-- ══ BANNER USUARIO LOGUEADO ══ -->
    <div v-if="isEstudiante" class="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
      <div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
        {{ auth.displayName.charAt(0).toUpperCase() }}
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-indigo-900 text-sm capitalize">{{ auth.displayName }}</p>
        <p class="text-xs text-indigo-600 mt-0.5">Tus datos se completaron automáticamente. Selecciona la biblioteca para verificar tu estado.</p>
      </div>
      <button
        v-if="certificadosUsuario.length > 0"
        @click="showModal = true"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold transition-colors flex-shrink-0 shadow-sm"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        Mis certificados
        <span class="bg-indigo-100 text-indigo-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none">
          {{ certificadosUsuario.length }}
        </span>
      </button>
    </div>

    <!-- ══ BANNER NO LOGUEADO ══ -->
    <div v-else class="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
      <svg class="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p class="text-sm text-slate-600">
        Puedes solicitar el certificado sin iniciar sesión. Completa el formulario con tus datos.
        Si tienes cuenta, <a href="/login" class="text-indigo-600 hover:underline font-medium">inicia sesión</a>
        para completar los datos automáticamente y ver el estado de tu cuenta.
      </p>
    </div>

    <!-- ══ MIS SOLICITUDES (solo estudiante logueado) ══ -->
    <div v-if="isEstudiante && misSolicitudes.length > 0 || (isEstudiante && solicitudesLoading)" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      <!-- Header colapsable -->
      <button
        @click="toggleSolicitudesPanel"
        class="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <div class="flex-1 text-left">
          <p class="font-semibold text-slate-800 text-sm">Mis solicitudes</p>
          <p class="text-xs text-slate-400 mt-0.5">
            {{ solicitudesTotalElements > 0 ? `${solicitudesTotalElements} solicitud(es) registrada(s)` : 'Historial de solicitudes' }}
          </p>
        </div>
        <!-- Badges de estado -->
        <div class="flex gap-1.5 flex-shrink-0">
          <span v-if="misSolicitudes.filter(s => s.estado === 'PENDIENTE').length > 0"
            class="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
            {{ misSolicitudes.filter(s => s.estado === 'PENDIENTE').length }} pendiente(s)
          </span>
          <span v-if="misSolicitudes.filter(s => s.estado === 'APROBADA').length > 0"
            class="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
            {{ misSolicitudes.filter(s => s.estado === 'APROBADA').length }} aprobada(s)
          </span>
        </div>
        <!-- Chevron -->
        <svg :class="['w-4 h-4 text-slate-400 transition-transform flex-shrink-0', showSolicitudesPanel ? 'rotate-180' : '']"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      <!-- Panel expandible -->
      <Transition name="slide-fade">
        <div v-if="showSolicitudesPanel" class="border-t border-slate-100">

          <!-- Loading -->
          <div v-if="solicitudesLoading" class="p-4 space-y-3">
            <div v-for="i in 3" :key="i" class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-slate-100 animate-pulse flex-shrink-0"/>
              <div class="flex-1 space-y-1.5">
                <div class="h-3 bg-slate-100 rounded animate-pulse w-1/2"/>
                <div class="h-2.5 bg-slate-100 rounded animate-pulse w-1/3"/>
              </div>
              <div class="h-5 w-16 bg-slate-100 rounded-full animate-pulse"/>
            </div>
          </div>

          <!-- Lista -->
          <div v-else-if="misSolicitudes.length > 0">
            <div class="divide-y divide-slate-50">
              <button
                v-for="s in misSolicitudes"
                :key="s.id"
                @click="solicitudDetalle = solicitudDetalle?.id === s.id ? null : s"
                :class="['w-full flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left',
                  solicitudDetalle?.id === s.id ? 'bg-indigo-50/50' : '']"
              >
                <!-- Icono estado -->
                <div :class="['w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5',
                  s.estado === 'PENDIENTE' ? 'bg-amber-100' : s.estado === 'APROBADA' ? 'bg-emerald-100' : 'bg-red-100']">
                  <svg v-if="s.estado === 'PENDIENTE'" class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <svg v-else-if="s.estado === 'APROBADA'" class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                  <svg v-else class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-semibold text-slate-800">{{ s.razonNombre }}</p>
                    <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                      s.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700'
                      : s.estado === 'APROBADA' ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-600']">
                      {{ s.estado === 'PENDIENTE' ? 'Pendiente' : s.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada' }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">{{ s.bibliotecaNombre }}</p>
                  <p class="text-xs text-slate-400">{{ formatDateTime(s.fechaSolicitud) }}</p>
                </div>

                <svg :class="['w-4 h-4 text-slate-400 flex-shrink-0 mt-1 transition-transform', solicitudDetalle?.id === s.id ? 'rotate-180' : '']"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              <!-- Detalle expandido -->
              <Transition name="slide-fade">
                <div v-if="solicitudDetalle" class="px-5 pb-4 pt-3 bg-slate-50 space-y-3 border-t border-slate-100">
                  <!-- Historial de fechas -->
                  <div class="space-y-1.5 text-xs">
                    <div class="flex items-center gap-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-indigo-400"/>
                      <span class="text-slate-500">Solicitud enviada el</span>
                      <span class="font-medium text-slate-700">{{ formatDateTime(solicitudDetalle.fechaSolicitud) }}</span>
                    </div>
                    <div v-if="solicitudDetalle.fechaRespuesta" class="flex items-center gap-2">
                      <div :class="['w-1.5 h-1.5 rounded-full', solicitudDetalle.estado === 'APROBADA' ? 'bg-emerald-500' : 'bg-red-500']"/>
                      <span class="text-slate-500">
                        {{ solicitudDetalle.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada' }} el
                      </span>
                      <span class="font-medium text-slate-700">{{ formatDateTime(solicitudDetalle.fechaRespuesta) }}</span>
                    </div>
                    <div v-if="solicitudDetalle.atendidoPorNombre" class="flex items-center gap-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-slate-300"/>
                      <span class="text-slate-500">Atendida por</span>
                      <span class="font-medium text-slate-700">{{ solicitudDetalle.atendidoPorNombre }}</span>
                    </div>
                  </div>

                  <!-- Descripción -->
                  <div v-if="solicitudDetalle.descripcion" class="text-xs">
                    <p class="text-slate-400 mb-0.5 font-medium">Tu descripción</p>
                    <p class="text-slate-600 bg-white rounded-lg border border-slate-200 px-3 py-2">
                      {{ solicitudDetalle.descripcion }}
                    </p>
                  </div>

                  <!-- Observación del bibliotecario -->
                  <div v-if="solicitudDetalle.observacionRespuesta" class="text-xs">
                    <p class="text-slate-400 mb-0.5 font-medium">Observación del bibliotecario</p>
                    <p :class="['rounded-lg border px-3 py-2',
                      solicitudDetalle.estado === 'APROBADA'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700']">
                      {{ solicitudDetalle.observacionRespuesta }}
                    </p>
                  </div>

                  <!-- Requisitos -->
                  <div v-if="solicitudDetalle.requisitos" class="text-xs">
                    <p class="text-slate-400 mb-0.5 font-medium">Requisitos al recoger</p>
                    <p class="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {{ solicitudDetalle.requisitos }}
                    </p>
                  </div>

                  <!-- Estado: qué hacer ahora -->
                  <div v-if="solicitudDetalle.estado === 'PENDIENTE'"
                    class="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-xs text-amber-700">
                      Tu solicitud está siendo revisada. Recibirás una notificación cuando sea procesada.
                    </p>
                  </div>

                  <div v-else-if="solicitudDetalle.estado === 'APROBADA'"
                    class="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <svg class="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                    </svg>
                    <p class="text-xs text-emerald-700">
                      ¡Tu solicitud fue aprobada! Dirígete a <strong>{{ solicitudDetalle.bibliotecaNombre }}</strong> con tus documentos para recoger el certificado.
                    </p>
                  </div>

                  <div v-else-if="solicitudDetalle.estado === 'RECHAZADA'"
                    class="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <svg class="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <p class="text-xs text-red-600">
                      Tu solicitud fue rechazada. Puedes enviar una nueva solicitud una vez resuelves la situación indicada.
                    </p>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Paginación -->
            <div v-if="solicitudesTotalPages > 1" class="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">
              <p class="text-xs text-slate-400">
                Página {{ solicitudesPage + 1 }} de {{ solicitudesTotalPages }}
              </p>
              <div class="flex gap-1.5">
                <button
                  @click="fetchMisSolicitudes(solicitudesPage - 1)"
                  :disabled="solicitudesPage === 0"
                  class="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  @click="fetchMisSolicitudes(solicitudesPage + 1)"
                  :disabled="solicitudesPage >= solicitudesTotalPages - 1"
                  class="px-2.5 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          </div>

          <!-- Vacío -->
          <div v-else class="py-8 text-center">
            <svg class="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p class="text-xs text-slate-400">Aún no tienes solicitudes enviadas</p>
          </div>

        </div>
      </Transition>
    </div>

    <!-- ══ ÉXITO ══ -->
    <Transition name="fade">
      <div v-if="solicitudExitosa && solicitudData" class="space-y-4">

        <!-- Banner éxito -->
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 overflow-hidden">
          <div class="flex items-start gap-4 p-5">
            <div class="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div class="flex-1">
              <p class="font-bold text-emerald-800 text-base">¡Solicitud enviada correctamente!</p>
              <p class="text-sm text-emerald-700 mt-1">
                Los encargados de <strong>{{ solicitudData.bibliotecaNombre }}</strong> han sido notificados y procesarán tu solicitud a la brevedad.
              </p>
              <div class="mt-2 flex flex-wrap gap-3 text-xs text-emerald-600">
                <span class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                  </svg>
                  N° solicitud: <strong class="font-mono">{{ solicitudData.id }}</strong>
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  {{ formatDateTime(solicitudData.fechaSolicitud) }}
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Estado: <strong>{{ solicitudData.estado }}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Resumen -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <h3 class="font-semibold text-slate-800 text-sm">Resumen de tu solicitud</h3>
          </div>
          <div class="p-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Solicitante</p>
              <p class="font-medium text-slate-800 capitalize">{{ solicitudData.nombres }} {{ solicitudData.apellidos }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">CI</p>
              <p class="font-medium text-slate-800">{{ solicitudData.ci }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Biblioteca</p>
              <p class="font-medium text-slate-800">{{ solicitudData.bibliotecaNombre }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Razón</p>
              <p class="font-medium text-slate-800">{{ solicitudData.razonNombre }}</p>
            </div>
            <div v-if="solicitudData.descripcion" class="col-span-2">
              <p class="text-xs text-slate-400 mb-0.5">Descripción</p>
              <p class="text-slate-700">{{ solicitudData.descripcion }}</p>
            </div>
          </div>
        </div>

        <!-- Requisitos a presentar al recoger -->
        <div
          v-if="requisitosAlEnviar.length > 0 || solicitudData.requisitos"
          class="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden"
        >
          <div class="flex items-center gap-2.5 px-5 py-4 border-b border-amber-100">
            <div class="w-8 h-8 rounded-xl bg-amber-200 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
              </svg>
            </div>
            <h3 class="font-semibold text-amber-800 text-sm">¡Importante! — Documentos a presentar al recoger</h3>
          </div>
          <div class="p-5 space-y-3">
            <p v-if="solicitudData.requisitos" class="text-sm text-amber-800">{{ solicitudData.requisitos }}</p>
            <ul v-if="requisitosAlEnviar.length > 0" class="space-y-2">
              <li v-for="(req, i) in requisitosAlEnviar" :key="i"
                class="flex items-start gap-2.5 text-sm text-amber-800">
                <div class="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {{ i + 1 }}
                </div>
                <span class="font-medium">{{ req }}</span>
              </li>
            </ul>
            <p class="text-xs text-amber-600 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Dirígete a <strong class="ml-0.5">{{ solicitudData.bibliotecaNombre }}</strong> con estos documentos cuando te notifiquen que tu certificado está listo.
            </p>
          </div>
        </div>

        <!-- Qué pasa ahora -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h4 class="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            ¿Qué pasa ahora?
          </h4>
          <ul class="space-y-2.5">
            <li v-for="(paso, i) in [
              'El encargado de la biblioteca revisará tu solicitud.',
              'Verificarán que no tengas préstamos pendientes ni deudas.',
              isEstudiante ? 'Recibirás una notificación en el sistema cuando el certificado esté listo.' : 'Te contactarán al correo o teléfono que proporcionaste.',
              'Recoge el certificado en la biblioteca con los documentos requeridos.',
            ]" :key="i" class="flex items-start gap-2.5 text-sm text-slate-500">
              <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {{ i + 1 }}
              </span>
              {{ paso }}
            </li>
          </ul>
        </div>

        <button @click="resetFormulario"
          class="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Realizar nueva solicitud
        </button>

      </div>
    </Transition>

    <!-- ══ FORMULARIO ══ -->
    <div v-if="!solicitudExitosa" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <h3 class="font-semibold text-slate-800 text-sm">Solicitar Certificado de No Deuda</h3>
      </div>

      <div class="p-5 space-y-6">

        <!-- ── SECCIÓN 1: Biblioteca y razón ── -->
        <div class="space-y-4">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</span>
            Biblioteca y motivo
          </h4>

          <!-- Selector de biblioteca -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">
              Biblioteca <span class="text-red-400">*</span>
            </label>
            <select
              v-model="selectedBibliotecaId"
              :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputClass('biblioteca')]"
            >
              <option :value="null">Seleccionar biblioteca...</option>
              <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">
                {{ b.nombre }}
              </option>
            </select>
            <p v-if="formErrors.biblioteca" class="text-xs text-red-500 mt-1">{{ formErrors.biblioteca }}</p>
          </div>

          <!-- ── VERIFICACIÓN DE ESTADO (solo cuando está logueado y eligió biblioteca) ── -->
          <template v-if="isEstudiante && selectedBibliotecaId">

            <!-- Cargando -->
            <div v-if="verificandoEstado" class="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <svg class="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p class="text-xs text-slate-500">Verificando tu estado en la biblioteca...</p>
            </div>

            <!-- SUSPENSIÓN ACTIVA — bloqueo duro -->
            <div v-else-if="tieneSuspension" class="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
              <div class="flex items-start gap-3 p-4">
                <div class="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636"/>
                  </svg>
                </div>
                <div>
                  <p class="font-bold text-red-800 text-sm">Cuenta suspendida</p>
                  <p class="text-sm text-red-600 mt-0.5">
                    Tu cuenta tiene una suspensión activa. No puedes solicitar certificados hasta que finalice.
                    <span v-if="estadoSancion?.fechaFinSuspensionMasProxima">
                      Fecha de fin: <strong>{{ formatDate(estadoSancion.fechaFinSuspensionMasProxima) }}</strong>.
                    </span>
                  </p>
                  <p v-if="tieneDeudaGlobal" class="text-xs text-red-500 mt-1.5">
                    También tienes <strong>{{ estadoSancion?.totalSancionesActivas }}</strong> multa(s) pendiente(s). Acércate a la biblioteca para regularizar.
                  </p>
                </div>
              </div>
            </div>

            <!-- PRÉSTAMOS PENDIENTES EN ESTA BIBLIOTECA — bloqueo -->
            <div v-else-if="tienePrestamosPendientesEnBiblioteca" class="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
              <div class="flex items-center gap-2.5 px-4 py-3 border-b border-red-100">
                <svg class="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                <p class="text-sm font-bold text-red-800">
                  Tienes {{ prestamosEnBiblioteca.length }} préstamo(s) activo(s) en esta biblioteca
                </p>
                <span class="ml-auto text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {{ prestamosEnBiblioteca.length }}
                </span>
              </div>
              <div class="divide-y divide-red-100">
                <div v-for="p in prestamosEnBiblioteca" :key="p.id_prestamo"
                  class="flex items-center gap-3 px-4 py-3">
                  <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-red-800 truncate">
                      {{ p.ejemplar?.libro?.titulo ?? 'Libro desconocido' }}
                    </p>
                    <p class="text-xs text-red-500 mt-0.5">
                      Ejemplar: {{ p.ejemplar?.codigo_ejemplar ?? '—' }}
                      <span v-if="p.fechaDevolucionEstimada">
                        · Vence: {{ formatDate(p.fechaDevolucionEstimada) }}
                      </span>
                      <span v-if="p.vencido" class="font-bold"> · ¡VENCIDO!</span>
                    </p>
                  </div>
                  <span :class="['text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0', estadoPrestamoClass(p)]">
                    {{ estadoPrestamoLabel(p) }}
                  </span>
                </div>
              </div>
              <div class="px-4 py-3 bg-red-50 border-t border-red-100">
                <p class="text-xs text-red-600">
                  Debes devolver todos los libros en esta biblioteca antes de solicitar el certificado.
                </p>
              </div>
            </div>

            <!-- ADVERTENCIA: deuda pendiente pero sin bloqueo de préstamos -->
            <div v-else-if="tieneDeudaGlobal"
              class="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <p class="text-xs text-amber-700">
                Tienes <strong>{{ estadoSancion?.totalSancionesActivas }}</strong> multa(s) pendiente(s) de pago en el sistema.
                Puedes solicitar el certificado, pero el encargado puede pedirte que regularices tu situación.
              </p>
            </div>

            <!-- TODO BIEN -->
            <div v-else
              class="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
              <p class="text-xs text-emerald-700">
                No tienes préstamos pendientes ni suspensiones en esta biblioteca. Puedes solicitar el certificado.
              </p>
            </div>

          </template>

          <!-- Razones (solo si no está bloqueado o no está logueado) -->
          <template v-if="selectedBibliotecaId && (!isEstudiante || !bloqueado)">

            <!-- Loading -->
            <div v-if="razonesLoading" class="space-y-2">
              <div class="h-4 bg-slate-100 rounded animate-pulse w-32"/>
              <div v-for="i in 2" :key="i" class="h-14 bg-slate-100 rounded-xl animate-pulse"/>
            </div>

            <!-- Sin razones -->
            <div v-else-if="razones.length === 0 && !razonesLoading"
              class="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              Esta biblioteca no tiene razones de certificado configuradas. Contacta directamente a la biblioteca.
            </div>

            <!-- Lista de razones como radio cards -->
            <div v-else-if="razones.length > 0" class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1.5">
                  Razón del certificado <span class="text-red-400">*</span>
                </label>
                <div class="space-y-2">
                  <label
                    v-for="r in razones"
                    :key="r.idRazon"
                    :class="[
                      'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                      form.razonCertificadoId === r.idRazon
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    ]"
                  >
                    <div class="flex-shrink-0 mt-0.5">
                      <div :class="[
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                        form.razonCertificadoId === r.idRazon ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                      ]">
                        <div v-if="form.razonCertificadoId === r.idRazon" class="w-1.5 h-1.5 rounded-full bg-white"/>
                      </div>
                    </div>
                    <input type="radio" :value="r.idRazon" v-model="form.razonCertificadoId" class="sr-only"/>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-slate-800">{{ r.nombre }}</p>
                      <p v-if="r.descripcion" class="text-xs text-slate-500 mt-0.5">{{ r.descripcion }}</p>
                      <!-- Tags de requisitos como preview -->
                      <div v-if="r.requisitos?.length" class="mt-1.5 flex flex-wrap gap-1">
                        <span
                          v-for="req in r.requisitos"
                          :key="req"
                          class="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium"
                        >
                          {{ REQUISITO_LABELS[req] ?? req }}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
                <p v-if="formErrors.razon" class="text-xs text-red-500 mt-1">{{ formErrors.razon }}</p>
              </div>

              <!-- Detalle de requisitos de la razón elegida -->
              <Transition name="slide-fade">
                <div
                  v-if="selectedRazon && (requisitosRazon.length > 0 || selectedRazon.descripcion)"
                  class="p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div class="flex items-start gap-2.5">
                    <svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                    </svg>
                    <div class="flex-1">
                      <p class="text-xs font-bold text-amber-800 mb-1.5">
                        Documentos que deberás presentar al recoger el certificado:
                      </p>
                      <ul v-if="requisitosRazon.length > 0" class="space-y-1">
                        <li v-for="(req, i) in requisitosRazon" :key="i"
                          class="flex items-center gap-2 text-xs text-amber-800">
                          <svg class="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/>
                          </svg>
                          <span class="font-medium">{{ req }}</span>
                        </li>
                      </ul>
                      <p v-if="selectedRazon.descripcion" class="text-xs text-amber-700 mt-1.5 italic">
                        {{ selectedRazon.descripcion }}
                      </p>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

          </template>
        </div>

        <!-- ── SECCIÓN 2: Datos personales ── -->
        <div v-if="!isEstudiante || !bloqueado" class="space-y-4">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</span>
            Datos personales
            <span v-if="isEstudiante" class="text-[10px] font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full normal-case tracking-normal">
              completados automáticamente
            </span>
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Nombres <span class="text-red-400">*</span></label>
              <input v-model="form.nombres" type="text" placeholder="Ej. Carlos Alberto"
                :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputClass('nombres')]"/>
              <p v-if="formErrors.nombres" class="text-xs text-red-500 mt-1">{{ formErrors.nombres }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Apellidos <span class="text-red-400">*</span></label>
              <input v-model="form.apellidos" type="text" placeholder="Ej. Mamani López"
                :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputClass('apellidos')]"/>
              <p v-if="formErrors.apellidos" class="text-xs text-red-500 mt-1">{{ formErrors.apellidos }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Carnet de Identidad <span class="text-red-400">*</span></label>
              <input v-model="form.ci" type="text" placeholder="Ej. 12345678"
                :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputClass('ci')]"/>
              <p v-if="formErrors.ci" class="text-xs text-red-500 mt-1">{{ formErrors.ci }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">N° de Matrícula <span class="text-slate-400">(opcional)</span></label>
              <input v-model="form.matricula" type="text" placeholder="Ej. 20230125"
                class="w-full px-3 py-2.5 text-sm border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"/>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Correo electrónico <span class="text-slate-400">(opcional)</span></label>
              <input v-model="form.email" type="email" placeholder="correo@ejemplo.com"
                class="w-full px-3 py-2.5 text-sm border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"/>
              <p class="text-[10px] text-slate-400 mt-1">Para recibir notificación cuando el certificado esté listo.</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Teléfono <span class="text-slate-400">(opcional)</span></label>
              <input v-model="form.telefono" type="tel" placeholder="Ej. 76543210"
                class="w-full px-3 py-2.5 text-sm border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"/>
            </div>
          </div>
        </div>

        <!-- ── SECCIÓN 3: Descripción ── -->
        <div v-if="!isEstudiante || !bloqueado" class="space-y-3">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">3</span>
            Información adicional
          </h4>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">
              Descripción / observaciones <span class="text-slate-400">(opcional)</span>
            </label>
            <textarea
              v-model="form.descripcion"
              rows="3"
              maxlength="500"
              placeholder="Describe el motivo de tu solicitud o agrega información relevante para el encargado..."
              :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none placeholder:text-slate-400', inputClass('descripcion')]"
            />
            <div class="flex justify-between mt-1">
              <p v-if="formErrors.descripcion" class="text-xs text-red-500">{{ formErrors.descripcion }}</p>
              <p class="text-xs text-slate-400 ml-auto">{{ form.descripcion.length }}/500</p>
            </div>
          </div>
        </div>

        <!-- Resumen de requisitos antes de enviar -->
        <div
          v-if="requisitosRazon.length > 0 && (!isEstudiante || !bloqueado)"
          class="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl"
        >
          <svg class="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
          </svg>
          <div>
            <p class="text-xs font-semibold text-slate-700 mb-1.5">Al ir a recoger el certificado, deberás presentar:</p>
            <ul class="space-y-1">
              <li v-for="(req, i) in requisitosRazon" :key="i" class="flex items-center gap-2 text-xs text-slate-600">
                <svg class="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                {{ req }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Error general -->
        <div v-if="solicitudError" class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          {{ solicitudError }}
        </div>

        <!-- Botón enviar -->
        <button
          @click="solicitarCertificado"
          :disabled="solicitando || bloqueado"
          :class="['w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            !solicitando && !bloqueado
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed']"
        >
          <svg v-if="solicitando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <svg v-else-if="!bloqueado" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          {{ solicitando ? 'Enviando solicitud...'
            : bloqueado ? motivoBloqueo?.split('.')[0] ?? 'No disponible'
            : 'Enviar Solicitud' }}
        </button>

        <p v-if="!bloqueado" class="text-xs text-center text-slate-400">
          Al enviar, los encargados de la biblioteca serán notificados automáticamente.
        </p>

      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(8px); }

.slide-fade-enter-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.slide-fade-leave-active { transition: opacity 0.15s ease; }
.slide-fade-enter-from { opacity: 0; transform: translateY(-6px); }
.slide-fade-leave-to { opacity: 0; }
</style>