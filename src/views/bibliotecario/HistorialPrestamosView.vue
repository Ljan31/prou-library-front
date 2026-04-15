<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import api from '@/services/axios'

const ui = useUiStore()

onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Préstamos', to: '/prestamos' },
    { label: 'Historial' }
  ])
  fetchPrestamos()
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'RENOVADO' | 'DEVUELTO'
  vencido: boolean
  renovaciones?: number
  condicionEntrega?: string
  condicionDevolucion?: string
  fechaPrestamo?: string
  fechaDevolucionEstimada?: string
  fechaDevolucionReal?: string
  usuario?: {
    id_usuario?: number
    persona?: { nombreCompleto?: string }
    username?: string
  }
  ejemplar?: {
    codigoEjemplar?: string
    codigo_ejemplar?: string
    libro?: { titulo?: string }
    edicion?: { titulo?: string; imagenPortada?: string }
  }
  biblioteca?: { nombre?: string }
}

// ─── Estado ───────────────────────────────────────────────────────────────────
const prestamos = ref<Prestamo[]>([])
const loading = ref(false)
const filtroEstado = ref<'TODOS' | 'ACTIVO' | 'RENOVADO' | 'DEVUELTO' | 'VENCIDO'>('TODOS')
const searchQuery = ref('')

async function fetchPrestamos() {
  loading.value = true
  try {
    let url = '/prestamos'
    if (filtroEstado.value !== 'TODOS' && filtroEstado.value !== 'VENCIDO') {
      url = `/prestamos/estado/${filtroEstado.value}`
    }
    const { data } = await api.get(url)
    let list: Prestamo[] = data.data ?? data ?? []
    if (filtroEstado.value === 'VENCIDO') list = list.filter(p => p.vencido)
    prestamos.value = list
  } catch {
    prestamos.value = []
  } finally {
    loading.value = false
  }
}

watch(filtroEstado, fetchPrestamos)

// Filtro local por búsqueda
const prestamosFiltrados = () => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return prestamos.value
  return prestamos.value.filter(p => {
    const titulo = p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? ''
    const nombre = p.usuario?.persona?.nombreCompleto ?? p.usuario?.username ?? ''
    const codigo = p.ejemplar?.codigoEjemplar ?? p.ejemplar?.codigo_ejemplar ?? ''
    return titulo.toLowerCase().includes(q) || nombre.toLowerCase().includes(q) || codigo.toLowerCase().includes(q)
  })
}

// ─── Renovar ─────────────────────────────────────────────────────────────────
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
const FILTROS = ['TODOS', 'ACTIVO', 'RENOVADO', 'DEVUELTO', 'VENCIDO'] as const

