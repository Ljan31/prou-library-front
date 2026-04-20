<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import api from '@/services/axios'
import CertificadosModal from './CertificadosModal.vue'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'

const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin, isBibliotecario, isEstudiante } = usePermissions()

// ─── Types ────────────────────────────────────────────────────────────────────
interface UsuarioCert {
  id_usuario: number
  username: string
  nombreCompleto: string
  email?: string
  ci: number | string
}

interface Certificado {
  id_certificado: number
  fechaEmision: string
  fechaVencimiento: string
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  urlDescarga: string
  pdf_generado?: string
  bibliotecaId?: number
  bibliotecaNombre?: string
  usuario?: UsuarioCert
  bibliotecario?: UsuarioCert
}

interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'DEVUELTO' | 'VENCIDO' | 'RENOVADO'
  fechaDevolucionEstimada?: string
  fechaDevolucionReal?: string
  ejemplar?: { libro?: { titulo?: string }; codigo_ejemplar?: string }
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
onMounted(async () => {
  if (isEstudiante.value) {
    await fetchPrestamos()
    if (auth.user?.id) fetchCertificadosUsuario(auth.user.id)
  }
  if (isBibliotecario.value) fetchCertificadosBiblioteca()
  if (isAdmin.value || isEstudiante.value) fetchBibliotecas()
})

// ─── Bibliotecas ──────────────────────────────────────────────────────────────
const bibliotecas = ref<Biblioteca[]>([])
const selectedBibliotecaId = ref<number | null>(null)

const bibliotecarioId = computed(() => auth.user?.biblioteca?.[0]?.id_biblioteca ?? null)
const targetBibliotecaId = computed(() =>
  isBibliotecario.value ? bibliotecarioId.value : selectedBibliotecaId.value
)

async function fetchBibliotecas() {
  try {
    const { data } = await api.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch { bibliotecas.value = [] }
}

// ─── Préstamos (ESTUDIANTE) ───────────────────────────────────────────────────
const prestamos = ref<Prestamo[]>([])
const prestamosLoading = ref(false)
const prestamosError = ref<string | null>(null)

async function fetchPrestamos() {
  prestamosLoading.value = true
  prestamosError.value = null
  try {
    const { data } = await api.get('/prestamos/mis-prestamos')
    prestamos.value = data.data ?? []
  } catch (e: unknown) {
    prestamosError.value = e instanceof Error ? e.message : 'No se pudieron cargar los préstamos'
  } finally {
    prestamosLoading.value = false
  }
}

const tieneDeuda = computed(() => prestamos.value.some(p => p.estadoPrestamo !== 'DEVUELTO'))
const pendientes = computed(() => prestamos.value.filter(p => p.estadoPrestamo !== 'DEVUELTO'))

// ─── Certificados del usuario ─────────────────────────────────────────────────
const certificadosUsuario = ref<Certificado[]>([])
const certificadosLoading = ref(false)

// Solo bloquea si tiene alguno VIGENTE
const tieneVigente = computed(() => certificadosUsuario.value.some(c => c.estadoCertificado === 'VIGENTE'))

async function fetchCertificadosUsuario(userId: number, bibliotecaId?: number) {
  certificadosLoading.value = true
  try {
    const params: Record<string, unknown> = {}
    if (bibliotecaId) params.bibliotecaId = bibliotecaId
    const { data } = await api.get(`/certificados/usuario/${userId}`, { params })
    certificadosUsuario.value = data.data ?? []
  } catch { certificadosUsuario.value = [] }
  finally { certificadosLoading.value = false }
}

// ─── Certificados de la biblioteca (BIBLIOTECARIO) ────────────────────────────
const certsBiblioteca = ref<Certificado[]>([])
const certsBibliotecaLoading = ref(false)
const filtroEstadoBib = ref<'' | 'VIGENTE' | 'VENCIDO' | 'ANULADO'>('')

async function fetchCertificadosBiblioteca() {
  if (!bibliotecarioId.value) return
  certsBibliotecaLoading.value = true
  try {
    const params: Record<string, unknown> = {}
    if (filtroEstadoBib.value) params.estado = filtroEstadoBib.value
    const { data } = await api.get(`/certificados/biblioteca/${bibliotecarioId.value}`, { params })
    certsBiblioteca.value = data.data ?? []
  } catch { certsBiblioteca.value = [] }
  finally { certsBibliotecaLoading.value = false }
}

watch(filtroEstadoBib, fetchCertificadosBiblioteca)

// ─── Búsqueda de usuario (ADMIN / BIBLIOTECARIO) ──────────────────────────────
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
  certificadosUsuario.value = []
  const bibId = isBibliotecario.value ? (bibliotecarioId.value ?? undefined) : undefined
  fetchCertificadosUsuario(u.id_usuario, bibId)
}

