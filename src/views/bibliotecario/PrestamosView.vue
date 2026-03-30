<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/services/axios'

// ─── Breadcrumbs ────────────────────────────────────────────────────────────
const ui = useUiStore()
const auth = useAuthStore()

onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Préstamos', to: '/prestamos' },
    { label: 'Nuevo Préstamo' }
  ])
  fetchPrestamos()
})

// ─── Types ───────────────────────────────────────────────────────────────────
interface UsuarioResult {
  id_usuario: number
  username: string
  persona: {
    nombreCompleto: string
    ci: number | string
    matricula: string | null
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

// ─── Paso activo ─────────────────────────────────────────────────────────────
const step = ref<1 | 2 | 3 | 4>(1)

// ─── TAB VIEW ────────────────────────────────────────────────────────────────
type TabView = 'nuevo' | 'lista'
const activeTab = ref<TabView>('nuevo')

// ─── PASO 1: Búsqueda de usuario ─────────────────────────────────────────────
const userQuery = ref('')
const userResults = ref<UsuarioResult[]>([])
const userLoading = ref(false)
const userDropdownOpen = ref(false)
const selectedUser = ref<UsuarioResult | null>(null)
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
    console.log(data)
    userResults.value = data?.data ?? []
    // userDropdownOpen.value = true
    console.log(userResults.value.length)
    // userDropdownOpen.value = userResults.value.length > 0
    userDropdownOpen.value = true
  } catch {
    userResults.value = []
  } finally {
    userLoading.value = false
  }
}

function selectUser(u: UsuarioResult) {
  console.log(u)
  selectedUser.value = u
  userQuery.value = u.persona.nombreCompleto
  userDropdownOpen.value = false
}

function resetUser() {
  selectedUser.value = null
  userQuery.value = ''
  userResults.value = []
  step.value = 1
  resetBook()
}

function highlight(text: string, query: string): string {
  if (!query) return text
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(re, '<mark class="bg-indigo-100 text-indigo-700 rounded-sm px-0.5">$1</mark>')
}

// ─── PASO 2: Búsqueda de libro ───────────────────────────────────────────────
const bookQuery = ref('')
const bookResults = ref<LibroResult[]>([])
const bookLoading = ref(false)
const bookDropdownOpen = ref(false)
const selectedBook = ref<LibroResult | null>(null)
let bookDebounce: ReturnType<typeof setTimeout>

watch(bookQuery, (val) => {
  clearTimeout(bookDebounce)
  if (!val || val.length < 2) {
    bookResults.value = []
    // bookDropdownOpen.value = false
    return
  }
  bookDebounce = setTimeout(() => searchBooks(val), 500)
})

async function searchBooks(q: string) {
  bookLoading.value = true
  try {
    const { data } = await api.get('/libros/search', { params: { q } })
    bookResults.value = data.data ?? []
    bookDropdownOpen.value = true
  } catch {
    bookResults.value = []
  } finally {
    bookLoading.value = false
  }
}

function selectBook(b: LibroResult) {
  selectedBook.value = b
  bookQuery.value = b.titulo
  bookDropdownOpen.value = false
  fetchEjemplares(b.id_libro)
}

function resetBook() {
  selectedBook.value = null
  bookQuery.value = ''
  bookResults.value = []
  selectedEjemplar.value = null
  ejemplares.value = []
  if (step.value > 2) step.value = 2
}

// ─── PASO 3: Selección de ejemplar ───────────────────────────────────────────
const ejemplares = ref<Ejemplar[]>([])
const ejemplaresLoading = ref(false)
const selectedEjemplar = ref<Ejemplar | null>(null)

async function fetchEjemplares(libroId: number) {
  ejemplaresLoading.value = true
  step.value = 3
  try {
    const { data } = await api.get(`/ejemplares/libro/${libroId}/disponibles`)
    ejemplares.value = data.data ?? []
  } catch {
    ejemplares.value = []
  } finally {
    ejemplaresLoading.value = false
  }
}

// ─── PASO 4: Confirmación ─────────────────────────────────────────────────────
const fechaDevolucion = ref(defaultDevolucion())
const observaciones = ref('')
const confirmLoading = ref(false)
const confirmError = ref<string | null>(null)
const confirmSuccess = ref(false)

