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
import { razonCertificadoService } from '@/services/razon-certificado.service'
import api from '@/services/axios'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'

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
interface RazonCertificado {
  idRazon?: number
  id?: number
  nombre: string
  descripcion?: string
  requisitos?: string[]
  activo?: boolean
}

function razonId(razon: RazonCertificado): number {
  return razon.idRazon ?? razon.id ?? 0
}

const razones = ref<RazonCertificado[]>([])
const razonesLoading = ref(false)
const selectedRazonId = ref<number | null>(null)

const selectedRazon = computed(() =>
  razones.value.find(r => razonId(r) === selectedRazonId.value) ?? null
)
// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  if (isAdmin.value) fetchBibliotecas()
  else
    cargarRazones(auth.user?.biblioteca?.[0]?.id_biblioteca ?? null)
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

watch(targetBibliotecaId, async (bibliotecaId) => {
  cargarRazones(bibliotecaId);
})
const cargarRazones = async(bibliotecaId: number|null) =>{
  razones.value = []
  selectedRazonId.value = null

  if (!bibliotecaId) return

  razonesLoading.value = true

  try {
    const data = await razonCertificadoService.getByBiblioteca(bibliotecaId)
    const resultado: RazonCertificado[] = data?.data ?? data ?? []
    razones.value = resultado.filter(r => r.activo !== false)
  } catch {
    razones.value = []
    ui.toast.error(
      'Error',
      'No se pudieron cargar las razones del certificado'
    )
  } finally {
    razonesLoading.value = false
  }
}
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
  selectedRazonId.value = null
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
      api.get(`/sanciones/usuario/${userId}/estado`, {
        params: {
          bibliotecaId: targetBibliotecaId.value ?  targetBibliotecaId.value  : bibliotecarioId
        }
      }),
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
  if (!selectedRazonId.value) return false
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
      razonCertificadoId: selectedRazonId.value,
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
// const printCert = ref<Certificado | null>(null)
// const showPrintPreview = ref(false)

function abrirVisor(id: number) {
  pdfViewerCertId.value = id
  pdfViewerShow.value = true
}

// function abrirImprimir(cert: Certificado) {
//   printCert.value = cert
//   showPrintPreview.value = true
// }


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
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false" tipo="certificado"/>

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

        
        <!-- Selector de razón del certificado -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">
            Razón del certificado
            <span class="text-red-400">*</span>
          </label>

          <div
            v-if="!targetBibliotecaId"
            class="w-full h-10 border border-slate-200 rounded-xl bg-slate-50 flex items-center px-3"
          >
            <span class="text-xs text-slate-400">
              Primero selecciona una biblioteca
            </span>
          </div>

          <div
            v-else-if="razonesLoading"
            class="w-full h-10 border border-slate-200 rounded-xl bg-slate-100 animate-pulse"
          />

          <div
            v-else-if="!razones.length"
            class="w-full h-10 border border-amber-200 rounded-xl bg-amber-50 flex items-center px-3"
          >
            <span class="text-xs text-amber-600">
              No hay razones configuradas para esta biblioteca
            </span>
          </div>

          <select
            v-else
            v-model.number="selectedRazonId"
            class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
          >
            <option :value="null" disabled>
              Seleccionar razón del certificado...
            </option>

            <option
              v-for="razon in razones"
              :key="razonId(razon)"
              :value="razonId(razon)"
            >
              {{ razon.nombre }}
            </option>
          </select>

          <p
            v-if="selectedRazon?.descripcion"
            class="text-xs text-slate-500 mt-1.5"
          >
            {{ selectedRazon.descripcion }}
          </p>
        </div>

        <!-- Buscador de usuario -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Buscar Lectores <span
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

        <!-- Confirmación -->
        <div class="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M5 13l4 4L19 6"
              />
            </svg>
          </div>

          <div>
            <p class="font-semibold text-emerald-800 text-sm">
              ¡Certificado generado exitosamente!
            </p>
            <p class="text-xs text-emerald-600 mt-0.5">
              El certificado de
              <strong>{{ selectedUser?.persona.nombreCompleto }}</strong>
              fue emitido correctamente.
            </p>
          </div>
        </div>

        <!-- Información del certificado -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 class="font-semibold text-slate-800 text-sm">
                Certificado oficial
              </h3>
              <p class="text-xs text-slate-400 mt-1">
                Certificado #{{ certGenerado.id_certificado }}
              </p>
            </div>

            <span
              :class="[
                'text-xs font-bold px-2.5 py-1 rounded-full',
                estadoCertClasses(certGenerado.estadoCertificado)
              ]"
            >
              {{ certGenerado.estadoCertificado }}
            </span>
          </div>

          <div class="p-5 space-y-3">

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p class="text-xs text-slate-400 mb-1">Estudiante</p>
                <p class="text-sm font-semibold text-slate-800">
                  {{ selectedUser?.persona.nombreCompleto }}
                </p>
              </div>

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p class="text-xs text-slate-400 mb-1">Cédula de identidad</p>
                <p class="text-sm font-semibold text-slate-800">
                  {{ selectedUser?.persona.ci }}
                </p>
              </div>

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p class="text-xs text-slate-400 mb-1">Fecha de emisión</p>
                <p class="text-sm font-semibold text-slate-800">
                  {{ formatDateTime(certGenerado.fechaEmision) }}
                </p>
              </div>

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p class="text-xs text-slate-400 mb-1">Fecha de vencimiento</p>
                <p class="text-sm font-semibold text-slate-800">
                  {{ formatDateTime(certGenerado.fechaVencimiento) }}
                </p>
              </div>

            </div>

            <div class="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <p class="text-xs text-indigo-500 mb-1">
                Código de verificación
              </p>
              <p class="font-mono text-sm font-semibold text-indigo-700 break-all">
                {{ certGenerado.codigo_verificacion }}
              </p>
            </div>

            <p class="text-xs text-slate-500">
              El documento PDF será obtenido directamente del backend para garantizar
              que la descarga corresponda al certificado oficial emitido.
            </p>

          </div>

          <!-- Acciones -->
          <div class="px-5 pb-5 flex flex-col sm:flex-row gap-3">

            <button
              @click="abrirVisor(certGenerado.id_certificado)"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a2 2 0 01.707.293l5.414 5.414A2 2 0 0120 9.414V19a2 2 0 01-2 2z"
                />
              </svg>
              Ver / descargar PDF oficial
            </button>

            <button
              @click="resetCertificado"
              class="sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Generar otro
            </button>

          </div>
        </div>
      </div>
    </Transition>

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