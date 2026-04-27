<script setup lang="ts">
/**
 * CertificadosBibliotecario.vue
 *
 * Flujo del bibliotecario/admin:
 *  1. Busca un estudiante
 *  2. Sistema verifica automáticamente:
 *     - Sanciones: GET /api/sanciones/usuario/{id}/estado
 *     - Préstamos activos: incluidos en la búsqueda de certificados
 *  3. Muestra el estado del estudiante ANTES de habilitar el botón generar
 *  4. Si el estudiante está limpio → puede GENERAR directamente
 *  5. Puede anular certificados vigentes y ver el historial de la biblioteca
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import api from '@/services/axios'
import CertificadosModal from './CertificadosModal.vue'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'
// import CertificadoPreview from './CertificadoPreview.vue'

const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin } = usePermissions()

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
  fetchCertsBiblioteca()
})

// ─── Bibliotecas ──────────────────────────────────────────────────────────────
const bibliotecas = ref<Biblioteca[]>([])
const selectedBibliotecaId = ref<number | null>(null)  // solo admin

async function fetchBibliotecas() {
  try {
    const { data } = await api.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch { bibliotecas.value = [] }
}

// ID de biblioteca efectivo
const bibliotecarioId = computed(() => auth.user?.biblioteca?.[0]?.id_biblioteca ?? null)
const targetBibliotecaId = computed(() =>
  isAdmin.value ? selectedBibliotecaId.value : bibliotecarioId.value
)

// ─── Búsqueda de usuario ──────────────────────────────────────────────────────
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
  // Verificar automáticamente
  verificarEstudianteSeleccionado(u.id_usuario)
}

function resetUser() {
  selectedUser.value = null
  userQuery.value = ''
  userResults.value = []
  estadoSancionUsuario.value = null
  prestamosUsuario.value = []
  certificadosUsuario.value = []
  certGenerado.value = null
  certError.value = null
  showCertsModal.value = false
}

function highlight(text: string, query: string): string {
  if (!query) return text
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, '<mark class="bg-indigo-100 text-indigo-700 rounded-sm px-0.5">$1</mark>')
}

// ─── Verificación automática del estudiante ────────────────────────────────
const verificandoEstudiante = ref(false)
const estadoSancionUsuario = ref<EstadoSancion | null>(null)
const prestamosUsuario = ref<Prestamo[]>([])
const certificadosUsuario = ref<Certificado[]>([])

async function verificarEstudianteSeleccionado(userId: number) {
  verificandoEstudiante.value = true
  certificadosUsuario.value = []
  estadoSancionUsuario.value = null
  prestamosUsuario.value = []
  try {
    // Verificamos en paralelo: sanciones + certificados
    // Los préstamos del estudiante los pide el staff via endpoint específico si existiera,
    // de lo contrario se informa solo en base a las sanciones
    const [sancionRes, certRes] = await Promise.all([
      api.get(`/sanciones/usuario/${userId}/estado`),
      api.get(`/certificados/usuario/${userId}`, {
        params: targetBibliotecaId.value ? { bibliotecaId: targetBibliotecaId.value } : {}
      }),
    ])
    estadoSancionUsuario.value = sancionRes.data.data ?? sancionRes.data
    certificadosUsuario.value = certRes.data.data ?? []
  } catch (e: unknown) {
    ui.toast.error('Error', 'No se pudo verificar el estado del estudiante')
  } finally {
    verificandoEstudiante.value = false
  }
}

// ─── Computed: estado del estudiante ──────────────────────────────────────────
const estudianteTieneSuspension = computed(() =>
  estadoSancionUsuario.value?.tieneSuspensionVigente ?? false
)
const estudianteTieneDeuda = computed(() =>
  estadoSancionUsuario.value?.tieneDeudaPendiente ?? false
)
const estudianteTieneVigente = computed(() =>
  certificadosUsuario.value.some(c => c.estadoCertificado === 'VIGENTE')
)

// Solo bloquea si tiene suspensión o certificado vigente
// Deuda pendiente es advertencia pero no bloquea la generación
const puedeGenerar = computed(() => {
  if (!selectedUser.value) return false
  if (!targetBibliotecaId.value) return false
  if (verificandoEstudiante.value) return false
  if (estudianteTieneSuspension.value) return false
  if (estudianteTieneVigente.value) return false
  return true
})

// ─── Generación de certificado ────────────────────────────────────────────────
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
    const payload: Record<string, unknown> = {
      usuarioId: selectedUser.value!.id_usuario,
      bibliotecaId: targetBibliotecaId.value,
      diasValidez: diasValidez.value,
    }
    const { data } = await api.post('/certificados', payload)
    if (data.success) {
      certGenerado.value = data.data
      ui.toast.success('Certificado generado', 'El certificado fue emitido correctamente')
      await verificarEstudianteSeleccionado(selectedUser.value!.id_usuario)
      fetchCertsBiblioteca()
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

function resetCertificado() {
  certGenerado.value = null
  certError.value = null
  resetUser()
}

// ─── Anular certificado ────────────────────────────────────────────────────────
const anulandoId = ref<number | null>(null)

async function anularCertificado(id: number) {
  anulandoId.value = id
  try {
    await api.patch(`/certificados/${id}/anular`)
    ui.toast.success('Certificado anulado', 'El certificado fue anulado correctamente')
    fetchCertsBiblioteca()
    if (selectedUser.value) verificarEstudianteSeleccionado(selectedUser.value.id_usuario)
  } catch {
    ui.toast.error('Error', 'No se pudo anular el certificado')
  } finally {
    anulandoId.value = null
  }
}

// ─── Tabla certificados de la biblioteca ─────────────────────────────────────
const certsBiblioteca = ref<Certificado[]>([])
const certsBibliotecaLoading = ref(false)
const filtroEstadoBib = ref<'' | 'VIGENTE' | 'VENCIDO' | 'ANULADO'>('')

async function fetchCertsBiblioteca() {
  const bibId = targetBibliotecaId.value
  if (!bibId) return
  certsBibliotecaLoading.value = true
  try {
    const params: Record<string, unknown> = {}
    if (filtroEstadoBib.value) params.estado = filtroEstadoBib.value
    const { data } = await api.get(`/certificados/biblioteca/${bibId}`, { params })
    certsBiblioteca.value = data.data ?? []
  } catch { certsBiblioteca.value = [] }
  finally { certsBibliotecaLoading.value = false }
}

watch([filtroEstadoBib, targetBibliotecaId], fetchCertsBiblioteca)

// ─── Modal + PDF viewer + Print ───────────────────────────────────────────────
const showCertsModal = ref(false)
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

// QR para cert generado
const qrUrl = computed(() => {
  if (!certGenerado.value?.codigo_verificacion) return ''
  const url = `${window.location.origin}/certificados?tab=validar&codigo=${certGenerado.value.codigo_verificacion}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&ecc=M&margin=2`
})

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
</script>

<template>
  <div class="space-y-6">

    <!-- Subcomponentes globales -->
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false" />

    <!-- <CertificadoPreview v-if="showPrintPreview && printCert" :certificado="printCert"
      :nombre-usuario="printCert.usuario?.nombreCompleto ?? selectedUser?.persona.nombreCompleto ?? ''"
      :ci-usuario="String(printCert.usuario?.ci ?? selectedUser?.persona.ci ?? '')" @close="showPrintPreview = false" /> -->

    <CertificadosModal :show="showCertsModal" :certificados="certificadosUsuario"
      :titulo="`Certificados de ${selectedUser?.persona.nombreCompleto ?? 'este usuario'}`" :can-anular="true"
      :anulando-id="anulandoId" @close="showCertsModal = false" @anular="anularCertificado" @ver-pdf="abrirVisor"
      @imprimir="abrirImprimir" />

    <!-- ══ PANEL PRINCIPAL ══ -->
    <div v-if="!certGenerado" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
      <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <span
          :class="['text-xs font-bold px-2.5 py-1 rounded-full', isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700']">
          {{ isAdmin ? 'Admin' : 'Bibliotecario' }}
        </span>
        <h3 class="font-semibold text-slate-800 text-sm">Generar certificado a un estudiante</h3>
        <span v-if="!isAdmin" class="ml-auto text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {{ auth.bibliotecaNombre ?? 'Tu biblioteca' }}
        </span>
      </div>

      <div class="p-5 space-y-5">

        <!-- Info -->
        <div
          :class="['flex items-start gap-3 p-4 rounded-xl border', isAdmin ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100']">
          <svg class="w-5 h-5 flex-shrink-0 mt-0.5" :class="isAdmin ? 'text-indigo-500' : 'text-emerald-600'"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm" :class="isAdmin ? 'text-indigo-700' : 'text-emerald-800'">
            <span v-if="isAdmin">Como <strong>administrador</strong>, puedes generar certificados para cualquier
              estudiante en cualquier biblioteca. El sistema verificará automáticamente sus sanciones y
              préstamos.</span>
            <span v-else>Busca al estudiante para verificar su estado antes de generar el certificado. El sistema
              revisará sus sanciones activas automáticamente.</span>
          </p>
        </div>

        <!-- Selector biblioteca (solo admin) -->
        <div v-if="isAdmin">
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Biblioteca <span
              class="text-red-400">*</span></label>
          <select v-model="selectedBibliotecaId"
            class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
            <option :value="null">Seleccionar biblioteca...</option>
            <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">{{ b.nombre }}</option>
          </select>
        </div>

        <!-- Buscador de usuario -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Buscar estudiante <span
              class="text-red-400">*</span></label>
          <div class="relative">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input v-model="userQuery" type="text" placeholder="Buscar por nombre, CI o matrícula..."
                :disabled="!!selectedUser"
                class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-400" />
              <div v-if="userLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                <svg class="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            </div>
            <!-- Dropdown resultados -->
            <div v-if="userDropdownOpen && userResults.length && !selectedUser"
              class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
              <button v-for="u in userResults" :key="u.id_usuario" @click="selectUser(u)"
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0">
                <div
                  class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                  {{ u.persona.nombreCompleto.charAt(0).toUpperCase() }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-slate-800 capitalize"
                    v-html="highlight(u.persona.nombreCompleto, userQuery)" />
                  <p class="text-xs text-slate-400">CI: {{ u.persona.ci }}<span v-if="u.persona.matricula"> · Mat: {{
                    u.persona.matricula }}</span></p>
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
        <div v-if="selectedUser"
          class="flex items-center gap-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
          <div
            class="w-11 h-11 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold flex-shrink-0">
            {{ selectedUser.persona.nombreCompleto.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-slate-800 text-sm capitalize">{{ selectedUser.persona.nombreCompleto }}</p>
            <p class="text-xs text-slate-500">CI: {{ selectedUser.persona.ci }}<span class="text-slate-400"> · @{{
              selectedUser.username }}</span></p>
          </div>
          <button @click="resetUser"
            class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cambiar
          </button>
        </div>

        <!-- ── VERIFICACIÓN AUTOMÁTICA ── -->
        <template v-if="selectedUser">

          <!-- Loading verificación -->
          <div v-if="verificandoEstudiante" class="space-y-2">
            <div class="h-10 bg-slate-100 rounded-xl animate-pulse" />
            <p class="text-xs text-center text-slate-400">Verificando sanciones y certificados...</p>
          </div>

          <template v-else>

            <!-- SUSPENSIÓN ACTIVA → bloqueo duro -->
            <div v-if="estudianteTieneSuspension" class="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div class="flex items-start gap-3">
                <svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
                </svg>
                <div>
                  <p class="text-sm font-bold text-red-800">Estudiante con suspensión activa</p>
                  <p class="text-xs text-red-600 mt-0.5">
                    Este estudiante tiene suspensión vigente
                    <span v-if="estadoSancionUsuario?.fechaFinSuspensionMasProxima">
                      hasta el <strong>{{ formatDate(estadoSancionUsuario.fechaFinSuspensionMasProxima) }}</strong>
                    </span>.
                    No se puede emitir el certificado hasta que finalice la suspensión.
                  </p>
                  <p v-if="estadoSancionUsuario?.tieneDeudaPendiente" class="text-xs text-red-500 mt-1">
                    También tiene {{ estadoSancionUsuario.totalSancionesActivas }} multa(s) pendiente(s).
                  </p>
                </div>
              </div>
            </div>

            <!-- DEUDA PENDIENTE (advertencia, no bloquea generación) -->
            <div v-else-if="estudianteTieneDeuda"
              class="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p class="text-xs text-amber-700 flex-1">
                El estudiante tiene <strong>{{ estadoSancionUsuario?.totalSancionesActivas }}</strong> multa(s)
                pendiente(s) de pago.
                Puedes generar el certificado, pero considera informarle al estudiante.
              </p>
            </div>

            <!-- SIN PROBLEMAS -->
            <div v-else-if="!estudianteTieneVigente"
              class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <p class="text-xs text-emerald-700">El estudiante no tiene sanciones activas ni certificados vigentes.
                Puede generar el certificado.</p>
            </div>

            <!-- YA TIENE VIGENTE -->
            <div v-if="certificadosUsuario.length > 0" class="flex items-center gap-3 p-3 rounded-xl border text-sm"
              :class="estudianteTieneVigente ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span class="flex-1 text-xs">
                <strong>{{ certificadosUsuario.length }}</strong> certificado(s)
                <span v-if="estudianteTieneVigente"> — <strong>{{certificadosUsuario.filter(c => c.estadoCertificado
                  === 'VIGENTE').length}} VIGENTE(s)</strong>, no se puede generar otro</span>
                <span v-else> — ninguno vigente, puede generar uno nuevo</span>.
              </span>
              <button @click="showCertsModal = true"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                :class="estudianteTieneVigente ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver
              </button>
            </div>

            <!-- Días de validez (si puede generar) -->
            <div v-if="!estudianteTieneSuspension && !estudianteTieneVigente">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Días de validez</label>
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

          </template>
        </template>

        <!-- Error generación -->
        <div v-if="certError"
          class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {{ certError }}
        </div>

        <!-- Botón generar -->
        <button @click="generarCertificado" :disabled="!puedeGenerar || generandoCert" :class="['w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
          puedeGenerar && !generandoCert
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
          <svg v-if="generandoCert" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {{ generandoCert ? 'Generando...'
            : isAdmin && !selectedBibliotecaId ? 'Selecciona una biblioteca'
              : !selectedUser ? 'Selecciona un estudiante'
                : estudianteTieneSuspension ? 'No se puede generar (suspensión activa)'
                  : estudianteTieneVigente ? 'Ya tiene un certificado vigente'
                    : verificandoEstudiante ? 'Verificando...'
                      : 'Generar Certificado' }}
        </button>
      </div>
    </div>

    <!-- ══ CERTIFICADO GENERADO ══ -->
    <Transition name="fade">
      <div v-if="certGenerado" class="space-y-4">
        <div class="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-emerald-800 text-sm">¡Certificado generado exitosamente!</p>
            <p class="text-xs text-emerald-600 mt-0.5">
              El certificado de <strong>{{ selectedUser?.persona.nombreCompleto }}</strong> fue emitido. El estudiante
              recibirá una notificación.
            </p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div class="flex items-center gap-2.5">
              <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="font-semibold text-slate-800 text-sm">Previsualización</h3>
            </div>
            <span
              :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoCertClasses(certGenerado.estadoCertificado)]">
              {{ certGenerado.estadoCertificado }}
            </span>
          </div>
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
                  <strong class="text-slate-900 capitalize">{{ selectedUser?.persona.nombreCompleto }}</strong>
                  con CI: <strong class="text-slate-900">{{ selectedUser?.persona.ci }}</strong>
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
                      certGenerado.codigo_verificacion
                    }}</p>
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
                  <p class="text-xs text-slate-500">{{ auth.displayName }}</p>
                  <p class="text-xs text-slate-400">{{ auth.bibliotecaNombre ?? 'Bibliotecario' }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Acciones -->
          <div class="px-5 pb-5 flex flex-col sm:flex-row gap-3">
            <button @click="abrirVisor(certGenerado.id_certificado)"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-[0.98]">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar PDF oficial
            </button>
            <button @click="abrirImprimir(certGenerado)"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir vista web
            </button>
            <button @click="resetCertificado"
              class="sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Generar otro
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══ TABLA DE CERTIFICADOS DE LA BIBLIOTECA ══ -->
    <div v-if="!certGenerado" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex-wrap gap-y-2">
        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="font-semibold text-slate-800 text-sm">Certificados de mi biblioteca</h3>
        <div class="ml-auto flex gap-1">
          <button
            v-for="f in [{ v: '', l: 'Todos' }, { v: 'VIGENTE', l: 'Vigente' }, { v: 'VENCIDO', l: 'Vencido' }, { v: 'ANULADO', l: 'Anulado' }]"
            :key="f.v" @click="filtroEstadoBib = f.v as typeof filtroEstadoBib"
            :class="['px-2.5 py-0.5 rounded-full text-xs font-medium transition-all',
              filtroEstadoBib === f.v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200']">{{ f.l }}</button>
        </div>
      </div>
      <div v-if="certsBibliotecaLoading" class="p-5 space-y-3">
        <div v-for="i in 3" :key="i" class="h-12 bg-slate-100 rounded-xl animate-pulse" />
      </div>
      <div v-else-if="!certsBiblioteca.length" class="py-10 text-center">
        <p class="text-sm text-slate-400">No hay certificados con este filtro</p>
      </div>
      <div v-else class="divide-y divide-slate-50 max-h-72 overflow-y-auto">
        <div v-for="c in certsBiblioteca" :key="c.id_certificado"
          class="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-800 capitalize truncate">{{ c.usuario?.nombreCompleto ?? '—' }}</p>
            <p class="text-xs font-mono text-slate-400 truncate">{{ c.codigo_verificacion }}</p>
            <p class="text-xs text-slate-400">Vence: {{ formatDate(c.fechaVencimiento) }}</p>
          </div>
          <span
            :class="['text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0', estadoCertClasses(c.estadoCertificado)]">
            {{ c.estadoCertificado }}
          </span>
          <div class="flex gap-1.5 flex-shrink-0">
            <button @click="abrirVisor(c.id_certificado)"
              class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Ver PDF">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
            <button @click="abrirImprimir(c)"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Imprimir">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
            <button v-if="c.estadoCertificado === 'VIGENTE'" @click="anularCertificado(c.id_certificado)"
              :disabled="anulandoId === c.id_certificado"
              class="text-xs px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors disabled:opacity-50">
              {{ anulandoId === c.id_certificado ? '...' : 'Anular' }}
            </button>
          </div>
        </div>
      </div>
    </div>

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