<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import api from '@/services/axios'

const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin, isBibliotecario, isEstudiante } = usePermissions()

// ─── Breadcrumbs ────────────────────────────────────────────────────────────
onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Certificados' }])
  fetchPrestamos()
  if (isEstudiante.value && auth.user?.id) {
    fetchCertificadosUsuario(auth.user.id)
  }
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'DEVUELTO' | 'VENCIDO' | 'RENOVADO'
  fechaDevolucionEstimada?: string
  fechaDevolucionReal?: string
  ejemplar?: {
    libro?: { titulo?: string }
    codigo_ejemplar?: string
  }
}

interface Certificado {
  id_certificado: number
  fechaEmision: string
  fechaVencimiento: string
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  urlDescarga: string
}

interface ValidacionResult {
  valido: boolean
  mensaje: string
  certificado?: Certificado & { usuario?: unknown; bibliotecario?: unknown; pdf_generado?: string }
}

interface UsuarioBusqueda {
  id_usuario: number
  username: string
  persona: {
    nombreCompleto: string
    ci: number | string
    matricula?: string | null
  }
}

// ─── Tab activo ─────────────────────────────────────────────────────────────
type Tab = 'generar' | 'validar'
const activeTab = ref<Tab>('generar')

// ─── Préstamos (ESTUDIANTE) ───────────────────────────────────────────────────
const prestamos = ref<Prestamo[]>([])
const prestamosLoading = ref(false)
const prestamosError = ref<string | null>(null)


const certificadosUsuario = ref<Certificado[]>([])
const certificadosLoading = ref(false)
const certificadosError = ref<string | null>(null)

async function fetchCertificadosUsuario(userId: number) {
  certificadosLoading.value = true
  certificadosError.value = null
  try {
    const { data } = await api.get(`/certificados/usuario/${userId}`)
    certificadosUsuario.value = data.data ?? []
  } catch (e: unknown) {
    certificadosError.value =
      e instanceof Error ? e.message : 'Error al cargar certificados'
    certificadosUsuario.value = []
  } finally {
    certificadosLoading.value = false
  }
}


async function fetchPrestamos() {
  // Solo necesario para estudiante
  if (!isEstudiante.value) return
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

const tieneDeuda = computed(() =>
  prestamos.value.some(p => p.estadoPrestamo !== 'DEVUELTO')
)
const pendientes = computed(() =>
  prestamos.value.filter(p => p.estadoPrestamo !== 'DEVUELTO')
)

// ─── Búsqueda de usuario (ADMIN / BIBLIOTECARIO) ──────────────────────────────
const userQuery = ref('')
const userResults = ref<UsuarioBusqueda[]>([])
const userLoading = ref(false)
const userDropdownOpen = ref(false)
const selectedUser = ref<UsuarioBusqueda | null>(null)
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
    userDropdownOpen.value = true
  } catch {
    userResults.value = []
  } finally {
    userLoading.value = false
  }
}

function selectUser(u: UsuarioBusqueda) {
  selectedUser.value = u
  userQuery.value = u.persona.nombreCompleto
  userDropdownOpen.value = false

  fetchCertificadosUsuario(u.id_usuario)
}

function resetUserSearch() {
  selectedUser.value = null
  userQuery.value = ''
  userResults.value = []
  certGenerado.value = null
  certError.value = null
  certificadosUsuario.value = []

}

function highlight(text: string, query: string): string {
  if (!query) return text
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, '<mark class="bg-indigo-100 text-indigo-700 rounded-sm px-0.5">$1</mark>')
}

// ─── Generación de certificado ───────────────────────────────────────────────
const diasValidez = ref(2)
const generandoCert = ref(false)
const certError = ref<string | null>(null)
const certGenerado = ref<Certificado | null>(null)

// Para staff: el usuario target es el seleccionado; para estudiante: el auth.user
const targetUserId = computed(() => {
  if (isAdmin.value || isBibliotecario.value) return selectedUser.value?.id_usuario ?? null
  return auth.user?.id ?? null
})

const tieneCertificados = computed(() => certificadosUsuario.value.length > 0)