function resetUserSearch() {
  selectedUser.value = null
  userQuery.value = ''
  userResults.value = []
  certGenerado.value = null
  certError.value = null
  certificadosUsuario.value = []
  showCertsModal.value = false
}

function highlight(text: string, query: string): string {
  if (!query) return text
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, '<mark class="bg-indigo-100 text-indigo-700 rounded-sm px-0.5">$1</mark>')
}

// ─── Modal "Ver certificados" ─────────────────────────────────────────────────
const showCertsModal = ref(false)

// ─── PDF Viewer ───────────────────────────────────────────────────────────────
const pdfViewerShow = ref(false)
const pdfViewerCertId = ref<number | null>(null)

function abrirVisor(id: number) {
  pdfViewerCertId.value = id
  pdfViewerShow.value = true
}

// ─── Generación de certificado ────────────────────────────────────────────────
const diasValidez = ref(2)
const generandoCert = ref(false)
const certError = ref<string | null>(null)
const certGenerado = ref<Certificado | null>(null)

const targetUserId = computed(() => {
  if (isAdmin.value || isBibliotecario.value) return selectedUser.value?.id_usuario ?? null
  return auth.user?.id ?? null
})

const canGenerate = computed(() => {
  if (!targetBibliotecaId.value) return false
  if (isEstudiante.value) return !tieneDeuda.value && !tieneVigente.value
  return !!selectedUser.value && !tieneVigente.value
})

async function generarCertificado() {
  if (!canGenerate.value) return
  generandoCert.value = true
  certError.value = null
  certGenerado.value = null
  try {
    const payload: Record<string, unknown> = {
      usuarioId: targetUserId.value,
      bibliotecaId: targetBibliotecaId.value,
    }
    if (diasValidez.value) payload.diasValidez = diasValidez.value

    const { data } = await api.post('/certificados', payload)
    if (data.success) {
      certGenerado.value = data.data
      ui.toast.success('Certificado generado', 'El certificado de no deuda está listo')
      if (targetUserId.value) {
        fetchCertificadosUsuario(targetUserId.value, targetBibliotecaId.value ?? undefined)
      }
      if (isBibliotecario.value) fetchCertificadosBiblioteca()
    } else {
      certError.value = data.message ?? 'No se pudo generar el certificado'
      ui.toast.error('Error', certError.value!)
    }
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      (e instanceof Error ? e.message : 'Error al generar certificado')
    certError.value = msg
    ui.toast.error('Error', msg)
  } finally {
    generandoCert.value = false
  }
}

function resetCertificado() {
  certGenerado.value = null
  certError.value = null
  if (isEstudiante.value) {
    fetchPrestamos()
    if (auth.user?.id) fetchCertificadosUsuario(auth.user.id, selectedBibliotecaId.value ?? undefined)
  } else {
    resetUserSearch()
  }
}

// ─── Anular certificado ───────────────────────────────────────────────────────
const anulandoId = ref<number | null>(null)

