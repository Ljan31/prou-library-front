<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import api from '@/services/axios'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import { 
  BookIcon,
  ClockIcon,
  BookmarkIcon,
  ShieldIcon,
  UsersIcon,
  DocumentCheckIcon,
  LibraryIcon,
  ChartIcon,
  PlusIcon,
  ReturnIcon,
  BoxIcon
} from './icons'

const auth = useAuthStore()
const ui = useUiStore()

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Dashboard' }])
   fetchDashboard()
})


const dashboard = ref<{
  nombreBiblioteca: string
  totalLibros: number
  totalEjemplares: number
  totalPrestamosActivos: number
  totalPrestamosVencidos: number
  totalUsuarios: number
  totalReservas: number
  totalSancionesActivas: number
  totalCertificadosEmitidos: number
} | null>(null)

const loading = ref(false)
const error = ref<string | null>(null)
  const fetchDashboard = async () => {
  loading.value = true
  error.value = null

  try {
    const params = auth.isBibliotecario && auth.user?.biblioteca
      ? { bibliotecaId: auth.user.biblioteca?.[0]?.id_biblioteca }
      : undefined

    const response = await api.get('/reportes/dashboard', { params })
    dashboard.value = response.data?.data
    console.log(response)
    console.log('dashboard', dashboard.value)
  } catch (err: any) {
    console.error(err)
    error.value = err?.response?.data?.message || err.message || 'Error al cargar el dashboard'
  } finally {
    loading.value = false
  }
}

// ─── UI helpers ─────────────────────────────────────────────────────────────
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
})

const statCards = computed(() => [
  {
    label: 'Libros en catálogo',
    value: dashboard.value?.totalLibros ?? '—',
    sub: `${dashboard.value?.totalEjemplares ?? '—'} ejemplares`,
    icon: BookIcon,
    color: 'bg-indigo-50 text-indigo-600',
    ring: 'ring-indigo-100'
  },
  {
    label: 'Préstamos activos',
    value: dashboard.value?.totalPrestamosActivos ?? '—',
    sub: `${dashboard.value?.totalPrestamosVencidos ?? '—'} vencidos`,
    icon: ClockIcon,
    color: 'bg-amber-50 text-amber-600',
    ring: 'ring-amber-100',
    alert: (dashboard.value?.totalPrestamosVencidos ?? 0) > 0
  },
  {
    label: 'Reservas',
    value: dashboard.value?.totalReservas ?? '—',
    sub: 'Reservas pendientes',
    icon: BookmarkIcon,
    color: 'bg-sky-50 text-sky-600',
    ring: 'ring-sky-100'
  },
  {
    label: 'Sanciones activas',
    value: dashboard.value?.totalSancionesActivas ?? '—',
    sub: 'Usuarios sancionados',
    icon: ShieldIcon,
    color: 'bg-red-50 text-red-600',
    ring: 'ring-red-100',
    alert: (dashboard.value?.totalSancionesActivas ?? 0) > 0
  },
  ...(auth.isAdmin || auth.isBibliotecario ? [
    {
      label: 'Usuarios registrados',
      value: dashboard.value?.totalUsuarios ?? '—',
      sub: 'Cuentas activas',
      icon: UsersIcon,
      color: 'bg-emerald-50 text-emerald-600',
      ring: 'ring-emerald-100'
    },
    {
      label: 'Certificados emitidos',
      value: dashboard.value?.totalCertificadosEmitidos ?? '—',
      sub: 'Historial total',
      icon: DocumentCheckIcon,
      color: 'bg-violet-50 text-violet-600',
      ring: 'ring-violet-100'
    }
  ] : [])
])

const quickLinks = computed(() => {
  if (auth.isAdmin) return [
    { label: 'Gestionar usuarios', to: '/usuarios', icon: UsersIcon, desc: 'Roles y permisos' },
    { label: 'Ver bibliotecas', to: '/bibliotecas', icon: LibraryIcon, desc: 'Sedes y carreras' },
    { label: 'Reportes', to: '/reportes', icon: ChartIcon, desc: 'Métricas del sistema' },
    { label: 'Catálogo', to: '/catalogo', icon: BookIcon, desc: 'Libros y ejemplares' }
  ]
  if (auth.isBibliotecario) return [
    { label: 'Nuevo préstamo', to: '/prestamos/nuevo', icon: PlusIcon, desc: 'Registrar préstamo' },
    { label: 'Devoluciones', to: '/devoluciones', icon: ReturnIcon, desc: 'Procesar devolución' },
    { label: 'Inventario', to: '/inventario', icon: BoxIcon, desc: 'Gestionar ejemplares' },
    { label: 'Reportes', to: '/reportes', icon: ChartIcon, desc: 'Ver estadísticas' }
  ]
  return [
    { label: 'Explorar catálogo', to: '/catalogo', icon: BookIcon, desc: 'Buscar libros' },
    { label: 'Mis préstamos', to: '/mis-prestamos', icon: BookmarkIcon, desc: 'Historial personal' },
    { label: 'Certificado', to: '/certificados', icon: DocumentCheckIcon, desc: 'No deuda' }
  ]
})