const canGenerate = computed(() => {
  if (isAdmin.value || isBibliotecario.value) return !!selectedUser.value && !tieneCertificados.value
  return !tieneDeuda.value && !tieneCertificados.value
})

async function generarCertificado() {
  if (!canGenerate.value) return
  generandoCert.value = true
  certError.value = null
  certGenerado.value = null
  try {
    const { data } = await api.post('/certificados', {
      usuarioId: targetUserId.value,
      diasValidez: diasValidez.value,
    })
    if (data.success) {
      certGenerado.value = data.data
      ui.toast.success('Certificado generado', 'El certificado de no deuda está listo')
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
  if (isEstudiante.value) fetchPrestamos()
  else resetUserSearch()
}

// ─── QR Code ─────────────────────────────────────────────────────────────────
// URL de validación pública: apunta a la tab de validar con el código
const validationUrl = computed(() => {
  if (!certGenerado.value?.codigo_verificacion) return ''
  const base = window.location.origin
  return `${base}/certificados?tab=validar&codigo=${certGenerado.value.codigo_verificacion}`
})

// Genera QR usando la API gratuita de QR Server (sin dependencias extra)
const qrUrl = computed(() => {
  if (!validationUrl.value) return ''
  const encoded = encodeURIComponent(validationUrl.value)
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encoded}&ecc=M&margin=2`
})

// ─── Validar certificado ─────────────────────────────────────────────────────
const codigoValidar = ref('')
const validando = ref(false)
const validacionResult = ref<ValidacionResult | null>(null)
const validacionError = ref<string | null>(null)

// Si llegan con ?tab=validar&codigo=xxx por URL del QR
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const tabParam = params.get('tab')
  const codigoParam = params.get('codigo')
  if (tabParam === 'validar') activeTab.value = 'validar'
  if (codigoParam) {
    codigoValidar.value = codigoParam
    // Auto-validar si viene desde QR
    setTimeout(() => validarCertificado(), 300)
  }
})

async function validarCertificado() {
  if (!codigoValidar.value.trim()) return
  validando.value = true
  validacionResult.value = null
  validacionError.value = null
  try {
    const { data } = await api.get(`/certificados/validar/${codigoValidar.value.trim()}`)
    validacionResult.value = data.data ?? data
  } catch (e: unknown) {
    validacionError.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'No se pudo validar el certificado'
  } finally {
    validando.value = false
  }
}

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

function estadoClasses(estado: string) {
  switch (estado) {
    case 'ACTIVO': return 'bg-emerald-100 text-emerald-700'
    case 'RENOVADO': return 'bg-blue-100 text-blue-700'
    case 'VENCIDO': return 'bg-red-100 text-red-700'
    case 'DEVUELTO': return 'bg-slate-100 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

const downloadUrl = computed(() => {
  if (!certGenerado.value?.urlDescarga) return null
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8098/api'
  const url = certGenerado.value.urlDescarga
  return url.startsWith('http') ? url : `${base.replace('/api', '')}${url}`
})

// Nombre del usuario a mostrar en el certificado
const certNombreUsuario = computed(() => {
  if (isAdmin.value || isBibliotecario.value) return selectedUser.value?.persona.nombreCompleto ?? ''
  return auth.displayName
})
const certUsernameUsuario = computed(() => {
  if (isAdmin.value || isBibliotecario.value) return selectedUser.value?.username ?? ''
  return auth.user?.username ?? ''
})
</script>

<template>
  <div class="page-container space-y-6">
    <div v-if="tieneCertificados && activeTab === 'generar'"
      class="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
      ⚠️ Este usuario ya tiene certificados generados. No puede generar otro.
    </div>
    <!-- ── Header ── -->
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Certificados de No Deuda</h1>
        <p class="text-sm text-slate-500 mt-0.5">Genera y valida certificados de no deuda bibliográfica</p>
      </div>
      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">

        <button @click="activeTab = 'generar'" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'generar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        ]">
          Generar Certificado
        </button>
        <button @click="activeTab = 'validar'" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'validar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
        ]">
          Validar Código
        </button>
      </div>
    </div>


    <!-- Certificados existentes -->
    <div v-if="certificadosUsuario.length"
      class="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">

      <div class="flex items-center gap-2.5 px-5 py-4 border-b border-indigo-100 bg-indigo-50/50">
        <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="font-semibold text-slate-800 text-sm">
          Certificados ya generados
        </h3>

        <span class="ml-auto text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
          {{ certificadosUsuario.length }}
        </span>
      </div>

      <div class="divide-y divide-slate-50">
        <div v-for="c in certificadosUsuario" :key="c.id_certificado"
          class="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition">

          <div class="flex-1">
            <p class="text-sm font-semibold text-slate-800">
              Código: <span class="font-mono text-indigo-600">{{ c.codigo_verificacion }}</span>
            </p>
            <p class="text-xs text-slate-500 mt-0.5">
              Emitido: {{ formatDateTime(c.fechaEmision) }} ·
              Vence: {{ formatDateTime(c.fechaVencimiento) }}
            </p>
          </div>

          <span :class="[
            'text-xs font-bold px-2.5 py-1 rounded-full',
            c.estadoCertificado === 'VIGENTE'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          ]">
            {{ c.estadoCertificado }}
          </span>

          <a :href="`http://localhost:8098${c.urlDescarga}`" target="_blank"
            class="text-xs text-indigo-600 hover:underline font-medium">
            Descargar
          </a>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ GENERAR CERTIFICADO ═══════════════════ -->
    <div v-if="activeTab === 'generar'" class="space-y-6">

      <!-- ══════════ VISTA ADMIN / BIBLIOTECARIO ══════════ -->
      <template v-if="isAdmin || isBibliotecario">

        <!-- Buscador de usuario -->
        <div v-if="!certGenerado" class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
          <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <!-- Badge de rol -->
            <span :class="[
              'text-xs font-bold px-2.5 py-1 rounded-full',
              isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
            ]">
              {{ isAdmin ? 'Admin' : 'Bibliotecario' }}
            </span>
            <h3 class="font-semibold text-slate-800 text-sm">Generar certificado a un estudiante</h3>
          </div>

          <div class="p-5 space-y-5">
            <!-- Descripción -->
            <div class="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <svg class="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm text-indigo-700">
                Como <strong>{{ isAdmin ? 'administrador' : 'bibliotecario' }}</strong>, puedes generar certificados de
                no deuda
                para cualquier estudiante del sistema. Busca al estudiante por nombre, CI o matrícula.
              </p>
            </div>

            <!-- Búsqueda de usuario -->
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Buscar estudiante</label>
              <div class="relative">
                <!-- Input -->
                <div class="relative">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input v-model="userQuery" type="text" placeholder="Buscar por nombre, CI o matrícula..."
                    :disabled="!!selectedUser"
                    class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all disabled:bg-slate-50 disabled:text-slate-400" />
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
                      <p class="text-xs text-slate-400">
                        CI: {{ u.persona.ci }}
                        <span v-if="u.persona.matricula"> · Mat: {{ u.persona.matricula }}</span>
                      </p>
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
                <p class="text-xs text-slate-500">
                  CI: {{ selectedUser.persona.ci }}
                  <span v-if="selectedUser.persona.matricula"> · Mat: {{ selectedUser.persona.matricula }}</span>
                  <span class="text-slate-400"> · @{{ selectedUser.username }}</span>
                </p>
              </div>
              <button @click="resetUserSearch"
                class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cambiar
              </button>
            </div>

            <!-- Control días de validez -->
            <div v-if="selectedUser">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Días de validez del certificado</label>
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
            <div v-if="certError"
              class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ certError }}
            </div>

            <!-- Botón generar -->
            <button @click="generarCertificado" :disabled="!selectedUser || generandoCert || tieneCertificados" :class="[
              'w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
              selectedUser && !generandoCert && !tieneCertificados
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            ]">
              <svg v-if="generandoCert" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {{
                generandoCert ? 'Generando...' : !selectedUser
                  ? 'Selecciona un estudiante primero'
                  : 'Generar Certificado'
              }}
            </button>
          </div>
        </div>

      </template>

      <!-- ══════════ VISTA ESTUDIANTE ══════════ -->
      <template v-else-if="isEstudiante">

        <!-- Loading préstamos -->
        <div v-if="prestamosLoading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-16 bg-slate-100 rounded-2xl animate-pulse" />
        </div>

        <div v-else-if="prestamosError" class="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
          <svg class="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-700">{{ prestamosError }}</p>
          </div>
          <button @click="fetchPrestamos" class="text-xs text-red-600 hover:underline font-medium">Reintentar</button>
        </div>

        <template v-else-if="!certGenerado">
          <!-- Banner de estado -->
          <div :class="[
            'rounded-2xl p-5 border flex items-center gap-4',
            tieneDeuda ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
          ]">
            <div :class="[
              'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0',
              tieneDeuda ? 'bg-red-100' : 'bg-emerald-100'
            ]">
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
                {{ tieneDeuda
                  ? `Debes devolver ${pendientes.length} libro(s) antes de generar tu certificado`
                  : 'Puedes generar tu certificado de no deuda ahora mismo'
                }}
              </p>
            </div>
            <span :class="[
              'text-xs font-bold px-3 py-1 rounded-full flex-shrink-0',
              tieneDeuda ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            ]">
              {{ tieneDeuda ? '❌ Con deuda' : '✅ Sin deuda' }}
            </span>
          </div>

          <!-- Libros pendientes -->
          <div v-if="tieneDeuda && pendientes.length"
            class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 class="font-semibold text-slate-800 text-sm">Libros pendientes de devolución</h3>
              <span class="ml-auto text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {{ pendientes.length }}
              </span>
            </div>
            <div class="divide-y divide-slate-50">
              <div v-for="p in pendientes" :key="p.id_prestamo"
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
                  </p>
                </div>
                <span :class="['text-xs font-bold px-2.5 py-1 rounded-full', estadoClasses(p.estadoPrestamo)]">
                  {{ p.estadoPrestamo }}
                </span>
              </div>
            </div>
          </div>

          <!-- Historial si no tiene deuda -->
          <div v-if="!tieneDeuda && prestamos.length"
            class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 class="font-semibold text-slate-800 text-sm">Historial de préstamos</h3>
              <span class="ml-auto text-xs text-slate-400">{{ prestamos.length }} préstamo(s)</span>
            </div>
            <div class="divide-y divide-slate-50 max-h-60 overflow-y-auto">
              <div v-for="p in prestamos" :key="p.id_prestamo" class="flex items-center gap-4 px-5 py-3.5">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-slate-700 text-sm truncate">
                    {{
                      p.ejemplar?.libro?.titulo ?? 'Libro desconocido'
                    }}
                  </p>
                  <p class="text-xs text-slate-400 mt-0.5">Devuelto: {{ formatDate(p.fechaDevolucionReal) }}</p>
                </div>
                <span :class="['text-xs font-semibold px-2.5 py-1 rounded-full', estadoClasses(p.estadoPrestamo)]">
                  {{ p.estadoPrestamo }}
                </span>
              </div>
            </div>
          </div>

          <!-- Sin préstamos -->
          <div v-if="!tieneDeuda && !prestamos.length"
            class="bg-white rounded-2xl border border-slate-200 py-8 text-center">
            <div class="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p class="text-sm text-slate-500">No tienes préstamos registrados</p>
          </div>

          <!-- Sección generar (solo si no tiene deuda) -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="font-semibold text-slate-800 text-sm">Generar Certificado de No Deuda</h3>
            </div>
            <div class="p-5 space-y-4">
              <p class="text-sm text-slate-500">
                El certificado tendrá una validez de <strong class="text-slate-700">{{ diasValidez }} día(s)</strong> a
                partir de la fecha de emisión.
              </p>
              <!-- Control días -->
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
              <!-- Error -->
              <div v-if="certError"
                class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {{ certError }}
              </div>
              <!-- Botón -->
              <button @click="generarCertificado" :disabled="tieneDeuda || generandoCert || tieneCertificados" :class="[
                'w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                !tieneDeuda && !generandoCert && !tieneCertificados
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              ]">
                <svg v-if="generandoCert" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {{
                  generandoCert ? 'Generando...' : tieneDeuda
                    ? 'No puedes generar (tienes deuda)'
                    : 'Generar Certificado'
                }}
              </button>
              <p v-if="tieneDeuda" class="text-xs text-center text-red-500">
                Debes devolver todos tus libros antes de generar el certificado.
              </p>
            </div>
          </div>
        </template>

      </template>

      <!-- ══════════ CERTIFICADO GENERADO (compartido ambos roles) ══════════ -->
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
              <p class="font-semibold text-emerald-800 text-sm">¡Certificado generado exitosamente!</p>
              <p class="text-xs text-emerald-600 mt-0.5">El certificado está listo para descargar</p>
            </div>
          </div>

          <!-- Vista previa del certificado -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div class="flex items-center gap-2.5">
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="font-semibold text-slate-800 text-sm">Previsualización del Certificado</h3>
              </div>
              <span :class="[
                'text-xs font-bold px-2.5 py-0.5 rounded-full',
                certGenerado.estadoCertificado === 'VIGENTE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              ]">
                {{ certGenerado.estadoCertificado }}
              </span>
            </div>

            <div class="p-6">
              <div class="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50">

                <!-- Encabezado institucional -->
                <div class="text-center mb-6 pb-4 border-b border-slate-200">
                  <div class="flex items-center justify-center gap-3 mb-2">
                    <div class="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                      <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>
                  <h2 class="text-lg font-bold text-slate-900 uppercase tracking-wide">Universidad Mayor de San Andrés
                  </h2>
                  <p class="text-sm text-slate-600">Facultad de Humanidades y Ciencias de la Educación</p>
                  <p class="text-xs text-slate-400 mt-0.5">Sistema de Gestión Bibliográfica – SIGEB</p>
                </div>

                <!-- Título -->
                <div class="text-center mb-6">
                  <h3 class="text-xl font-bold text-indigo-700 uppercase tracking-widest">Certificado de No Deuda</h3>
                  <p class="text-xs text-slate-500 mt-1">Bibliográfica</p>
                </div>

                <!-- Cuerpo -->
                <div class="text-sm text-slate-700 space-y-3 mb-6 text-center">
                  <p>
                    Se certifica que el/la estudiante
                    <strong class="text-slate-900 capitalize">{{ certNombreUsuario }}</strong>
                    con usuario <strong class="text-slate-900">{{ certUsernameUsuario }}</strong>
                    no registra préstamos bibliográficos pendientes en el sistema.
                  </p>
                  <p class="text-xs text-slate-500">El presente certificado es válido para los fines pertinentes.</p>
                </div>

                <!-- Datos + QR en la misma fila -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <!-- Datos del certificado -->
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
                      <p class="font-mono font-semibold text-indigo-700 text-xs break-all">
                        {{ certGenerado.codigo_verificacion }}
                      </p>
                    </div>
                  </div>

                  <!-- QR Code -->
                  <div
                    class="flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 p-3 gap-2">
                    <p class="text-xs text-slate-400 font-medium text-center">Verificar autenticidad</p>
                    <img v-if="qrUrl" :src="qrUrl" alt="QR de verificación" class="w-32 h-32 rounded-lg"
                      loading="lazy" />
                    <div v-else class="w-32 h-32 bg-slate-100 rounded-lg animate-pulse" />
                    <p class="text-xs text-slate-400 text-center leading-tight">Escanea para validar este certificado
                    </p>
                  </div>
                </div>

                <!-- Pie de firma -->
                <div class="flex justify-end pt-4 border-t border-slate-200">
                  <div class="text-center">
                    <div class="w-28 border-b border-slate-400 mb-1 mx-auto" />
                    <p class="text-xs text-slate-500">Firma del Bibliotecario</p>
                    <p class="text-xs text-slate-400">Sello Institucional</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Acciones -->
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
                class="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-sm font-medium rounded-xl transition-all">
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

    <!-- ═══════════════════ VALIDAR CERTIFICADO ═══════════════════ -->
    <div v-if="activeTab === 'validar'" class="space-y-5">

      <!-- Formulario de validación -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h3 class="font-semibold text-slate-800 text-sm">Verificar autenticidad de certificado</h3>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-sm text-slate-500">
            Ingresa el código de verificación del certificado para comprobar su validez y estado.
          </p>
          <div class="flex gap-3">
            <div class="relative flex-1">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <input v-model="codigoValidar" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                @keyup.enter="validarCertificado"
                class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all font-mono" />
            </div>
            <button @click="validarCertificado" :disabled="!codigoValidar.trim() || validando" :class="[
              'px-4 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 flex-shrink-0',
              codigoValidar.trim() && !validando
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            ]">
              <svg v-if="validando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {{ validando ? 'Verificando...' : 'Verificar' }}
            </button>
          </div>
          <!-- Error de red -->
          <div v-if="validacionError"
            class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ validacionError }}
          </div>
        </div>
      </div>

      <!-- Resultado de validación -->
      <Transition name="fade">
        <div v-if="validacionResult" class="bg-white rounded-2xl border shadow-sm overflow-hidden"
          :class="validacionResult.valido ? 'border-emerald-200' : 'border-red-200'">
          <div :class="[
            'flex items-center gap-3 px-5 py-4 border-b',
            validacionResult.valido ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
          ]">
            <div :class="[
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              validacionResult.valido ? 'bg-emerald-500' : 'bg-red-500'
            ]">
              <svg v-if="validacionResult.valido" class="w-5 h-5 text-white" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p :class="['font-bold', validacionResult.valido ? 'text-emerald-800' : 'text-red-800']">
                {{ validacionResult.valido ? 'Certificado Válido' : 'Certificado No Válido' }}
              </p>
              <p :class="['text-xs', validacionResult.valido ? 'text-emerald-600' : 'text-red-600']">
                {{ validacionResult.mensaje }}
              </p>
            </div>
          </div>

          <div v-if="validacionResult.valido && validacionResult.certificado" class="p-5">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-slate-400 mb-0.5">Código</p>
                <p class="font-mono text-xs text-indigo-700 break-all">{{
                  validacionResult.certificado.codigo_verificacion
                }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400 mb-0.5">Estado</p>
                <span :class="[
                  'text-xs font-bold px-2.5 py-0.5 rounded-full',
                  validacionResult.certificado.estadoCertificado === 'VIGENTE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                ]">
                  {{ validacionResult.certificado.estadoCertificado }}
                </span>
              </div>
              <div>
                <p class="text-xs text-slate-400 mb-0.5">Fecha de Emisión</p>
                <p class="font-medium text-slate-700 text-xs">{{
                  formatDateTime(validacionResult.certificado.fechaEmision)
                }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400 mb-0.5">Fecha de Vencimiento</p>
                <p class="font-medium text-slate-700 text-xs">{{
                  formatDateTime(validacionResult.certificado.fechaVencimiento) }}</p>
              </div>
              <div v-if="validacionResult.certificado.urlDescarga" class="col-span-2 pt-2">
                <a :href="`http://localhost:8098${validacionResult.certificado.urlDescarga}`" target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar PDF del certificado
                </a>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Instrucciones -->
      <div class="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h4 class="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ¿Cómo verificar un certificado?
        </h4>
        <ul class="space-y-2 text-sm text-slate-500">
          <li class="flex items-start gap-2">
            <span
              class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
            <span>El certificado físico o digital contiene un código UUID en la sección de verificación, o un código
              QR.</span>
          </li>
          <li class="flex items-start gap-2">
            <span
              class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
            <span>Ingresa el código en el campo de arriba o escanea el QR con tu cámara, y haz clic en
              "Verificar".</span>
          </li>
          <li class="flex items-start gap-2">
            <span
              class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
            <span>El sistema mostrará si el certificado es válido, vencido o no existe.</span>
          </li>
        </ul>
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