<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/services/axios'
import defaultBookImage from '../../assets/book-default.jpeg'

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
  ubicacionFisica?: string
  edicion?: { titulo?: string; editorial?: string; edicion?: string; anoPublicacion?: number; isbn?: string; imagenPortada?: string }
}

const CONDICIONES = ['EXCELENTE', 'BUENO', 'REGULAR', 'DAÑADO'] as const
type Condicion = typeof CONDICIONES[number]

const condicionColors: Record<Condicion, string> = {
  EXCELENTE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  BUENO: 'border-blue-500 bg-blue-50 text-blue-700',
  REGULAR: 'border-amber-500 bg-amber-50 text-amber-700',
  DAÑADO: 'border-red-500 bg-red-50 text-red-700',
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

function selectUser(u: UsuarioResult) {
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

    const user = auth.user

    // ✅ Validar roles (opcional aquí, dependiendo de tu lógica)
    const roles = user?.roles || []
    const autorizado =
      roles.includes('ROLE_BIBLIOTECARIO') ||
      roles.includes('ROLE_AUXILIAR')

    // 👇 Puedes decidir si bloquear o no la búsqueda
    // (yo recomiendo NO bloquearla, solo filtrar si aplica)

    // ✅ Obtener biblioteca (si existe)
    const bibliotecaId = user?.biblioteca?.[0]?.id_biblioteca

    // ✅ Construir params dinámicamente
    const params: any = { q }

    if (autorizado && bibliotecaId) {
      params.bibliotecaId = bibliotecaId
    }
    const { data } = await api.get('/libros/search', { params })
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
  fetchEjemplares(b.idLibro)
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
    const roles = auth.user?.roles || []
    const autorizado =
      roles.includes('ROLE_BIBLIOTECARIO') ||
      roles.includes('ROLE_AUXILIAR')
    if (!autorizado) {
      console.warn('Usuario no autorizado para préstamos')
      ejemplares.value = []
      return
    }

    // ✅ Obtener biblioteca del usuario
    const bibliotecaId = auth.user?.biblioteca?.[0]?.id_biblioteca
    if (!bibliotecaId) {
      console.warn('Usuario sin biblioteca asignada')
      ejemplares.value = []
      return
    }
    // const { data } = await api.get(`/ejemplares/libro/${libroId}/disponibles`)
    const { data } = await api.get(
      `/ejemplares/libro/${libroId}/biblioteca`,
      {
        params: {
          bibliotecaId: bibliotecaId,
          estado: 'DISPONIBLE'
        }
      }
    )

    ejemplares.value = data.data ?? []
  } catch {
    ejemplares.value = []
  } finally {
    ejemplaresLoading.value = false
  }
}

// ─── PASO 4: Confirmación ─────────────────────────────────────────────────────
const fechaDevolucion = ref(defaultDevolucion())
const condicionEntrega = ref<Condicion>('BUENO')
const tipoDocumento = ref<'CI' | 'MATRICULA'>('CI')
const observaciones = ref('')
const confirmLoading = ref(false)
const confirmError = ref<string | null>(null)
const confirmSuccess = ref(false)
const prestamoCreado = ref<{ id_prestamo: number } | null>(null)

function defaultDevolucion() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().split('T')[0]
}

const canConfirm = computed(() =>
  selectedUser.value && selectedEjemplar.value && fechaDevolucion.value && condicionEntrega.value
)

