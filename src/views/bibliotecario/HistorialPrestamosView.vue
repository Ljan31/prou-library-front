<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useMedia } from '@/composables/useMedia'
import { usePagination, parsePageResponse, PAGINATION_MODE } from '@/composables/usePagination'
import SPagination from '@/components/ui/SPagination.vue'
import defaultBookImage from '../../assets/book-default.jpeg'
import TicketPrestamo, { type Prestamo, type UsuarioTicket } from '@/components/bibliotecas/TicketPrestamo.vue'
import api from '@/services/axios'

const ui = useUiStore()
const auth = useAuthStore()
const { getUrl } = useMedia()

onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Préstamos', to: '/prestamos' },
    { label: 'Historial' }
  ])
  fetchPrestamos()
})

// ─── Filtros ──────────────────────────────────────────────────────────────────
type FiltroEstado = 'TODOS' | 'ACTIVO' | 'RENOVADO' | 'DEVUELTO' | 'VENCIDO'
const FILTROS: { v: FiltroEstado; l: string }[] = [
  { v: 'TODOS', l: 'Todos' },
  { v: 'ACTIVO', l: 'Activo' },
  { v: 'RENOVADO', l: 'Renovado' },
  { v: 'DEVUELTO', l: 'Devuelto' },
  { v: 'VENCIDO', l: 'Vencido' },
]

const filtroEstado = ref<FiltroEstado>('TODOS')
const busqueda = ref('')
const busquedaDebounced = ref('')
let busquedaTimer: ReturnType<typeof setTimeout>

watch(busqueda, (v) => {
  clearTimeout(busquedaTimer)
  busquedaTimer = setTimeout(() => { busquedaDebounced.value = v }, 300)
})

// ─── Datos ────────────────────────────────────────────────────────────────────
const prestamos = ref<Prestamo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const isServerPagination = PAGINATION_MODE === 'server'

// Filtro local por búsqueda. En modo server lo resuelve el back (param `q`).
const prestamosFiltrados = computed(() => {
  const q = busquedaDebounced.value.trim().toLowerCase()
  if (isServerPagination || !q) return prestamos.value
  return prestamos.value.filter(p => {
    const titulo = p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? ''
    const nombre = p.usuario?.nombreCompleto ?? p.usuario?.username ?? ''
    const codigo = p.ejemplar?.codigoEjemplar ?? p.ejemplar?.codigo_ejemplar ?? ''
    const ci = p.usuario?.ci?.toString() ?? ''
    const id = String(p.id_prestamo)
    return titulo.toLowerCase().includes(q) || nombre.toLowerCase().includes(q) ||
      codigo.toLowerCase().includes(q) || ci.includes(q) || id.includes(q)
  })
})

// ─── Paginación ───────────────────────────────────────────────────────────────
const pagination = usePagination({ items: prestamosFiltrados, pageSize: 10 })
const { page, pageSize, total: totalItems, paginatedItems: prestamosPagina } = pagination

// Cualquier cambio de filtro vuelve a la página 1 (sync → evita un fetch doble)
watch([filtroEstado, busquedaDebounced], () => { page.value = 1 }, { flush: 'sync' })

// client: solo refetch al cambiar el estado · server: también búsqueda, página y tamaño
const fetchTrigger = computed(() => isServerPagination
  ? [filtroEstado.value, busquedaDebounced.value, page.value, pageSize.value]
  : [filtroEstado.value])
watch(fetchTrigger, fetchPrestamos)