function defaultDevolucion() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().split('T')[0]
}

const canConfirm = computed(() =>
  selectedUser.value && selectedEjemplar.value && fechaDevolucion.value
)

async function confirmarPrestamo() {
  if (!canConfirm.value) return
  confirmLoading.value = true
  confirmError.value = null
  confirmSuccess.value = false

  try {
    const bibliotecaId = auth.user?.biblioteca?.id_biblioteca ?? 1
    await api.post('/prestamos', {
      ejemplarId: selectedEjemplar.value!.id_ejemplar,
      usuarioId: selectedUser.value!.id_usuario,
      bibliotecaId,
      fechaDevolucionEstimada: fechaDevolucion.value,
      observaciones: observaciones.value || `Préstamo registrado`,
    })
    confirmSuccess.value = true
    ui.toast.success('Préstamo registrado', 'El préstamo fue creado exitosamente')
    setTimeout(() => resetForm(), 2000)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    confirmError.value = msg ?? 'No se pudo registrar el préstamo'
    ui.toast.error('Error', confirmError.value!)
  } finally {
    confirmLoading.value = false
  }
}

function resetForm() {
  resetUser()
  step.value = 1
  fechaDevolucion.value = defaultDevolucion()
  observaciones.value = ''
  confirmSuccess.value = false
  confirmError.value = null
  fetchPrestamos()
}

// ─── Lista de Préstamos ───────────────────────────────────────────────────────
const prestamos = ref<Prestamo[]>([])
const prestamosLoading = ref(false)
const filtroEstado = ref<'TODOS' | 'ACTIVO' | 'RENOVADO' | 'DEVUELTO' | 'VENCIDO'>('TODOS')

async function fetchPrestamos() {
  prestamosLoading.value = true
  try {
    let url = '/prestamos'
    if (filtroEstado.value !== 'TODOS' && filtroEstado.value !== 'VENCIDO') {
      url = `/prestamos/estado/${filtroEstado.value}`
    }
    const { data } = await api.get(url)
    let list: Prestamo[] = data.data ?? data ?? []
    if (filtroEstado.value === 'VENCIDO') {
      list = list.filter((p) => p.vencido)
    }
    prestamos.value = list
  } catch {
    prestamos.value = []
  } finally {
    prestamosLoading.value = false
  }
}

watch(filtroEstado, fetchPrestamos)

// Devolver préstamo
const devolucionLoading = ref<number | null>(null)
async function devolverPrestamo(id: number) {
  devolucionLoading.value = id
  try {
    await api.post('/prestamos/devolucion', { prestamoId: id, observaciones: 'Devolución registrada' })
    ui.toast.success('Devuelto', 'El préstamo fue devuelto correctamente')
    fetchPrestamos()
  } catch {
    ui.toast.error('Error', 'No se pudo registrar la devolución')
  } finally {
    devolucionLoading.value = null
  }
}

// Renovar préstamo
const renovarLoading = ref<number | null>(null)
async function renovarPrestamo(id: number) {
  renovarLoading.value = id
  try {
    await api.post('/prestamos/renovar', { prestamoId: id })
    ui.toast.success('Renovado', 'El préstamo fue renovado')
    fetchPrestamos()
  } catch {
    ui.toast.error('Error', 'No se puede renovar este préstamo')
  } finally {
    renovarLoading.value = null
  }
}