async function confirmarPrestamo() {
  if (!canConfirm.value) return
  confirmLoading.value = true
  confirmError.value = null
  confirmSuccess.value = false

  try {
    const bibliotecaId = auth.user?.biblioteca?.id_biblioteca ?? auth.user?.biblioteca?.[0]?.id_biblioteca
    const { data } = await api.post('/prestamos', {
      ejemplarId: selectedEjemplar.value!.id_ejemplar,
      usuarioId: selectedUser.value!.id_usuario,
      bibliotecaId,
      tipoDocumentoGarantia: tipoDocumento.value,
      condicionEntrega: condicionEntrega.value,
      fechaDevolucionEstimada: fechaDevolucion.value,
      observaciones: observaciones.value || `Préstamo registrado`,
    })
    prestamoCreado.value = data.data
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
  condicionEntrega.value = 'BUENO'; tipoDocumento.value = 'CI'
  observaciones.value = ''
  confirmSuccess.value = false
  confirmError.value = null
  prestamoCreado.value = null
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
  <!-- Todo el contenido que estaba dentro de v-if="activeTab === 'nuevo'" -->
  <div class="space-y-6">

    <!-- Stepper -->
    <div class="flex items-center gap-0">
      <template v-for="(label, i) in ['Buscar Usuario', 'Buscar Libro', 'Seleccionar Ejemplar', 'Confirmar']" :key="i">
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
                <!-- <p class="text-xs text-slate-500">ISBN: {{ selectedBook.isbn }} · {{ selectedBook.editorial }}</p> -->
                <p class="text-xs text-slate-500">Idioma: {{ selectedBook.idioma }} · {{ selectedBook.descripcion }}
                </p>
              </div>
              <span :class="[
                'text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0',
                selectedBook.ejemplaresDisponibles > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              ]">
                {{
                  // selectedBook.ejemplaresDisponibles > 0 ? `${selectedBook.ejemplaresDisponibles} disp.` : 'No disp.'
                  selectedBook.ejemplaresDisponibles > 0 ? `${ejemplares.length} disp.` : 'No disp.'
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
            <div v-else-if="ejemplares.length" class="space-y-3">
              <button v-for="ej in ejemplares" :key="ej.id_ejemplar" @click="selectedEjemplar = ej; step = 4" :class="[
                'w-full flex gap-4 px-4 py-3 rounded-xl border-2 transition-all text-left',
                selectedEjemplar?.id_ejemplar === ej.id_ejemplar
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
              ]">
                <!-- 📘 Imagen -->
                <img :src="ej.edicion?.imagenPortada || defaultBookImage" alt="portada"
                  class="w-14 h-20 object-cover rounded-lg border" />

                <!-- 📄 Info -->
                <div class="flex-1">
                  <!-- Título -->
                  <p class="text-sm font-semibold text-slate-800">
                    {{ ej.edicion?.titulo }}
                  </p>

                  <!-- Código -->
                  <p class="text-xs text-slate-400">
                    Código: {{ ej.codigoEjemplar }}
                  </p>

                  <!-- Detalles edición -->
                  <p class="text-xs text-slate-500">
                    {{ ej.edicion?.editorial }} · {{ ej.edicion?.edicion }} · {{ ej.edicion?.anoPublicacion }}
                  </p>

                  <!-- ISBN -->
                  <p class="text-xs text-slate-400">
                    ISBN: {{ ej.edicion?.isbn }}
                  </p>

                  <!-- Ubicación -->
                  <p class="text-xs text-indigo-500 font-medium">
                    📍 {{ ej.ubicacionFisica }}
                  </p>
                </div>

                <!-- Estado -->
                <div class="flex flex-col items-end justify-between">
                  <div :class="[
                    'w-2 h-2 rounded-full',
                    ej.estadoEjemplar === 'DISPONIBLE'
                      ? 'bg-emerald-500'
                      : 'bg-slate-300'
                  ]" />

                  <!-- Check -->
                  <div v-if="selectedEjemplar?.id_ejemplar === ej.id_ejemplar"
                    class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
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
                  <span class="font-medium text-slate-800">{{ selectedEjemplar.codigoEjemplar }}</span>
                </div>
              </div>

              <!-- Condición de entrega -->
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-2">Condición física al entregar <span
                    class="text-red-400">*</span></label>
                <div class="grid grid-cols-4 gap-1.5">
                  <button v-for="c in CONDICIONES" :key="c" @click="condicionEntrega = c"
                    :class="['py-2 px-1 rounded-lg border-2 text-xs font-semibold transition-all',
                      condicionEntrega === c ? condicionColors[c] : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                    {{ c }}
                  </button>
                </div>
              </div>


              <!-- Tipo documento -->
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-2">
                  Documento de garantía <span class="text-red-400">*</span>
                </label>

                <div class="grid grid-cols-2 gap-2">
                  <button v-for="t in ['CI', 'MATRICULA']" :key="t" @click="tipoDocumento = t as 'CI' | 'MATRICULA'"
                    :class="[
                      'py-2 rounded-lg border-2 text-xs font-semibold transition-all',
                      tipoDocumento === t
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                    ]">
                    {{ t === 'CI' ? '🪪 Carnet de Identidad' : '🎓 Matrícula' }}
                  </button>
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
</template>