async function fetchPrestamos() {
  loading.value = true
  error.value = null
  try {
    const roles = auth.user?.roles ?? []
    const bibliotecaId = auth.user?.biblioteca?.[0]?.id_biblioteca
    const esAdmin = roles.includes('ROLE_ADMIN')
    const esBiblio = roles.includes('ROLE_BIBLIOTECARIO') || roles.includes('ROLE_AUXILIAR')

    const estado = filtroEstado.value
    // VENCIDO no es un estado del back: se deriva de `p.vencido`
    const filtraPorEstado = estado !== 'TODOS' && estado !== 'VENCIDO'
    const params: Record<string, unknown> = {}
    let url = ''

    if (esAdmin) {
      url = filtraPorEstado ? `/prestamos/estado/${estado}` : '/prestamos'
    } else if (esBiblio && bibliotecaId) {
      url = `/prestamos/biblioteca/${bibliotecaId}`
      if (filtraPorEstado) params.estado = estado
    } else {
      prestamos.value = []
      if (isServerPagination) pagination.setTotal(0)
      return
    }

    // Cuando el back soporte paginación: page/size + búsqueda del lado del servidor
    if (isServerPagination) {
      Object.assign(params, pagination.apiParams.value)
      if (busquedaDebounced.value.trim()) params.q = busquedaDebounced.value.trim()
      if (estado === 'VENCIDO') params.vencido = true // TODO: confirmar nombre del param con el back
    }

    const { data } = await api.get(url, { params })
    const parsed = parsePageResponse<Prestamo>(data)

    // En modo client el filtro "vencido" se aplica aquí; en server lo hace el back
    prestamos.value = !isServerPagination && estado === 'VENCIDO'
      ? parsed.items.filter(p => p.vencido)
      : parsed.items
    if (isServerPagination) pagination.setTotal(parsed.total)
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'No se pudo cargar el historial de préstamos'
    prestamos.value = []
  } finally {
    loading.value = false
  }
}

// ─── Stats rápidas ────────────────────────────────────────────────────────────
// ⚠️ En modo server reflejan solo la página cargada; deberían venir del back.
const stats = computed(() => ({
  total: prestamos.value.length,
  activos: prestamos.value.filter(p => p.estadoPrestamo !== 'DEVUELTO' && !p.vencido).length,
  vencidos: prestamos.value.filter(p => p.vencido && p.estadoPrestamo !== 'DEVUELTO').length,
  devueltos: prestamos.value.filter(p => p.estadoPrestamo === 'DEVUELTO').length,
}))

// ─── Modal de detalles ────────────────────────────────────────────────────────
const modalDetalleOpen = ref(false)
const prestamoSeleccionado = ref<Prestamo | null>(null)

function verDetalles(p: Prestamo) {
  prestamoSeleccionado.value = p
  modalDetalleOpen.value = true
}

// ─── Ticket (reimprimir desde historial) ──────────────────────────────────────
const showTicket = ref(false)
const ticketPrestamos = ref<Prestamo[]>([])
const ticketUsuario = ref<UsuarioTicket | null>(null)
const ticketTipo = ref<'DOMICILIO' | 'SALA'>('DOMICILIO')
const ticketFechaDevolucion = ref('')

function abrirTicket(p: Prestamo) {
  const usr = p.usuario
  if (usr) {
    ticketUsuario.value = {
      id_usuario: usr.id_usuario ?? 0,
      persona: {
        nombreCompleto: usr.nombreCompleto ?? usr.username ?? '',
        ci: usr.ci ?? '',
        matricula: usr.matricula ?? null,
        domicilio: usr.domicilio,
        celular: usr.celular,
      },
    }
  }
  ticketPrestamos.value = [p]
  ticketTipo.value = p.tipoPrestamo === 'SALA' ? 'SALA' : 'DOMICILIO'
  ticketFechaDevolucion.value = p.fechaDevolucionEstimada ?? ''
  showTicket.value = true
}

// ─── Renovar ──────────────────────────────────────────────────────────────────
const renovarModal = ref(false)
const prestamoARenovar = ref<Prestamo | null>(null)
const motivoRenovacion = ref('')
const renovarLoading = ref(false)

function abrirRenovar(p: Prestamo) {
  prestamoARenovar.value = p
  motivoRenovacion.value = ''
  renovarModal.value = true
}

function cerrarRenovar() {
  renovarModal.value = false
  prestamoARenovar.value = null
  motivoRenovacion.value = ''
}