// Helpers
function estadoClasses(p: Prestamo) {
  if (p.vencido) return 'bg-red-100 text-red-700'
  switch (p.estadoPrestamo) {
    case 'ACTIVO': return 'bg-emerald-100 text-emerald-700'
    case 'RENOVADO': return 'bg-blue-100 text-blue-700'
    case 'DEVUELTO': return 'bg-slate-100 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function estadoLabel(p: Prestamo) {
  if (p.vencido && p.estadoPrestamo !== 'DEVUELTO') return 'VENCIDO'
  return p.estadoPrestamo
}

function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="page-container space-y-6">

    <!-- Header -->
    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Gestión de Préstamos</h1>
        <p class="text-sm text-slate-500 mt-0.5">Registra nuevos préstamos y consulta el historial</p>
      </div>
      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
        <button @click="activeTab = 'nuevo'" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'nuevo'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        ]">
          Nuevo Préstamo
        </button>
        <button @click="activeTab = 'lista'; fetchPrestamos()" :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === 'lista'
            ? 'bg-white text-indigo-700 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        ]">
          Historial
        </button>
      </div>
    </div>

    <!-- ═══════════════════ NUEVO PRÉSTAMO ═══════════════════ -->
    <div v-if="activeTab === 'nuevo'" class="space-y-6">

      <!-- Stepper -->
      <div class="flex items-center gap-0">
        <template v-for="(label, i) in ['Buscar Usuario', 'Buscar Libro', 'Seleccionar Ejemplar', 'Confirmar']"
          :key="i">
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
          <div v-if="i < 3" :class="[
            'flex-1 h-0.5 mx-2',
            step > i + 1 ? 'bg-emerald-400' : 'bg-slate-200'
          ]" />
        </template>
      </div>

      <!-- Cards del flujo -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- Paso 1 y 2 -->
        <div class="space-y-4">

          <!-- PASO 1: Usuario -->
          <div :class="[
            'rounded-2xl border transition-all overflow-visible',
            step >= 1 ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60'
          ]">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div :class="[
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                  selectedUser ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                ]">1</div>
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
              <!-- Seleccionado -->
              <div v-if="selectedUser"
                class="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div
                  class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {{ selectedUser.persona.nombreCompleto.charAt(0).toUpperCase() }}
                </div>
                <div class="min-w-0">
                  <p class="font-semibold text-slate-800 text-sm capitalize">{{ selectedUser.persona.nombreCompleto }}
                  </p>
                  <p class="text-xs text-slate-500">
                    CI: {{ selectedUser.persona.ci }}
                    <span v-if="selectedUser.persona.matricula"> · Mat: {{ selectedUser.persona.matricula }}</span>
                  </p>
                </div>
                <svg class="w-5 h-5 text-emerald-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <!-- Búsqueda -->
              <div v-else class="relative">
                <div class="relative">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input v-model="userQuery" type="text" placeholder="Buscar por nombre, CI o matrícula..."
                    class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all" />
                  <div v-if="userLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg class="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </div>
                </div>

                <!-- Dropdown usuarios -->
                <div v-if="userDropdownOpen && (userResults.length > 0)"
                  class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                  <button v-for="u in userResults" :key="u.id_usuario" @click="selectUser(u); step = 2"
                    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0">
                    <div
                      class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs flex-shrink-0">
                      {{ u.persona.nombreCompleto.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-slate-800 capitalize"
                        v-html="highlight(u.persona.nombreCompleto, userQuery)"></p>
                      <p class="text-xs text-slate-400">CI: {{ u.persona.ci }}<span v-if="u.persona.matricula"> · Mat:
                          {{
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

          <!-- PASO 2: Libro -->
          <div :class="[
            'rounded-2xl border transition-all overflow-visible',
            step >= 2 ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-40 pointer-events-none'
          ]">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div :class="[
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                  selectedBook ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                ]">2</div>
                <span class="font-semibold text-slate-800">Buscar Libro</span>
              </div>
              <button v-if="selectedBook" @click="resetBook"
                class="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cambiar
              </button>
            </div>

            <div class="p-5">
              <!-- Seleccionado -->
              <div v-if="selectedBook"
                class="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div class="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-slate-800 text-sm">{{ selectedBook.titulo }}</p>
                  <p class="text-xs text-slate-500">ISBN: {{ selectedBook.isbn }} · {{ selectedBook.editorial }}</p>
                </div>
                <span :class="[
                  'text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                  selectedBook.ejemplaresDisponibles > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                ]">
                  {{ selectedBook.ejemplaresDisponibles > 0 ? `${selectedBook.ejemplaresDisponibles} disp.` : 'No disp.'
                  }}
                </span>
              </div>

              <!-- Búsqueda -->
              <div v-else class="relative">
                <div class="relative">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input v-model="bookQuery" type="text" placeholder="Buscar por título, ISBN o editorial..."
                    class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all" />
                  <div v-if="bookLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg class="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </div>
                </div>

                <!-- Dropdown libros -->
                <div v-if="bookDropdownOpen && bookResults.length"
                  class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                  <button v-for="b in bookResults" :key="b.id_libro" @click="selectBook(b)"
                    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-800" v-html="highlight(b.titulo, bookQuery)"></p>
                      <p class="text-xs text-slate-400">{{ b.isbn }} · {{ b.editorial }}</p>
                    </div>
                    <span :class="[
                      'text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
                      b.ejemplaresDisponibles > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'
                    ]">
                      {{ b.ejemplaresDisponibles > 0 ? `✓ ${b.ejemplaresDisponibles}` : '✗ 0' }}
                    </span>
                  </button>
                </div>
                <div v-else-if="bookDropdownOpen && !bookResults.length && !bookLoading"
                  class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-md z-20 py-6 text-center">
                  <p class="text-sm text-slate-400">Sin resultados para "{{ bookQuery }}"</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Paso 3 y 4 -->
        <div class="space-y-4">

          <!-- PASO 3: Ejemplar -->
          <div :class="[
            'rounded-2xl border transition-all overflow-hidden',
            step >= 3 ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-40 pointer-events-none'
          ]">
            <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
              <div :class="[
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                selectedEjemplar ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
              ]">3</div>
              <span class="font-semibold text-slate-800">Seleccionar Ejemplar</span>
            </div>

            <div class="p-5">
              <!-- Loading -->
              <div v-if="ejemplaresLoading" class="space-y-2">
                <div v-for="i in 3" :key="i" class="h-12 bg-slate-100 rounded-xl animate-pulse" />
              </div>

              <!-- Sin ejemplares -->
              <div v-else-if="step >= 3 && !ejemplares.length" class="text-center py-6">
                <div class="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-2">
                  <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p class="text-sm font-medium text-slate-600">No hay ejemplares disponibles</p>
                <p class="text-xs text-slate-400 mt-1">Todos los ejemplares están prestados</p>
              </div>

              <!-- Lista de ejemplares -->
              <div v-else-if="ejemplares.length" class="space-y-2">
                <button v-for="ej in ejemplares" :key="ej.id_ejemplar" @click="selectedEjemplar = ej; step = 4" :class="[
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left',
                  selectedEjemplar?.id_ejemplar === ej.id_ejemplar
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                ]">
                  <div :class="[
                    'w-2 h-2 rounded-full flex-shrink-0',
                    ej.estadoEjemplar === 'DISPONIBLE' ? 'bg-emerald-500' : 'bg-slate-300'
                  ]" />
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-slate-800">{{ ej.codigo_ejemplar }}</p>
                    <p class="text-xs text-slate-400">{{ ej.estadoEjemplar }}</p>
                  </div>
                  <div v-if="selectedEjemplar?.id_ejemplar === ej.id_ejemplar"
                    class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </button>
              </div>

              <!-- Placeholder -->
              <div v-else class="text-center py-6 text-slate-300">
                <svg class="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                </svg>
                <p class="text-sm">Selecciona un libro primero</p>
              </div>
            </div>
          </div>

          <!-- PASO 4: Confirmar -->
          <div :class="[
            'rounded-2xl border transition-all overflow-hidden',
            step >= 4 ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-40 pointer-events-none'
          ]">
            <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
              <div :class="[
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                confirmSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
              ]">4</div>
              <span class="font-semibold text-slate-800">Confirmar Préstamo</span>
            </div>

            <div class="p-5 space-y-4">
              <!-- Éxito -->
              <div v-if="confirmSuccess" class="text-center py-4">
                <div class="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p class="font-semibold text-slate-800">¡Préstamo registrado!</p>
                <p class="text-xs text-slate-400 mt-1">Redirigiendo...</p>
              </div>

              <template v-else>
                <!-- Resumen -->
                <div v-if="selectedUser && selectedEjemplar" class="bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Usuario</span>
                    <span class="font-medium text-slate-800 capitalize">{{ selectedUser.persona.nombreCompleto }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Libro</span>
                    <span class="font-medium text-slate-800 text-right max-w-[60%] truncate">{{ selectedBook?.titulo
                    }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">Ejemplar</span>
                    <span class="font-medium text-slate-800">{{ selectedEjemplar.codigo_ejemplar }}</span>
                  </div>
                </div>

                <!-- Fecha devolución -->
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Fecha de devolución estimada</label>
                  <input v-model="fechaDevolucion" type="date"
                    class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
                </div>

                <!-- Observaciones -->
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Observaciones (opcional)</label>
                  <textarea v-model="observaciones" rows="2" placeholder="Notas adicionales..."
                    class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none" />
                </div>

                <!-- Error -->
                <div v-if="confirmError"
                  class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {{ confirmError }}
                </div>

                <!-- Botón -->
                <button @click="confirmarPrestamo" :disabled="!canConfirm || confirmLoading" :class="[
                  'w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  canConfirm && !confirmLoading
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                ]">
                  <svg v-if="confirmLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ confirmLoading ? 'Registrando...' : 'Confirmar Préstamo' }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ HISTORIAL ═══════════════════ -->
    <div v-if="activeTab === 'lista'" class="space-y-4">

      <!-- Filtros -->
      <div class="flex flex-wrap gap-2">
        <button v-for="f in ['TODOS', 'ACTIVO', 'RENOVADO', 'DEVUELTO', 'VENCIDO']" :key="f"
          @click="filtroEstado = f as typeof filtroEstado" :class="[
            'px-4 py-1.5 rounded-full text-xs font-semibold transition-all border',
            filtroEstado === f
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
          ]">
          {{ f }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="prestamosLoading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="h-20 bg-slate-100 rounded-2xl animate-pulse" />
      </div>

      <!-- Sin datos -->
      <div v-else-if="!prestamos.length" class="bg-white rounded-2xl border border-slate-200 py-16 text-center">
        <div class="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg class="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p class="font-medium text-slate-500">No hay préstamos</p>
        <p class="text-sm text-slate-400 mt-1">No se encontraron registros con este filtro</p>
      </div>

      <!-- Lista -->
      <div v-else class="space-y-3">
        <div v-for="p in prestamos" :key="p.id_prestamo"
          class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4">
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
            <!-- Info principal -->
            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoClasses(p)]">
                  {{ estadoLabel(p) }}
                </span>
                <span class="text-xs text-slate-400">#{{ p.id_prestamo }}</span>
              </div>
              <p class="font-semibold text-slate-800 truncate">
                {{ p.ejemplar?.libro?.titulo ?? 'Libro desconocido' }}
              </p>
              <div class="flex flex-wrap gap-3 text-xs text-slate-500">
                <span class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ p.usuario?.persona?.nombreCompleto ?? p.usuario?.username ?? '—' }}
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {{ p.ejemplar?.codigo_ejemplar ?? '—' }}
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Préstamo: {{ formatDate(p.fechaPrestamo) }}
                </span>
                <span v-if="p.fechaDevolucionEstimada"
                  :class="['flex items-center gap-1', p.vencido ? 'text-red-500 font-medium' : '']">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Vence: {{ formatDate(p.fechaDevolucionEstimada) }}
                </span>
              </div>
            </div>

            <!-- Acciones -->
            <div v-if="p.estadoPrestamo !== 'DEVUELTO'" class="flex gap-2 flex-shrink-0">
              <button v-if="!p.vencido" @click="renovarPrestamo(p.id_prestamo)"
                :disabled="renovarLoading === p.id_prestamo"
                class="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                <svg v-if="renovarLoading === p.id_prestamo" class="w-3.5 h-3.5 animate-spin" fill="none"
                  viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Renovar
              </button>
              <button @click="devolverPrestamo(p.id_prestamo)" :disabled="devolucionLoading === p.id_prestamo"
                class="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                <svg v-if="devolucionLoading === p.id_prestamo" class="w-3.5 h-3.5 animate-spin" fill="none"
                  viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Devolver
              </button>
            </div>
            <div v-else class="flex-shrink-0">
              <span class="text-xs text-slate-400">Devuelto: {{ formatDate(p.fechaDevolucionReal) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>