async function anularCertificado(id: number) {
  anulandoId.value = id
  try {
    await api.patch(`/certificados/${id}/anular`)
    ui.toast.success('Certificado anulado', 'El certificado fue anulado correctamente')
    fetchCertificadosBiblioteca()
    if (selectedUser.value) {
      fetchCertificadosUsuario(
        selectedUser.value.id_usuario,
        isBibliotecario.value ? (bibliotecarioId.value ?? undefined) : undefined
      )
    }
    // Refresh en modal también
    if (targetUserId.value) {
      fetchCertificadosUsuario(targetUserId.value, targetBibliotecaId.value ?? undefined)
    }
  } catch {
    ui.toast.error('Error', 'No se pudo anular el certificado')
  } finally {
    anulandoId.value = null
  }
}

// ─── QR Code ─────────────────────────────────────────────────────────────────
const validationUrl = computed(() => {
  if (!certGenerado.value?.codigo_verificacion) return ''
  return `${window.location.origin}/certificados?tab=validar&codigo=${certGenerado.value.codigo_verificacion}`
})

const qrUrl = computed(() => {
  if (!validationUrl.value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(validationUrl.value)}&ecc=M&margin=2`
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function estadoPrestamoClasses(estado: string) {
  const m: Record<string, string> = {
    ACTIVO: 'bg-emerald-100 text-emerald-700', RENOVADO: 'bg-blue-100 text-blue-700',
    VENCIDO: 'bg-red-100 text-red-700', DEVUELTO: 'bg-slate-100 text-slate-600',
  }
  return m[estado] ?? 'bg-slate-100 text-slate-600'
}

function estadoCertClasses(estado: string) {
  const m: Record<string, string> = {
    VIGENTE: 'bg-emerald-100 text-emerald-700',
    VENCIDO: 'bg-amber-100 text-amber-700',
    ANULADO: 'bg-red-100 text-red-700',
  }
  return m[estado] ?? 'bg-slate-100 text-slate-600'
}

const downloadUrl = computed(() => {
  if (!certGenerado.value?.urlDescarga) return null
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8098/api'
  const url = certGenerado.value.urlDescarga
  return url.startsWith('http') ? url : `${base.replace('/api', '')}${url}`
})

function buildDownloadUrl(urlDescarga: string) {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8098/api'
  return urlDescarga.startsWith('http') ? urlDescarga : `${base.replace('/api', '')}${urlDescarga}`
}

const certNombreUsuario = computed(() =>
  (isAdmin.value || isBibliotecario.value)
    ? selectedUser.value?.persona.nombreCompleto ?? ''
    : auth.displayName
)
const certUserCI = computed(() =>
  (isAdmin.value || isBibliotecario.value)
    ? String(selectedUser.value?.persona.ci ?? '')
    : String(auth.user?.persona?.ci ?? '')
)
</script>

<template>
  <div class="space-y-6">

    <!-- Subcomponentes globales -->
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false" />

    <CertificadosModal :show="showCertsModal" :certificados="certificadosUsuario"
      :titulo="isEstudiante ? 'Mis certificados' : `Certificados de ${selectedUser?.persona.nombreCompleto ?? 'este usuario'}`"
      :can-anular="isAdmin || isBibliotecario" :anulando-id="anulandoId" @close="showCertsModal = false"
      @anular="anularCertificado" />

    <!-- ══ ADMIN ══ -->
    <template v-if="isAdmin">
      <div v-if="!certGenerado" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
        <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">Admin</span>
          <h3 class="font-semibold text-slate-800 text-sm">Generar certificado a un estudiante</h3>
        </div>
        <div class="p-5 space-y-5">

          <div class="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <svg class="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm text-indigo-700">Como <strong>administrador</strong>, puedes generar certificados para
              cualquier estudiante en cualquier biblioteca.</p>
          </div>

          <!-- Biblioteca -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Biblioteca <span
                class="text-red-400">*</span></label>
            <select v-model="selectedBibliotecaId"
              class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
              <option :value="null">Seleccionar biblioteca...</option>
              <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">{{ b.nombre }}</option>
            </select>
          </div>

          <!-- Buscador -->
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
              <p class="text-xs text-slate-500">CI: {{ selectedUser.persona.ci }}<span
                  v-if="selectedUser.persona.matricula"> · Mat: {{ selectedUser.persona.matricula }}</span><span
                  class="text-slate-400"> · @{{ selectedUser.username }}</span></p>
            </div>
            <button @click="resetUserSearch"
              class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cambiar
            </button>
          </div>

          <!-- Aviso certificados -->
          <div v-if="certificadosLoading && selectedUser" class="h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div v-else-if="certificadosUsuario.length > 0 && selectedUser"
            class="flex items-center gap-3 p-3 rounded-xl border text-sm"
            :class="tieneVigente ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="flex-1">
              Este estudiante tiene
              <strong>{{ certificadosUsuario.length }}</strong> certificado(s)
              <span v-if="tieneVigente"> — incluye <strong>{{certificadosUsuario.filter(c => c.estadoCertificado ===
                'VIGENTE').length}} VIGENTE(s)</strong>, no se puede generar otro</span>.
            </span>
            <button @click="showCertsModal = true"
              class="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
              :class="tieneVigente ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver
            </button>
          </div>

          <!-- Días de validez -->
          <div v-if="selectedUser && !tieneVigente">
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

          <div v-if="certError"
            class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ certError }}
          </div>

          <button @click="generarCertificado" :disabled="!canGenerate || generandoCert" :class="['w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            canGenerate && !generandoCert
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
            {{ generandoCert ? 'Generando...' : !selectedBibliotecaId ? 'Selecciona una biblioteca' : !selectedUser ?
              'Selecciona un estudiante' : 'Generar Certificado' }}
          </button>
        </div>
      </div>
    </template>

    <!-- ══ BIBLIOTECARIO ══ -->
    <template v-else-if="isBibliotecario">
      <div v-if="!certGenerado" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
        <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Bibliotecario</span>
          <h3 class="font-semibold text-slate-800 text-sm">Generar certificado a un estudiante</h3>
          <span class="ml-auto text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{{ auth.bibliotecaNombre ??
            'Tu biblioteca' }}</span>
        </div>
        <div class="p-5 space-y-5">

          <div class="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <svg class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm text-emerald-800">Puedes generar certificados para estudiantes de <strong>{{
              auth.bibliotecaNombre ?? 'tu biblioteca asignada' }}</strong>.</p>
          </div>

          <!-- Buscador -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">Buscar estudiante</label>
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
            <button @click="resetUserSearch"
              class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cambiar
            </button>
          </div>

          <!-- Aviso certificados -->
          <div v-if="certificadosLoading && selectedUser" class="h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div v-else-if="certificadosUsuario.length > 0 && selectedUser"
            class="flex items-center gap-3 p-3 rounded-xl border text-sm"
            :class="tieneVigente ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="flex-1 text-xs">
              <strong>{{ certificadosUsuario.length }}</strong> certificado(s)
              <span v-if="tieneVigente"> — <strong>{{certificadosUsuario.filter(c => c.estadoCertificado ===
                'VIGENTE').length}} VIGENTE(s)</strong>, no se puede generar otro</span>
              <span v-else> — ninguno vigente, puede generar uno nuevo</span>.
            </span>
            <button @click="showCertsModal = true"
              class="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
              :class="tieneVigente ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver
            </button>
          </div>

          <!-- Días de validez -->
          <div v-if="selectedUser && !tieneVigente">
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

          <div v-if="certError"
            class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ certError }}
          </div>

          <button @click="generarCertificado" :disabled="!canGenerate || generandoCert" :class="['w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
            canGenerate && !generandoCert
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
            {{
              generandoCert
                ? 'Generando...'
                : !selectedUser ? 'Selecciona un estudiante primero' : 'Generar Certificado'
            }}
          </button>
        </div>
      </div>

      <!-- Tabla certificados de la biblioteca -->
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
                filtroEstadoBib === f.v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200']">
              {{ f.l }}
            </button>
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
              <p class="text-sm font-medium text-slate-800 capitalize truncate">{{ c.usuario?.nombreCompleto ?? '—' }}
              </p>
              <p class="text-xs font-mono text-slate-400 truncate">{{ c.codigo_verificacion }}</p>
              <p class="text-xs text-slate-400">Vence: {{ formatDate(c.fechaVencimiento) }}</p>
            </div>
            <span
              :class="['text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0', estadoCertClasses(c.estadoCertificado)]">
              {{ c.estadoCertificado }}
            </span>
            <div class="flex gap-1.5 flex-shrink-0">
              <button @click="abrirVisor(c.id_certificado)"
                class="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors">PDF</button>
              <button v-if="c.estadoCertificado === 'VIGENTE'" @click="anularCertificado(c.id_certificado)"
                :disabled="anulandoId === c.id_certificado"
                class="text-xs px-2.5 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors disabled:opacity-50">
                {{ anulandoId === c.id_certificado ? '...' : 'Anular' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ ESTUDIANTE ══ -->
    <template v-else-if="isEstudiante">

      <!-- Selección de biblioteca -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <label class="block text-xs font-medium text-slate-600 mb-1.5">Biblioteca para el certificado <span
            class="text-red-400">*</span></label>
        <select v-model="selectedBibliotecaId"
          class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all">
          <option :value="null">Seleccionar biblioteca...</option>
          <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">{{ b.nombre }}</option>
        </select>
      </div>

      <!-- Loading -->
      <div v-if="prestamosLoading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-16 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
      <div v-else-if="prestamosError" class="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
        <svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-sm font-medium text-red-700 flex-1">{{ prestamosError }}</p>
        <button @click="fetchPrestamos" class="text-xs text-red-600 hover:underline font-medium">Reintentar</button>
      </div>

      <template v-else-if="!certGenerado">
        <!-- Banner estado deuda -->
        <div
          :class="['rounded-2xl p-5 border flex items-center gap-4', tieneDeuda ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200']">
          <div
            :class="['w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0', tieneDeuda ? 'bg-red-100' : 'bg-emerald-100']">
            <svg v-if="tieneDeuda" class="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <svg v-else class="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="flex-1">
            <p :class="['font-bold text-base', tieneDeuda ? 'text-red-800' : 'text-emerald-800']">
              {{ tieneDeuda ? 'Tienes préstamos pendientes' : 'No tienes deuda bibliográfica' }}
            </p>
            <p :class="['text-sm mt-0.5', tieneDeuda ? 'text-red-600' : 'text-emerald-600']">
              {{
                tieneDeuda
                  ? `Debes devolver ${pendientes.length} libro(s) antes de generar tu certificado`
                  : 'Puedes generar tu certificado de no deuda ahora mismo'
              }}
            </p>
          </div>
          <span
            :class="['text-xs font-bold px-3 py-1 rounded-full flex-shrink-0', tieneDeuda ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700']">
            {{ tieneDeuda ? '❌ Con deuda' : '✅ Sin deuda' }}
          </span>
        </div>

        <!-- Pendientes -->
        <div v-if="tieneDeuda && pendientes.length"
          class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 class="font-semibold text-slate-800 text-sm">Libros pendientes de devolución</h3>
            <span class="ml-auto text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{{
              pendientes.length }}</span>
          </div>
          <div class="divide-y divide-slate-50">
            <div v-for="p in pendientes" :key="p.id_prestamo" class="flex items-center gap-4 px-5 py-4">
              <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-slate-800 text-sm truncate">
                  {{
                    p.ejemplar?.libro?.titulo ?? 'Libro desconocido'
                  }}</p>
                <p class="text-xs text-slate-500 mt-0.5">Ejemplar: {{ p.ejemplar?.codigo_ejemplar ?? '—' }}<span
                    v-if="p.fechaDevolucionEstimada"> · Vence: {{ formatDate(p.fechaDevolucionEstimada) }}</span></p>
              </div>
              <span :class="['text-xs font-bold px-2.5 py-1 rounded-full', estadoPrestamoClasses(p.estadoPrestamo)]">{{
                p.estadoPrestamo }}</span>
            </div>
          </div>
        </div>

        <!-- Mis certificados (si tiene) -->
        <div v-if="certificadosUsuario.length > 0"
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
                {{certificadosUsuario.filter(c => c.estadoCertificado === 'VIGENTE').length}} Vigente(s)
              </span>
              <span class="text-xs text-slate-400">{{ certificadosUsuario.length }} total</span>
              <button @click="showCertsModal = true"
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
                <p class="text-xs font-mono text-indigo-600 truncate">{{ certificadosUsuario[0].codigo_verificacion }}
                </p>
                <p class="text-xs text-slate-400 mt-0.5">
                  {{ certificadosUsuario[0].bibliotecaNombre }} ·
                  Vence: {{ formatDate(certificadosUsuario[0].fechaVencimiento) }}
                </p>
              </div>
              <span
                :class="['text-xs font-bold px-2.5 py-0.5 rounded-full flex-shrink-0', estadoCertClasses(certificadosUsuario[0].estadoCertificado)]">
                {{ certificadosUsuario[0].estadoCertificado }}
              </span>
              <a :href="buildDownloadUrl(certificadosUsuario[0].urlDescarga)" target="_blank"
                class="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors flex-shrink-0">PDF</a>
            </div>
            <p v-if="certificadosUsuario.length > 1" class="text-xs text-slate-400 mt-2 text-center">
              y {{ certificadosUsuario.length - 1 }} más...
            </p>
          </div>
        </div>

        <!-- Panel generar -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="font-semibold text-slate-800 text-sm">Generar Certificado de No Deuda</h3>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-sm text-slate-500">El certificado tendrá una validez de <strong class="text-slate-700">{{
              diasValidez }} día(s)</strong> a partir de la fecha de emisión.</p>
            <div>
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
            <div v-if="certError"
              class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ certError }}
            </div>
            <button @click="generarCertificado" :disabled="!canGenerate || generandoCert" :class="['w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              canGenerate && !generandoCert
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
                : !selectedBibliotecaId ? 'Selecciona una biblioteca primero'
                  : tieneVigente ? 'Ya tienes un certificado vigente'
                    : tieneDeuda ? 'No puedes generar (tienes deuda)'
                      : 'Generar Certificado' }}
            </button>
            <p v-if="tieneDeuda" class="text-xs text-center text-red-500">Debes devolver todos tus libros antes de
              generar el certificado.</p>
            <p v-else-if="tieneVigente" class="text-xs text-center text-amber-600">Ya tienes un certificado vigente.
              Debes esperar a que venza o sea anulado para generar uno nuevo.</p>
          </div>
        </div>
      </template>
    </template>

    <!-- ══ CERTIFICADO GENERADO (todos los roles) ══ -->
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
            <p class="text-xs text-emerald-600 mt-0.5">El certificado está listo para descargar</p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div class="flex items-center gap-2.5">
              <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="font-semibold text-slate-800 text-sm">Previsualización del Certificado</h3>
            </div>
            <span
              :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoCertClasses(certGenerado.estadoCertificado)]">
              {{ certGenerado.estadoCertificado }}
            </span>
          </div>

          <div class="p-6">
            <div class="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50">
              <!-- Encabezado institucional -->
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
                  <strong class="text-slate-900 capitalize">{{ certNombreUsuario }}</strong>
                  con CI: <strong class="text-slate-900">{{ certUserCI }}</strong>
                  no registra préstamos bibliográficos pendientes en el sistema.
                </p>
                <p class="text-xs text-slate-500">El presente certificado es válido para los fines pertinentes.</p>
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
                <!-- QR -->
                <div
                  class="flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 p-3 gap-2">
                  <p class="text-xs text-slate-400 font-medium text-center">Verificar autenticidad</p>
                  <img v-if="qrUrl" :src="qrUrl" alt="QR de verificación" class="w-32 h-32 rounded-lg" loading="lazy" />
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

          <div class="px-5 pb-5 flex flex-col sm:flex-row gap-3">
            <a v-if="downloadUrl" :href="downloadUrl" target="_blank" rel="noopener noreferrer"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-[0.98]">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar PDF
            </a>
            <button @click="resetCertificado"
              class="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
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


  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>