function estadoClasses(p: Prestamo) {
  if (p.vencido && p.estadoPrestamo !== 'DEVUELTO') return 'bg-red-100 text-red-700'
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

function estadoIcon(p: Prestamo) {
  if (p.vencido && p.estadoPrestamo !== 'DEVUELTO') return '🔴'
  switch (p.estadoPrestamo) {
    case 'ACTIVO': return '🟢'
    case 'RENOVADO': return '🔵'
    case 'DEVUELTO': return '⚪'
    default: return '⚪'
  }
}

function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function diasRestantes(fecha?: string): number | null {
  if (!fecha) return null
  const diff = new Date(fecha).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
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
  <div class="page-container space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Historial de Préstamos</h1>
        <p class="text-sm text-slate-500 mt-0.5">Consulta y gestiona todos los préstamos registrados</p>
      </div>
      <!-- Buscador inline -->
      <div class="relative w-full sm:w-72">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input v-model="searchQuery" type="text" placeholder="Buscar por usuario, libro..."
          class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all bg-white" />
      </div>
    </div>

    <!-- Filtros de estado -->
    <div class="flex flex-wrap gap-2">
      <button v-for="f in FILTROS" :key="f" @click="filtroEstado = f" :class="['px-4 py-1.5 rounded-full text-xs font-semibold transition-all border',
        filtroEstado === f
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600']">
        <span v-if="f === 'ACTIVO'">🟢 </span>
        <span v-else-if="f === 'RENOVADO'">🔵 </span>
        <span v-else-if="f === 'DEVUELTO'">⚪ </span>
        <span v-else-if="f === 'VENCIDO'">🔴 </span>
        {{ f }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="bg-white rounded-2xl border border-slate-200 p-4">
        <div class="flex gap-4 animate-pulse">
          <div class="w-12 h-16 bg-slate-100 rounded-lg flex-shrink-0" />
          <div class="flex-1 space-y-2 pt-1">
            <div class="h-4 bg-slate-100 rounded w-1/3" />
            <div class="h-3.5 bg-slate-100 rounded w-3/4" />
            <div class="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    </div>

    <!-- Sin datos -->
    <div v-else-if="!prestamosFiltrados().length"
      class="bg-white rounded-2xl border border-slate-200 py-16 text-center">
      <div class="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <svg class="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p class="font-medium text-slate-500">No hay préstamos</p>
      <p class="text-sm text-slate-400 mt-1">No se encontraron registros con este filtro</p>
    </div>

    <!-- Lista de préstamos -->
    <div v-else class="space-y-3">
      <div v-for="p in prestamosFiltrados()" :key="p.id_prestamo"
        class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4">
        <div class="flex flex-col sm:flex-row sm:items-start gap-4">

          <!-- Portada (si existe) -->
          <img v-if="p.ejemplar?.edicion?.imagenPortada" :src="p.ejemplar.edicion.imagenPortada" alt="portada"
            class="w-12 h-16 object-cover rounded-lg border border-slate-100 flex-shrink-0 hidden sm:block" />

          <!-- Info principal -->
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoClasses(p)]">
                {{ estadoIcon(p) }} {{ estadoLabel(p) }}
              </span>
              <span class="text-xs text-slate-400">#{{ p.id_prestamo }}</span>
              <span v-if="p.renovaciones && p.renovaciones > 0" class="text-xs text-blue-500 font-medium">
                {{ p.renovaciones }}x renovado
              </span>
            </div>

            <p class="font-semibold text-slate-800 truncate">
              {{ p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? 'Libro desconocido' }}
            </p>

            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="capitalize">{{ p.usuario?.persona?.nombreCompleto ?? p.usuario?.username ?? '—' }}</span>
              </span>
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {{ p.ejemplar?.codigoEjemplar ?? p.ejemplar?.codigo_ejemplar ?? '—' }}
              </span>
              <span class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Prestado: {{ formatDate(p.fechaPrestamo) }}
              </span>
              <!-- Fecha vence con alerta -->
              <span v-if="p.fechaDevolucionEstimada && p.estadoPrestamo !== 'DEVUELTO'"
                :class="['flex items-center gap-1 font-medium', p.vencido ? 'text-red-500' : (diasRestantes(p.fechaDevolucionEstimada) ?? 99) <= 3 ? 'text-amber-500' : 'text-slate-500']">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Vence: {{ formatDate(p.fechaDevolucionEstimada) }}
                <span v-if="!p.vencido && (diasRestantes(p.fechaDevolucionEstimada) ?? 99) <= 3">
                  ({{ diasRestantes(p.fechaDevolucionEstimada) }}d)
                </span>
              </span>
              <!-- Condición -->
              <span v-if="p.condicionEntrega" class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <span :class="condicionColor(p.condicionEntrega)">{{ p.condicionEntrega }}</span>
                <span v-if="p.condicionDevolucion"> → <span :class="condicionColor(p.condicionDevolucion)">{{
                  p.condicionDevolucion }}</span></span>
              </span>
            </div>
          </div>

          <!-- Acciones -->
          <div class="flex gap-2 flex-shrink-0 sm:flex-col sm:items-end">
            <!-- Renovar (solo activos no vencidos) -->
            <button v-if="p.estadoPrestamo !== 'DEVUELTO' && !p.vencido" @click="abrirRenovar(p)"
              class="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Renovar
            </button>
            <!-- Devuelto -->
            <span v-if="p.estadoPrestamo === 'DEVUELTO'" class="text-xs text-slate-400 whitespace-nowrap">
              Devuelto: {{ formatDate(p.fechaDevolucionReal) }}
            </span>
            <!-- Vencido sin devolver -->
            <span v-if="p.vencido && p.estadoPrestamo !== 'DEVUELTO'"
              class="text-xs font-semibold text-red-500 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01" />
              </svg>
              Vencido
            </span>
          </div>
        </div>
      </div>
    </div>

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
            <button @click="cerrarRenovar" class="text-slate-400 hover:text-slate-600 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Info del préstamo -->
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

            <!-- Motivo -->
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

  </div>
</template>

<style scoped>
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(4px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-scale-in {
  animation: scale-in 0.15s ease-out;
}
</style>