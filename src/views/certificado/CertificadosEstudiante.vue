<script setup lang="ts">
/**
 * CertificadosEstudiante.vue
 *
 * Flujo del estudiante:
 *  1. Selecciona la biblioteca
 *  2. El sistema verifica automáticamente:
 *     - Sanciones activas  → GET /api/sanciones/usuario/{id}/estado
 *     - Préstamos pendientes → GET /api/prestamos/mis-prestamos
 *     - Certificados vigentes → GET /api/certificados/usuario/{id}
 *  3. Si todo está limpio → puede SOLICITAR el certificado
 *     POST /api/certificados → notifica al bibliotecario
 *  4. Puede ver su historial de certificados y descargar/imprimir
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/services/axios'
import CertificadosModal from './CertificadosModal.vue'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'
import CertificadoPreview from './CertificadoPreview.vue'

const ui = useUiStore()
const auth = useAuthStore()

// ─── Types ────────────────────────────────────────────────────────────────────
interface EstadoSancion {
  usuarioId: number
  tieneSuspensionVigente: boolean
  tieneDeudaPendiente: boolean
  totalSancionesActivas: number
  fechaFinSuspensionMasProxima: string | null
}

interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'DEVUELTO' | 'VENCIDO' | 'RENOVADO' | 'CANCELADO'
  vencido: boolean
  tipoPrestamo?: string
  fechaDevolucionEstimada?: string
  ejemplar?: { libro?: { titulo?: string }; codigo_ejemplar?: string }
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
}

interface Biblioteca {
  id_biblioteca: number
  nombre: string
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([fetchBibliotecas(), fetchDatosUsuario()])
})

// ─── Bibliotecas ──────────────────────────────────────────────────────────────
const bibliotecas = ref<Biblioteca[]>([])
const selectedBibliotecaId = ref<number | null>(null)
// Cuando cambia la biblioteca, refrescar certificados con ese filtro
watch(selectedBibliotecaId, (id) => {
  if (id && auth.user?.id) fetchCertificados(auth.user.id, id)
})


async function fetchBibliotecas() {
  try {
    const { data } = await api.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch { bibliotecas.value = [] }
}

// ─── Datos del usuario (sanciones + préstamos) ─────────────────────────────
const loadingDatos = ref(false)
const estadoSancion = ref<EstadoSancion | null>(null)
const prestamos = ref<Prestamo[]>([])
const certificados = ref<Certificado[]>([])

async function fetchDatosUsuario() {
  if (!auth.user?.id) return
  loadingDatos.value = true
  try {
    const [sancionRes, prestamosRes] = await Promise.all([
      api.get(`/sanciones/usuario/${auth.user.id}/estado`),
      api.get('/prestamos/mis-prestamos'),
    ])
    estadoSancion.value = sancionRes.data.data ?? sancionRes.data
    prestamos.value = prestamosRes.data.data ?? []
    await fetchCertificados(auth.user.id, selectedBibliotecaId.value ?? undefined)
  } catch (e: unknown) {
    ui.toast.error('Error', 'No se pudo verificar tu estado. Intenta de nuevo.')
  } finally {
    loadingDatos.value = false
  }
}

async function fetchCertificados(userId: number, bibliotecaId?: number | null) {
  try {
    const params: Record<string, unknown> = {}
    if (bibliotecaId) params.bibliotecaId = bibliotecaId
    const { data } = await api.get(`/certificados/usuario/${userId}`, { params })
    certificados.value = data.data ?? []
  } catch { certificados.value = [] }
}

// ─── Computed: estados de bloqueo ─────────────────────────────────────────────
const tieneSuspension = computed(() => estadoSancion.value?.tieneSuspensionVigente ?? false)
const tieneDeuda = computed(() => estadoSancion.value?.tieneDeudaPendiente ?? false)

const prestamosActivos = computed(() =>
  prestamos.value.filter(p =>
    p.estadoPrestamo === 'ACTIVO' || p.estadoPrestamo === 'RENOVADO'
  )
)
const tienePrestamosPendientes = computed(() => prestamosActivos.value.length > 0)

const tieneVigente = computed(() =>
  certificados.value.some(c => c.estadoCertificado === 'VIGENTE')
)

// Razón por la que no puede solicitar
const bloqueoPrincipal = computed<string | null>(() => {
  if (tieneSuspension.value)
    return `Tu cuenta tiene suspensión activa${estadoSancion.value?.fechaFinSuspensionMasProxima ? ` hasta el ${formatDate(estadoSancion.value.fechaFinSuspensionMasProxima)}` : ''}.`
  if (tienePrestamosPendientes.value)
    return `Tienes ${prestamosActivos.value.length} préstamo(s) activo(s) o renovado(s) sin devolver.`
  if (!selectedBibliotecaId.value)
    return 'Selecciona la biblioteca para la que solicitas el certificado.'
  if (tieneVigente.value)
    return 'Ya tienes un certificado vigente para esta biblioteca.'
  return null
})

const puedeSOlicitar = computed(() => !bloqueoPrincipal.value && !loadingDatos.value)

// ─── Solicitar certificado ────────────────────────────────────────────────────
const diasValidez = ref(2)
const solicitando = ref(false)
const certGenerado = ref<Certificado | null>(null)
const solicitudError = ref<string | null>(null)

async function solicitarCertificado() {
  if (!puedeSOlicitar.value) return
  solicitando.value = true
  solicitudError.value = null
  certGenerado.value = null
  try {
    const payload: Record<string, unknown> = {
      usuarioId: auth.user!.id,
      bibliotecaId: selectedBibliotecaId.value,
      diasValidez: diasValidez.value,
    }
    const { data } = await api.post('/certificados', payload)
    if (data.success) {
      certGenerado.value = data.data
      ui.toast.success('Solicitud enviada', 'Tu solicitud fue enviada al bibliotecario. Recibirás una notificación cuando esté listo.')
      await fetchCertificados(auth.user!.id, selectedBibliotecaId.value)
    } else {
      solicitudError.value = data.message ?? 'No se pudo procesar la solicitud'
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

function resetSolicitud() {
  certGenerado.value = null
  solicitudError.value = null
  fetchDatosUsuario()
}

// ─── Modal certificados + PDF viewer + Imprimir ────────────────────────────
const showModal = ref(false)
const pdfViewerShow = ref(false)
const pdfViewerCertId = ref<number | null>(null)
const printCert = ref<Certificado | null>(null)
const showPrintPreview = ref(false)

function abrirVisor(id: number) {
  pdfViewerCertId.value = id
  pdfViewerShow.value = true
}

function abrirImprimir(cert: Certificado) {
  printCert.value = cert
  showPrintPreview.value = true
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function estadoCertClasses(estado: string) {
  const m: Record<string, string> = {
    VIGENTE: 'bg-emerald-100 text-emerald-700',
    VENCIDO: 'bg-amber-100 text-amber-700',
    ANULADO: 'bg-red-100 text-red-700',
  }
  return m[estado] ?? 'bg-slate-100 text-slate-600'
}

function estadoPrestamoClasses(p: Prestamo) {
  if (p.vencido) return 'bg-red-100 text-red-700'
  const m: Record<string, string> = {
    ACTIVO: 'bg-emerald-100 text-emerald-700',
    RENOVADO: 'bg-blue-100 text-blue-700',
    VENCIDO: 'bg-red-100 text-red-700',
    DEVUELTO: 'bg-slate-100 text-slate-600',
    CANCELADO: 'bg-slate-100 text-slate-500',
  }
  return m[p.estadoPrestamo] ?? 'bg-slate-100 text-slate-600'
}

// QR para el cert generado
const qrUrl = computed(() => {
  if (!certGenerado.value?.codigo_verificacion) return ''
  const url = `${window.location.origin}/certificados?tab=validar&codigo=${certGenerado.value.codigo_verificacion}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&ecc=M&margin=2`
})
</script>

<template>
  <div class="space-y-6">

    <!-- Subcomponentes globales -->
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false" />

    <CertificadoPreview v-if="showPrintPreview && printCert" :certificado="printCert" :nombre-usuario="auth.displayName"
      :ci-usuario="String(auth.user?.persona?.ci ?? '')" @close="showPrintPreview = false" />

    <CertificadosModal :show="showModal" :certificados="certificados" titulo="Mis certificados" :can-anular="false"
      @close="showModal = false" @ver-pdf="abrirVisor" @imprimir="abrirImprimir" />

    <!-- ══ PASO 1: Selección de biblioteca ══ -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <label class="block text-xs font-medium text-slate-600 mb-1.5">
        Biblioteca para el certificado <span class="text-red-400">*</span>
      </label>
      <select v-model="selectedBibliotecaId"
        class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
        <option :value="null">Seleccionar biblioteca...</option>
        <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">{{ b.nombre }}</option>
      </select>
    </div>

    <!-- ══ Loading ══ -->
    <div v-if="loadingDatos" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-16 bg-slate-100 rounded-2xl animate-pulse" />
    </div>

    <template v-else>

      <!-- ══ BANNER SUSPENSIÓN (bloqueo duro) ══ -->
      <div v-if="tieneSuspension" class="rounded-2xl p-5 border border-red-200 bg-red-50 flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
          </svg>
        </div>
        <div class="flex-1">
          <p class="font-bold text-red-800 text-sm">Cuenta suspendida</p>
          <p class="text-sm text-red-600 mt-0.5">
            Tu cuenta tiene una suspensión activa.
            <span v-if="estadoSancion?.fechaFinSuspensionMasProxima">
              Podrás solicitar el certificado a partir del <strong>{{
                formatDate(estadoSancion.fechaFinSuspensionMasProxima) }}</strong>.
            </span>
          </p>
          <p v-if="estadoSancion?.tieneDeudaPendiente" class="text-xs text-red-500 mt-1">
            También tienes multas pendientes de pago. Acércate a la biblioteca para regularizar tu situación.
          </p>
        </div>
      </div>

      <!-- ══ BANNER DEUDA PENDIENTE (advertencia, no bloquea si no hay suspensión) ══ -->
      <div v-else-if="tieneDeuda" class="rounded-2xl p-4 border border-amber-200 bg-amber-50 flex items-center gap-3">
        <svg class="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-sm text-amber-700">
          Tienes <strong>{{ estadoSancion?.totalSancionesActivas }}</strong> multa(s) pendiente(s) de pago.
          Acércate a la biblioteca para regularizar. Esta situación podría impedir la emisión del certificado.
        </p>
      </div>

      <!-- ══ BANNER ESTADO PRÉSTAMOS ══ -->
      <div :class="[
        'rounded-2xl p-5 border flex items-center gap-4',
        tienePrestamosPendientes ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
      ]">
        <div :class="[
          'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0',
          tienePrestamosPendientes ? 'bg-red-100' : 'bg-emerald-100'
        ]">
          <svg v-if="tienePrestamosPendientes" class="w-7 h-7 text-red-500" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <svg v-else class="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div class="flex-1">
          <p :class="['font-bold text-base', tienePrestamosPendientes ? 'text-red-800' : 'text-emerald-800']">
            {{ tienePrestamosPendientes
              ? `Tienes ${prestamosActivos.length} préstamo(s) activo(s) sin devolver`
              : 'No tienes préstamos bibliográficos pendientes'
            }}
          </p>
          <p :class="['text-sm mt-0.5', tienePrestamosPendientes ? 'text-red-600' : 'text-emerald-600']">
            {{ tienePrestamosPendientes
              ? 'Debes devolver todos tus libros antes de solicitar el certificado'
              : 'Tu historial de préstamos está al día'
            }}
          </p>
        </div>
        <span :class="[
          'text-xs font-bold px-3 py-1 rounded-full flex-shrink-0',
          tienePrestamosPendientes ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
        ]">
          {{ tienePrestamosPendientes ? '❌ Pendientes' : '✅ Al día' }}
        </span>
      </div>

      <!-- ══ LISTA DE PRÉSTAMOS PENDIENTES ══ -->
      <div v-if="tienePrestamosPendientes"
        class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 class="font-semibold text-slate-800 text-sm">Libros a devolver</h3>
          <span class="ml-auto text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{{
            prestamosActivos.length }}</span>
        </div>
        <div class="divide-y divide-slate-50">
          <div v-for="p in prestamosActivos" :key="p.id_prestamo"
            class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
            <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-slate-800 text-sm truncate">
                {{ p.ejemplar?.libro?.titulo ?? 'Libro desconocido' }}
              </p>
              <p class="text-xs text-slate-500 mt-0.5">
                Ejemplar: {{ p.ejemplar?.codigo_ejemplar ?? '—' }}
                <span v-if="p.fechaDevolucionEstimada"> · Vence: {{ formatDate(p.fechaDevolucionEstimada) }}</span>
                <span v-if="p.vencido" class="text-red-500 font-medium"> · ¡VENCIDO!</span>
              </p>
            </div>
            <span :class="['text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0', estadoPrestamoClasses(p)]">
              {{ p.vencido ? 'VENCIDO' : p.estadoPrestamo }}
            </span>
          </div>
        </div>
      </div>

      <!-- ══ MIS CERTIFICADOS (si tiene) ══ -->
      <div v-if="certificados.length > 0"
        class="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
        <div class="flex items-center gap-2.5 px-5 py-4 border-b border-indigo-100 bg-indigo-50/50">
          <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="font-semibold text-slate-800 text-sm">Mis certificados</h3>
          <div class="ml-auto flex items-center gap-2">
            <span v-if="tieneVigente"
              class="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {{certificados.filter(c => c.estadoCertificado === 'VIGENTE').length}} vigente(s)
            </span>
            <button @click="showModal = true"
              class="flex items-center gap-1 px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver todos
            </button>
          </div>
        </div>
        <!-- Preview del más reciente -->
        <div class="px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono text-indigo-600 truncate">{{ certificados[0].codigo_verificacion }}</p>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ certificados[0].bibliotecaNombre }} · Vence: {{ formatDate(certificados[0].fechaVencimiento) }}
              </p>
            </div>
            <span
              :class="['text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0', estadoCertClasses(certificados[0].estadoCertificado)]">
              {{ certificados[0].estadoCertificado }}
            </span>
            <!-- Botones de descarga/impresión -->
            <div class="flex gap-1.5 flex-shrink-0">
              <button @click="abrirVisor(certificados[0].id_certificado)"
                class="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
                title="Descargar PDF del backend">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button @click="abrirImprimir(certificados[0])"
                class="text-xs px-2 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                title="Imprimir vista del sistema">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
            </div>
          </div>
          <p v-if="certificados.length > 1" class="text-xs text-slate-400 mt-2 text-center">
            y {{ certificados.length - 1 }} más...
          </p>
        </div>
      </div>

      <!-- ══ PANEL DE SOLICITUD ══ -->
      <div v-if="!certGenerado" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="font-semibold text-slate-800 text-sm">Solicitar Certificado de No Deuda</h3>
        </div>
        <div class="p-5 space-y-4">

          <!-- Descripción del flujo -->
          <div class="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm text-blue-700">
              Al solicitar, el bibliotecario recibirá una <strong>notificación</strong> para procesar y emitir tu
              certificado.
              Una vez generado, recibirás una notificación para descargarlo.
            </p>
          </div>

          <!-- Días de validez -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Días de validez solicitados</label>
            <div class="flex items-center gap-3">
              <button @click="diasValidez = Math.max(1, diasValidez - 1)"
                class="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                </svg>
              </button>
              <span class="text-lg font-bold text-slate-800 w-8 text-center">{{ diasValidez }}</span>
              <button @click="diasValidez = Math.min(30, diasValidez + 1)"
                class="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <span class="text-xs text-slate-400">días (máx. 30)</span>
            </div>
          </div>

          <!-- Error -->
          <div v-if="solicitudError"
            class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ solicitudError }}
          </div>

          <!-- Botón solicitar -->
          <button @click="solicitarCertificado" :disabled="!puedeSOlicitar || solicitando" :class="['w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            puedeSOlicitar && !solicitando
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
            <svg v-if="solicitando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {{ solicitando ? 'Enviando solicitud...' : bloqueoPrincipal ? bloqueoPrincipal : 'Solicitar Certificado' }}
          </button>

          <!-- Explicación del bloqueo si aplica -->
          <p v-if="bloqueoPrincipal && !solicitando" class="text-xs text-center text-slate-500">
            {{ bloqueoPrincipal }}
          </p>
        </div>
      </div>

      <!-- ══ SOLICITUD ENVIADA ══ -->
      <Transition name="fade">
        <div v-if="certGenerado" class="space-y-4">

          <!-- Banner éxito -->
          <div class="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p class="font-semibold text-emerald-800 text-sm">¡Certificado generado!</p>
              <p class="text-xs text-emerald-600 mt-0.5">Tu certificado de no deuda ha sido emitido y está listo para
                descargar.</p>
            </div>
          </div>

          <!-- Previsualización del certificado -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="font-semibold text-slate-800 text-sm">Vista previa del certificado</h3>
              </div>
              <span
                :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoCertClasses(certGenerado.estadoCertificado)]">
                {{ certGenerado.estadoCertificado }}
              </span>
            </div>

            <!-- Documento previsualización -->
            <div class="p-6">
              <div class="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50">
                <div class="text-center mb-6 pb-4 border-b border-slate-200">
                  <div class="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto mb-2">
                    <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h2 class="text-lg font-bold text-slate-900 uppercase tracking-wide">Universidad Mayor de San Andrés
                  </h2>
                  <p class="text-sm text-slate-600">Facultad de Humanidades y Ciencias de la Educación</p>
                  <p class="text-xs text-slate-400 mt-0.5">Sistema de Gestión Bibliográfica – SIGEB</p>
                </div>
                <div class="text-center mb-6">
                  <h3 class="text-xl font-bold text-indigo-700 uppercase tracking-widest">Certificado de No Deuda</h3>
                  <p class="text-xs text-slate-500 mt-1">Bibliográfica</p>
                </div>
                <div class="text-sm text-slate-700 space-y-3 mb-6 text-center">
                  <p>
                    Se certifica que el/la estudiante
                    <strong class="text-slate-900 capitalize">{{ auth.displayName }}</strong>
                    con CI: <strong class="text-slate-900">{{ auth.user?.persona?.ci }}</strong>
                    no registra préstamos bibliográficos pendientes en el sistema.
                  </p>
                </div>
                <!-- Datos + QR -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div class="sm:col-span-2 grid grid-cols-1 gap-3 text-xs">
                    <div class="bg-white rounded-xl border border-slate-200 p-3">
                      <p class="text-slate-400 mb-0.5">Fecha de Emisión</p>
                      <p class="font-semibold text-slate-800">{{ formatDateTime(certGenerado.fechaEmision) }}</p>
                    </div>
                    <div class="bg-white rounded-xl border border-slate-200 p-3">
                      <p class="text-slate-400 mb-0.5">Fecha de Vencimiento</p>
                      <p class="font-semibold text-slate-800">{{ formatDateTime(certGenerado.fechaVencimiento) }}</p>
                    </div>
                    <div class="bg-white rounded-xl border border-slate-200 p-3">
                      <p class="text-slate-400 mb-0.5">Código de Verificación</p>
                      <p class="font-mono font-semibold text-indigo-700 text-xs break-all">{{
                        certGenerado.codigo_verificacion }}</p>
                    </div>
                  </div>
                  <div
                    class="flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 p-3 gap-2">
                    <p class="text-xs text-slate-400 font-medium">Verificar autenticidad</p>
                    <img v-if="qrUrl" :src="qrUrl" alt="QR" class="w-32 h-32 rounded-lg" loading="lazy" />
                    <div v-else class="w-32 h-32 bg-slate-100 rounded-lg animate-pulse" />
                    <p class="text-xs text-slate-400 text-center leading-tight">Escanea para validar</p>
                  </div>
                </div>
                <div class="flex justify-end pt-4 border-t border-slate-200">
                  <div class="text-center">
                    <div class="w-28 border-b border-slate-400 mb-1 mx-auto" />
                    <p class="text-xs text-slate-500">Firma del Bibliotecario</p>
                    <p class="text-xs text-slate-400">Sello Institucional</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Acciones de descarga / impresión -->
            <div class="px-5 pb-5 flex flex-col sm:flex-row gap-3">
              <!-- PDF del backend -->
              <button @click="abrirVisor(certGenerado.id_certificado)"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-[0.98]">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar PDF oficial
              </button>

              <!-- Imprimir vista del sistema -->
              <button @click="abrirImprimir(certGenerado)"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir vista web
              </button>

              <!-- Nueva solicitud -->
              <button @click="resetSolicitud"
                class="sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Nueva solicitud
              </button>
            </div>
          </div>
        </div>
      </Transition>

    </template>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>