<script setup lang="ts">
/**
 * ReservasAdminView — Vista PROTEGIDA (ADMIN / BIBLIOTECARIO)
 * Gestión de reservas: stats, filtros estilo certificados, tabla, convertir retiro.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { reservasService } from '@/services/reservas.service'
import ConvertirReservaModal from '@/components/reservas/ConvertirReservaModal.vue'
import type { ReservaResponse } from '@/types/reservas'

const router = useRouter()
const ui = useUiStore()
const auth = useAuthStore()

// ─── Estado ───────────────────────────────────────────────────────────────
const todasLasReservas = ref<ReservaResponse[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)

type EstadoFiltro = '' | 'ACTIVA' | 'NOTIFICADA' | 'ATENDIDA' | 'CANCELADA' | 'VENCIDA'
const filtroEstado = ref<EstadoFiltro>('')
const busqueda = ref('')

const reservaAConvertir = ref<ReservaResponse | null>(null)

// Biblioteca del bibliotecario
const misBibliotecaId = computed(() => {
  const ids = auth.user.biblioteca.map((b: any) => b.id_biblioteca) ?? []
  return ids[0] ?? null
})

// ─── Stats ────────────────────────────────────────────────────────────────
const stats = computed(() => ({
  total: todasLasReservas.value.length,
  activas: todasLasReservas.value.filter(r => r.estadoReserva === 'ACTIVA').length,
  notificadas: todasLasReservas.value.filter(r => r.estadoReserva === 'NOTIFICADA').length,
  atendidas: todasLasReservas.value.filter(r => r.estadoReserva === 'ATENDIDA').length,
  canceladas: todasLasReservas.value.filter(r =>
    r.estadoReserva === 'CANCELADA' || r.estadoReserva === 'VENCIDA').length,
}))

// ─── Filtrado local ───────────────────────────────────────────────────────
const reservasFiltradas = computed(() => {
  let r = todasLasReservas.value

  if (filtroEstado.value) {
    r = r.filter(x => x.estadoReserva === filtroEstado.value)
  }

  if (busqueda.value.trim()) {
    const q = busqueda.value.toLowerCase()
    r = r.filter(x =>
      x.usuarioNombreCompleto.toLowerCase().includes(q) ||
      x.libroTitulo.toLowerCase().includes(q) ||
      x.ejemplarCodigo?.toLowerCase().includes(q),
    )
  }

  return r
})

onMounted(async () => {
  ui.setBreadcrumbs([{ label: 'Reservas' }])
  await cargar()
})

// Recargar cuando cambia el estado (para traer desde backend filtrado)
watch(filtroEstado, cargar)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    const bibliotecaId = misBibliotecaId.value ?? 1
    // Traer con el estado seleccionado (o sin filtro si es '')
    const { data } = await reservasService.byBiblioteca(
      bibliotecaId,
      // filtroEstado.value || undefined,
    )
    todasLasReservas.value = data
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar reservas'
    todasLasReservas.value = []
  } finally {
    cargando.value = false
  }
}

// ─── Acciones ─────────────────────────────────────────────────────────────
async function cancelarReserva(reserva: ReservaResponse) {
  if (!confirm(`¿Cancelar la reserva de "${reserva.libroTitulo}" para ${reserva.usuarioNombreCompleto}?`)) return
  try {
    await reservasService.cancelar(reserva.idReserva, 'Cancelado por el bibliotecario')
    ui.toast.success('Cancelada', 'La reserva fue cancelada.')
    await cargar()
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo cancelar')
  }
}

function abrirConvertir(reserva: ReservaResponse) {
  reservaAConvertir.value = reserva
}

async function onConvertida() {
  reservaAConvertir.value = null
  await cargar()
}

// ─── Helpers UI ───────────────────────────────────────────────────────────
type BadgeColor = {
  dot: string
  bg: string
  text: string
  border: string
}

const ESTADO_COLORS: Record<string, BadgeColor> = {
  ACTIVA: { dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  NOTIFICADA: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  ATENDIDA: { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  CANCELADA: { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  VENCIDA: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
}

function colorBadge(estado: string): BadgeColor {
  return ESTADO_COLORS[estado] ?? ESTADO_COLORS.ATENDIDA
}

function labelEstado(estado: string) {
  const map: Record<string, string> = {
    ACTIVA: 'En cola',
    ATENDIDA: 'Atendida', CANCELADA: 'Cancelada', VENCIDA: 'Vencida',
  }
  return map[estado] ?? estado
}

function formatFecha(fecha: string | null) {
  if (!fecha) return '—'

  const [y, m, d] = fecha.split('T')[0].split('-').map(Number)
  const date = new Date(y, m - 1, d)

  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function inicialUsuario(nombre: string) {
  return nombre?.charAt(0)?.toUpperCase() ?? '?'
}
</script>

<template>
  <div class="page-container space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Gestión de Reservas</h1>
        <p class="text-sm text-slate-500 mt-0.5">Cola de espera y retiros pendientes</p>
      </div>
    </div>
    <!-- ─── Stats ──────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Total</p>
        <p class="text-2xl font-bold text-slate-800">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-xl border border-indigo-200 p-4">
        <p class="text-xs text-slate-400 mb-1">En cola</p>
        <p class="text-2xl font-bold text-indigo-600">{{ stats.activas }}</p>
      </div>
      <div class="bg-white rounded-xl border border-emerald-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Listas para retiro</p>
        <p class="text-2xl font-bold text-emerald-600">{{ stats.notificadas }}</p>
      </div>
      <div class="bg-white rounded-xl border border-red-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Canceladas / Vencidas</p>
        <p class="text-2xl font-bold text-red-500">{{ stats.canceladas }}</p>
      </div>
    </div>

    <!-- ─── Filtros ────────────────────────────────────────────────────── -->
    <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 flex-wrap">

      <!-- Búsqueda -->
      <div class="relative flex-1 min-w-48">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none"
          stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input v-model="busqueda" type="text" placeholder="Buscar por usuario, libro o código..."
          class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900
                 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
      </div>

      <!-- Filtro estado -->
      <div class="flex gap-1 flex-wrap">
        <button v-for="f in [
          { v: '', l: 'Todos' },
          { v: 'ACTIVA', l: 'En cola' },
          { v: 'NOTIFICADA', l: 'Lista' },
          { v: 'ATENDIDA', l: 'Atendida' },
          { v: 'CANCELADA', l: 'Cancelada' },
          { v: 'VENCIDA', l: 'Vencida' },
        ]" :key="f.v" @click="filtroEstado = f.v as EstadoFiltro" :class="['px-3 h-9 rounded-lg text-xs font-medium transition-all border',
          filtroEstado === f.v
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600']">
          {{ f.l }}
        </button>
      </div>

      <!-- Refresh -->
      <button @click="cargar"
        class="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all"
        title="Actualizar">
        <svg class="w-4 h-4" :class="{ 'animate-spin': cargando }" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- ─── Tabla / Lista ──────────────────────────────────────────────── -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">

      <!-- Skeletons -->
      <div v-if="cargando" class="p-4 space-y-3">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <div class="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3 bg-slate-100 rounded animate-pulse w-2/5" />
            <div class="h-2.5 bg-slate-100 rounded animate-pulse w-1/3" />
          </div>
          <div class="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
          <div class="h-7 w-24 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke-width="1.5" />
          <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" />
          <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" />
        </svg>
        <p class="text-sm text-slate-500">{{ error }}</p>
        <button @click="cargar" class="text-sm text-indigo-600 hover:underline">Reintentar</button>
      </div>

      <!-- Vacío -->
      <div v-else-if="!reservasFiltradas.length" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm font-medium text-slate-500">No se encontraron reservas</p>
        <p class="text-xs text-slate-400">Prueba con otros filtros</p>
      </div>

      <!-- Lista de reservas -->
      <template v-else>
        <!-- Encabezado -->
        <div
          class="hidden sm:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 font-medium">
          <span>Usuario</span>
          <span>Libro</span>
          <!-- <span class="text-center">Prioridad</span> -->
          <span>Reservado</span>
          <span>Estado</span>
          <span class="text-right">Acciones</span>
        </div>

        <div class="divide-y divide-slate-50">
          <div v-for="r in reservasFiltradas" :key="r.idReserva"
            class="flex flex-col sm:grid sm:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
            <!-- Usuario -->
            <div class="flex items-center gap-3 min-w-0">
              <!-- <div
                class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {{ inicialUsuario(r.usuarioNombreCompleto) }}
              </div> -->
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800 truncate">{{ r.usuarioNombreCompleto }}</p>
                <p class="text-xs text-slate-400">{{ r.bibliotecaNombre }}</p>
              </div>
            </div>

            <!-- Libro -->
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-800 leading-tight line-clamp-1">{{ r.libroTitulo }}</p>
              <p v-if="r.ejemplarCodigo" class="text-xs text-slate-400 font-mono mt-0.5">
                Ej: {{ r.ejemplarCodigo }}
              </p>
              <p v-if="r.fechaVencimientoReserva" class="text-xs text-amber-600 font-medium mt-0.5">
                Vence: {{ formatFecha(r.fechaVencimientoReserva) }}
              </p>
            </div>

            <!-- Prioridad -->
            <!-- <div class="flex sm:justify-center">
              <span
                class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                {{ r.prioridad }}
              </span>
            </div> -->

            <!-- Fecha reserva -->
            <div class="text-xs text-slate-400">{{ formatFecha(r.fechaReserva) }}</div>

            <!-- Estado badge -->
            <div>
              <span :class="['inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
                colorBadge(r.estadoReserva).bg,
                colorBadge(r.estadoReserva).text,
                colorBadge(r.estadoReserva).border]">
                <span :class="['w-1.5 h-1.5 rounded-full', colorBadge(r.estadoReserva).dot]" />
                {{ labelEstado(r.estadoReserva) }}
              </span>
            </div>

            <!-- Acciones -->
            <!-- <div class="flex items-center gap-2 justify-end"> -->
            <div class="flex flex-col items-stretch gap-2">
              <!-- Registrar retiro: solo NOTIFICADA -->
              <button v-if="r.estadoReserva === 'NOTIFICADA'" @click="abrirConvertir(r)"
                class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors">
                Registrar retiro
              </button>

              <!-- Cancelar: ACTIVA o NOTIFICADA -->
              <button v-if="r.estadoReserva === 'ACTIVA' || r.estadoReserva === 'NOTIFICADA'"
                @click="cancelarReserva(r)"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 text-xs font-medium transition-colors">
                Cancelar
              </button>

              <!-- Ver préstamo: ATENDIDA -->
              <button v-if="r.estadoReserva === 'ATENDIDA' && r.prestamoId" @click="router.push('/prestamos')"
                class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 text-xs font-medium transition-colors">
                Ver préstamo
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Modal registrar retiro -->
    <ConvertirReservaModal v-if="reservaAConvertir" :reserva="reservaAConvertir" @close="reservaAConvertir = null"
      @convertida="onConvertida" />
  </div>
</template>