const roleLabel = computed(() =>
  auth.isAdmin ? 'Administrador' : auth.isBibliotecario ? 'Bibliotecario' : 'Estudiante'
)
const roleVariant = computed(() =>
  auth.isAdmin ? 'primary' : auth.isBibliotecario ? 'info' : 'success'
)

// ─── Inline icon components ──────────────────────────────────────────────────
// Using functional render approach with SVG paths


// const BookIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>` }
// const ClockIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` }
// const BookmarkIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>` }
// const ShieldIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>` }
// const UsersIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` }
// const DocumentCheckIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>` }
// const LibraryIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` }
// const ChartIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>` }
// const PlusIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` }
// const ReturnIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.36"/></svg>` }
// const BoxIcon = { template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>` }
</script>

<template>
  <div class="page-container">

    <!-- Welcome header -->
    <div class="mb-7">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">
            {{ greeting }},
            <span class="text-indigo-600">{{ auth.user?.persona.nombre }}</span> 👋
          </h1>
          <p class="text-slate-500 text-sm mt-1">
            <template v-if="auth.isAdmin">Panel de administración · Acceso completo al sistema</template>
            <template v-else-if="auth.isBibliotecario">
              Biblioteca:
              <strong class="text-slate-700">{{ dashboard?.nombreBiblioteca ?? auth.bibliotecaNombre ?? '–' }}</strong>
            </template>
            <template v-else>Panel de estudiante · Consultas y préstamos personales</template>
          </p>
        </div>
        <SBadge :variant="roleVariant" :dot="true">{{ roleLabel }}</SBadge>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-7">
      <template v-if="loading">
        <SCard v-for="i in 4" :key="i" padding="lg">
          <SSkeleton width="60%" height="0.75rem" class="mb-3" />
          <SSkeleton width="40%" height="1.75rem" class="mb-2" />
          <SSkeleton width="80%" height="0.65rem" />
        </SCard>
      </template>

      <template v-else-if="error">
        <div class="col-span-full">
          <SCard variant="bordered" padding="md">
            <p class="text-sm text-red-600 flex items-center gap-2">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              No se pudieron cargar las estadísticas del dashboard.
              <button class="underline ml-1" @click=" fetchDashboard">Reintentar</button>
            </p>
          </SCard>
        </div>
      </template>

      <template v-else>
        <SCard
          v-for="(stat, i) in statCards"
          :key="i"
          padding="lg"
          class="relative overflow-hidden"
        >
          <!-- Alert indicator -->
          <span
            v-if="stat.alert"
            class="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse"
          />
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-medium text-slate-500 leading-tight">{{ stat.label }}</p>
              <p class="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{{ stat.value }}</p>
              <p class="text-xs text-slate-400 mt-1">{{ stat.sub }}</p>
            </div>
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-4"
              :class="[stat.color, stat.ring]"
            >
              <component :is="stat.icon" />
            </div>
          </div>
        </SCard>
      </template>
    </div>

    <!-- Quick access -->
    <div class="mb-7">
      <h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Acceso rápido</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <RouterLink
          v-for="link in quickLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all duration-150 group"
        >
          <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors shrink-0">
            <component :is="link.icon" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors truncate">{{ link.label }}</p>
            <p class="text-xs text-slate-400 truncate">{{ link.desc }}</p>
          </div>
        </RouterLink>
      </div>
    </div>

    <!-- Vencidos alert (solo si hay) -->
    <div
      v-if="!loading && (dashboard?.totalPrestamosVencidos ?? 0) > 0 && (auth.isAdmin || auth.isBibliotecario)"
      class="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800"
    >
      <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <p class="text-sm">
        Hay <strong>{{ dashboard?.totalPrestamosVencidos }}</strong> préstamo(s) vencido(s) pendientes de devolución.
        <RouterLink to="/prestamos" class="underline font-medium ml-1">Ver préstamos</RouterLink>
      </p>
    </div>

  </div>
</template>