async function confirmarRenovacion() {
  if (!prestamoARenovar.value) return
  renovarLoading.value = true
  try {
    await api.post('/prestamos/renovar', {
      prestamoId: prestamoARenovar.value.id_prestamo,
      motivo: motivoRenovacion.value || 'Renovación solicitada',
    })
    ui.toast.success('Renovado', 'El préstamo fue renovado correctamente')
    cerrarRenovar()
    fetchPrestamos()
  } catch {
    ui.toast.error('Error', 'No se puede renovar este préstamo')
  } finally {
    renovarLoading.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function estadoClasses(p: Prestamo) {
  if (p.vencido && p.estadoPrestamo !== 'DEVUELTO') return 'bg-red-100 text-red-700'
  switch (p.estadoPrestamo) {
    case 'ACTIVO': return 'bg-emerald-100 text-emerald-700'
    case 'RENOVADO': return 'bg-blue-100 text-blue-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function estadoLabel(p: Prestamo) {
  if (p.vencido && p.estadoPrestamo !== 'DEVUELTO') return 'VENCIDO'
  return p.estadoPrestamo
}

function formatDate(s?: string) {
  if (!s) return '—'
  const [year, month, day] = s.substring(0, 10).split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${day} ${meses[Number(month) - 1]} ${year}`
}

function diasRestantes(fecha?: string): number | null {
  if (!fecha) return null
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
}

function venceClasses(p: Prestamo) {
  if (p.vencido) return 'text-red-500 font-medium'
  if ((diasRestantes(p.fechaDevolucionEstimada) ?? 99) <= 3) return 'text-amber-500 font-medium'
  return 'text-slate-500'
}

function condicionColor(c?: string) {
  switch (c) {
    case 'EXCELENTE': return 'text-emerald-600'
    case 'BUENO': return 'text-blue-600'
    case 'REGULAR': return 'text-amber-600'
    case 'DAÑADO': return 'text-red-600'
    default: return 'text-slate-400'
  }
}
</script>

<template>
  <div class="space-y-5">

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Total</p>
        <p class="text-2xl font-bold text-slate-800">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-xl border border-emerald-200 p-4">
        <p class="text-xs text-slate-400 mb-1">En curso</p>
        <p class="text-2xl font-bold text-emerald-600">{{ stats.activos }}</p>
      </div>
      <div class="bg-white rounded-xl border border-red-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Vencidos</p>
        <p class="text-2xl font-bold text-red-500">{{ stats.vencidos }}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Devueltos</p>
        <p class="text-2xl font-bold text-slate-600">{{ stats.devueltos }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">

      <!-- Búsqueda -->
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none"
          stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input v-model="busqueda" type="text" placeholder="Buscar por libro, usuario, CI o código..."
          class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
      </div>

      <!-- Filtro estado -->
      <div class="flex flex-wrap gap-1">
        <button v-for="f in FILTROS" :key="f.v" @click="filtroEstado = f.v" :class="['px-3 h-9 rounded-lg text-xs font-medium transition-all border',
          filtroEstado === f.v
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600']">
          {{ f.l }}
        </button>
      </div>

      <!-- Refresh -->
      <button @click="fetchPrestamos"
        class="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all"
        title="Actualizar" aria-label="Actualizar">
        <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Tabla / Lista -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">

      <!-- Loading skeletons -->
      <div v-if="loading" class="p-4 space-y-3">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <div class="w-8 h-11 rounded bg-slate-100 animate-pulse shrink-0" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3 bg-slate-100 rounded animate-pulse w-2/5" />
            <div class="h-2.5 bg-slate-100 rounded animate-pulse w-1/3" />
          </div>
          <div class="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
          <div class="h-6 w-12 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="text-sm text-slate-500">{{ error }}</p>
        <button @click="fetchPrestamos" class="text-sm text-indigo-600 hover:underline">Reintentar</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!prestamosFiltrados.length" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-sm font-medium text-slate-500">No se encontraron préstamos</p>
        <p class="text-xs text-slate-400">Prueba con otros filtros</p>
      </div>

      <!-- Tabla de datos -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/60">
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3">Libro</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden md:table-cell">Usuario</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden lg:table-cell">Prestado</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden sm:table-cell">Vence</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden xl:table-cell">Condición</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3">Estado</th>
              <th class="text-right text-xs font-medium text-slate-500 px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="p in prestamosPagina" :key="p.id_prestamo" class="hover:bg-slate-50/60 transition-colors">

              <!-- Libro -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <img :src="getUrl(p.ejemplar?.edicion?.imagenPortada) || defaultBookImage" alt=""
                    class="w-8 h-11 object-cover rounded border border-slate-100 shrink-0" />
                  <div class="min-w-0">
                    <p class="font-medium text-slate-800 text-sm truncate max-w-[16rem]">
                      {{ p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? 'Libro desconocido' }}
                    </p>
                    <p class="text-xs text-slate-400">
                      <span class="font-mono text-indigo-600">{{ p.ejemplar?.codigoEjemplar ?? p.ejemplar?.codigo_ejemplar ?? '—' }}</span>
                      · #{{ p.id_prestamo }}
                    </p>
                  </div>
                </div>
              </td>

              <!-- Usuario -->
              <td class="px-4 py-3 hidden md:table-cell">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs shrink-0">
                    {{ ((p.usuario?.nombreCompleto ?? p.usuario?.username)?.[0] ?? '?').toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-slate-800 text-sm truncate capitalize">
                      {{ p.usuario?.nombreCompleto ?? p.usuario?.username ?? '—' }}
                    </p>
                    <p class="text-xs text-slate-400">CI: {{ p.usuario?.ci ?? '—' }}</p>
                  </div>
                </div>
              </td>

              <!-- Prestado -->
              <td class="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                {{ formatDate(p.fechaPrestamo) }}
              </td>

              <!-- Vence / Devuelto -->
              <td class="px-4 py-3 hidden sm:table-cell">
                <span v-if="p.estadoPrestamo === 'DEVUELTO'" class="text-xs text-slate-400">
                  Devuelto {{ formatDate(p.fechaDevolucionReal) }}
                </span>
                <span v-else class="text-xs" :class="venceClasses(p)">
                  {{ formatDate(p.fechaDevolucionEstimada) }}
                  <span v-if="!p.vencido && (diasRestantes(p.fechaDevolucionEstimada) ?? 99) <= 3">
                    ({{ diasRestantes(p.fechaDevolucionEstimada) }}d)
                  </span>
                </span>
              </td>

              <!-- Condición -->
              <td class="px-4 py-3 text-xs hidden xl:table-cell">
                <template v-if="p.condicionEntrega">
                  <span :class="condicionColor(p.condicionEntrega)">{{ p.condicionEntrega }}</span>
                  <span v-if="p.condicionDevolucion" class="text-slate-400"> → <span
                      :class="condicionColor(p.condicionDevolucion)">{{ p.condicionDevolucion }}</span></span>
                </template>
                <span v-else class="text-slate-300">—</span>
              </td>

              <!-- Estado -->
              <td class="px-4 py-3">
                <span :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoClasses(p)]">
                  {{ estadoLabel(p) }}
                </span>
                <p v-if="p.renovaciones && p.renovaciones > 0" class="text-xs text-blue-500 mt-1">
                  {{ p.renovaciones }}x renovado
                </p>
              </td>

              <!-- Acciones -->
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Ver detalles -->
                  <button @click="verDetalles(p)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Ver detalles" aria-label="Ver detalles">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>

                  <!-- Ticket -->
                  <button v-if="p.estadoPrestamo !== 'DEVUELTO' || p.tipoPrestamo === 'DOMICILIO'"
                    @click="abrirTicket(p)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Ver ticket" aria-label="Ver ticket">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </button>

                  <!-- Renovar -->
                  <button v-if="p.estadoPrestamo !== 'DEVUELTO' && !p.vencido" @click="abrirRenovar(p)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Renovar préstamo" aria-label="Renovar préstamo">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Paginación -->
        <div class="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <SPagination v-model:page="page" v-model:page-size="pageSize" :total="totalItems" :loading="loading"
            item-label="préstamo(s)">
            <template #summary-extra>
              <span v-if="busquedaDebounced" class="text-slate-400">· filtrado por "{{ busquedaDebounced }}"</span>
            </template>
          </SPagination>
        </div>
      </div>
    </div>

    <!-- ==================== MODAL DETALLES ==================== -->
    <Teleport to="body">
      <div v-if="modalDetalleOpen && prestamoSeleccionado"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="modalDetalleOpen = false">

        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">📄</div>
              <span class="font-semibold text-slate-800">Detalle #{{ prestamoSeleccionado.id_prestamo }}</span>
            </div>
            <button @click="modalDetalleOpen = false" class="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Cerrar">✕</button>
          </div>

          <!-- Contenido -->
          <div class="p-6 space-y-5">

            <!-- Libro -->
            <div class="flex gap-4">
              <img :src="getUrl(prestamoSeleccionado.ejemplar?.edicion?.imagenPortada) || defaultBookImage"
                class="w-16 h-24 object-cover rounded-xl border" alt="" />
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-slate-800 leading-tight line-clamp-2">
                  {{ prestamoSeleccionado.ejemplar?.edicion?.titulo ?? prestamoSeleccionado.ejemplar?.libro?.titulo }}
                </p>
                <p class="text-xs text-indigo-500 mt-0.5">
                  Edicion: {{ prestamoSeleccionado.ejemplar?.edicion?.edicion }} •
                  {{ prestamoSeleccionado.ejemplar?.edicion?.anoPublicacion }}
                </p>
                <p class="text-xs text-slate-500 mt-1">
                  Código: {{ prestamoSeleccionado.ejemplar?.codigoEjemplar ??
                    prestamoSeleccionado.ejemplar?.codigo_ejemplar }}
                </p>
                <span :class="[
                  'px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  prestamoSeleccionado.ejemplar?.estadoEjemplar === 'PRESTADO'
                    ? 'bg-blue-100 text-blue-700'
                    : prestamoSeleccionado.ejemplar?.estadoEjemplar === 'DISPONIBLE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : prestamoSeleccionado.ejemplar?.estadoEjemplar === 'DANADO'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                ]">
                  {{ prestamoSeleccionado.ejemplar?.estadoEjemplar }}
                </span>
              </div>
            </div>

            <!-- Info rápida -->
            <div class="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-500">Usuario</span>
                <span class="font-medium text-right max-w-[60%] truncate">
                  {{ prestamoSeleccionado.usuario?.nombreCompleto ?? prestamoSeleccionado.usuario?.username }}
                </span>
                <span class="text-slate-500">CI</span>
                <span class="px-2 py-0.5 bg-slate-200 rounded text-xs font-mono">
                  {{ prestamoSeleccionado.usuario?.ci }}
                </span>
              </div>

              <div class="flex justify-between">
                <span class="text-slate-500">Prestado</span>
                <span class="font-medium">{{ formatDate(prestamoSeleccionado.fechaPrestamo) }}</span>
              </div>

              <div class="flex justify-between">
                <span class="text-slate-500">Vence</span>
                <span :class="['font-medium', prestamoSeleccionado.vencido ? 'text-red-500' : '']">
                  {{ formatDate(prestamoSeleccionado.fechaDevolucionEstimada) }}
                </span>
              </div>

              <div v-if="prestamoSeleccionado.fechaDevolucionReal" class="flex justify-between">
                <span class="text-slate-500">Devuelto</span>
                <span class="font-medium text-emerald-600">
                  {{ formatDate(prestamoSeleccionado.fechaDevolucionReal) }}
                </span>
              </div>
            </div>

            <div class="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-slate-500">Atendido por</span>
                <span class="font-medium text-right max-w-[60%] truncate">
                  {{ prestamoSeleccionado.bibliotecarioPrestamo?.nombreCompleto ?? '—' }}
                </span>
                <span class="text-slate-500">CI</span>
                <span class="font-medium">{{ prestamoSeleccionado.bibliotecarioPrestamo?.ci ?? '—' }}</span>
              </div>

              <div v-if="prestamoSeleccionado.bibliotecarioDevolucion" class="flex justify-between">
                <span class="text-slate-500">Recibido por</span>
                <span class="font-medium text-right max-w-[60%] truncate">
                  {{ prestamoSeleccionado.bibliotecarioDevolucion?.nombreCompleto }}
                </span>
                <span class="text-slate-500">CI</span>
                <span class="font-medium">{{ prestamoSeleccionado.bibliotecarioDevolucion?.ci ?? '—' }}</span>
              </div>
            </div>

            <!-- Condición -->
            <div v-if="prestamoSeleccionado.condicionEntrega" class="space-y-2 text-sm">
              <p class="text-xs text-slate-500">Condición</p>
              <div class="flex justify-between">
                <span class="text-slate-500">Entrega</span>
                <span :class="condicionColor(prestamoSeleccionado.condicionEntrega)" class="font-medium">
                  {{ prestamoSeleccionado.condicionEntrega }}
                </span>
              </div>
              <div v-if="prestamoSeleccionado.condicionDevolucion" class="flex justify-between">
                <span class="text-slate-500">Devolución</span>
                <span :class="condicionColor(prestamoSeleccionado.condicionDevolucion)" class="font-medium">
                  {{ prestamoSeleccionado.condicionDevolucion }}
                </span>
              </div>
            </div>

            <!-- Observaciones -->
            <div v-if="prestamoSeleccionado.observaciones"
              class="bg-amber-50 rounded-xl p-4 text-sm border border-amber-100">
              <p class="text-xs font-semibold text-amber-600 mb-1">Observaciones</p>
              <p class="text-slate-700 text-xs leading-relaxed">{{ prestamoSeleccionado.observaciones }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-slate-100 flex gap-2 shrink-0">
            <button @click="abrirTicket(prestamoSeleccionado!); modalDetalleOpen = false"
              class="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Ticket
            </button>
            <button @click="modalDetalleOpen = false"
              class="flex-1 px-5 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ─── Modal de Renovación ────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="renovarModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="cerrarRenovar">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span class="font-semibold text-slate-800">Renovar Préstamo</span>
            </div>
            <button @click="cerrarRenovar" class="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Cerrar">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <div v-if="prestamoARenovar" class="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div class="flex justify-between gap-2">
                <span class="text-slate-500">Préstamo</span>
                <span class="font-medium">#{{ prestamoARenovar.id_prestamo }}</span>
              </div>
              <div class="flex justify-between gap-2">
                <span class="text-slate-500">Libro</span>
                <span class="font-medium text-right max-w-[60%] truncate">
                  {{ prestamoARenovar.ejemplar?.edicion?.titulo ?? prestamoARenovar.ejemplar?.libro?.titulo ?? '—' }}
                </span>
              </div>
              <div class="flex justify-between gap-2">
                <span class="text-slate-500">Vence</span>
                <span class="font-medium">{{ formatDate(prestamoARenovar.fechaDevolucionEstimada) }}</span>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Motivo de renovación (opcional)</label>
              <textarea v-model="motivoRenovacion" rows="3"
                placeholder="Ej: Necesito más tiempo para terminar el capítulo..."
                class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none" />
            </div>

            <div class="flex gap-2 pt-1">
              <button @click="cerrarRenovar"
                class="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button @click="confirmarRenovacion" :disabled="renovarLoading"
                :class="['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  !renovarLoading ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-blue-300 text-white cursor-not-allowed']">
                <svg v-if="renovarLoading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {{ renovarLoading ? 'Renovando...' : 'Confirmar Renovación' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ─── TICKET (componente reutilizable) ────────────────────────────────── -->
    <TicketPrestamo v-model="showTicket" :prestamos="ticketPrestamos" :usuario="ticketUsuario" :tipo="ticketTipo"
      :fecha-devolucion="ticketFechaDevolucion" :biblioteca-nombre="auth.bibliotecaNombre[0]"
      :logo="auth.user?.biblioteca?.[0]?.logoUrl" />

  </div>
</template>

<style scoped>
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.animate-scale-in {
  animation: scale-in 0.15s ease-out;
}
</style>