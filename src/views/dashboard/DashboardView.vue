<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SButton from '@/components/ui/SButton.vue'
import { BookIcon, BookmarkIcon, DocumentCheckIcon, UsersIcon, LibraryIcon, ChartIcon, PlusIcon, ReturnIcon, BoxIcon } from './icons'

import { useDashboard } from '@/composables/useDashboard'
import { formatNumber } from '@/utils/format'
import DashboardIndicators from '@/components/dashboard/DashboardIndicators.vue'
import PrestamosPorMesChart from '@/components/dashboard/charts/PrestamosPorMesChart.vue'
import PrestamosPorEstadoChart from '@/components/dashboard/charts/PrestamosPorEstadoChart.vue'
import LibrosMasPrestadosChart from '@/components/dashboard/charts/LibrosMasPrestadosChart.vue'
import PrestamosPorTipoChart from '@/components/dashboard/charts/PrestamosPorTipoChart.vue'
import PrestamosPorBibliotecaChart from '@/components/dashboard/charts/PrestamosPorBibliotecaChart.vue'
import DevolucionesPorMesChart from '@/components/dashboard/charts/DevolucionesPorMesChart.vue'
import CondicionDevolucionesChart from '@/components/dashboard/charts/CondicionDevolucionesChart.vue'

const auth = useAuthStore()
const ui = useUiStore()
const { data, loading, error, load } = useDashboard()

// El endpoint de estadísticas es solo para personal; el estudiante no lo consulta.
const isStaff = computed(() => auth.isAdmin || auth.isBibliotecario)

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Dashboard' }])
  if (isStaff.value) load()
})

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
})
const roleLabel = computed(() => auth.isAdmin ? 'Administrador' : auth.isBibliotecario ? 'Bibliotecario' : 'Estudiante')
const roleVariant = computed(() => auth.isAdmin ? 'primary' : auth.isBibliotecario ? 'info' : 'success')

const quickLinks = computed(() => {
  if (auth.isAdmin) return [
    { label: 'Gestionar usuarios', to: '/usuarios', icon: UsersIcon, desc: 'Roles y permisos' },
    { label: 'Ver bibliotecas', to: '/bibliotecas', icon: LibraryIcon, desc: 'Sedes y carreras' },
    { label: 'Reportes', to: '/reportes', icon: ChartIcon, desc: 'Métricas del sistema' },
    { label: 'Catálogo', to: '/catalogo', icon: BookIcon, desc: 'Libros y ejemplares' }
  ]
  if (auth.isBibliotecario) return [
    { label: 'Nuevo préstamo', to: '/prestamos', icon: PlusIcon, desc: 'Registrar préstamo' },
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
</script>

<template>
  <div class="page-container">
    <!-- Header -->
    <div class="mb-7 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">
          {{ greeting }}, <span class="text-indigo-600">{{ auth.user?.persona.nombre }}</span>
        </h1>
        <p class="text-slate-500 text-sm mt-1">
          <template v-if="auth.isAdmin">Panel de administración · Estadísticas de todas las bibliotecas</template>
          <template v-else-if="auth.isBibliotecario">
            Biblioteca:
            <strong class="text-slate-700">{{ data?.nombreBiblioteca ?? auth.bibliotecaNombre ?? '—' }}</strong>
          </template>
          <template v-else>Panel de estudiante · Consultas y préstamos personales</template>
        </p>
      </div>
      <SBadge :variant="roleVariant" :dot="true">{{ roleLabel }}</SBadge>
    </div>

    <!-- Error (solo staff) -->
    <SCard v-if="isStaff && error" variant="bordered" padding="md" class="mb-7" role="alert">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <p class="text-sm text-red-600">No se pudieron cargar las estadísticas. {{ error }}</p>
        <SButton size="sm" variant="secondary" @click="load">Reintentar</SButton>
      </div>
    </SCard>

    <!-- Indicadores + alerta de vencidos -->
    <template v-if="isStaff && !error">
      <DashboardIndicators :data="data" :loading="loading" class="mb-7" />

      <!-- <div
        v-if="!loading && (data?.totalPrestamosVencidos ?? 0) > 0"
        class="mb-7 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800"
        role="status"
      >
        <p class="text-sm">
          Hay <strong>{{ formatNumber(data?.totalPrestamosVencidos) }}</strong> préstamo(s) vencido(s) pendientes de devolución.
          <RouterLink to="/prestamos" class="underline font-medium ml-1">Ver préstamos</RouterLink>
        </p>
      </div> -->
    </template>

    <!-- Acceso rápido -->
    <!-- <section class="mb-7" aria-labelledby="quick-title">
      <h2 id="quick-title" class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Acceso rápido</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <RouterLink
          v-for="link in quickLinks" :key="link.to" :to="link.to"
          class="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all duration-150 group focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
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
    </section> -->

    <!-- Gráficas (solo staff) -->
    <section v-if="isStaff && !error" aria-label="Estadísticas" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2"><PrestamosPorMesChart :items="data?.prestamosPorMes ?? []" :loading="loading" /></div>
      <PrestamosPorEstadoChart :items="data?.prestamosPorEstado ?? []" :loading="loading" />

      <div class="lg:col-span-2"><LibrosMasPrestadosChart :items="data?.librosMasPrestados ?? []" :loading="loading" /></div>
      <PrestamosPorTipoChart :items="data?.prestamosPorTipo ?? []" :loading="loading" />

      <div v-if="auth.isAdmin" class="lg:col-span-3">
        <PrestamosPorBibliotecaChart :items="data?.prestamosPorBiblioteca ?? []" :loading="loading" />
      </div>

      <div class="lg:col-span-2"><DevolucionesPorMesChart :items="data?.devolucionesPorMes ?? []" :loading="loading" /></div>
      <CondicionDevolucionesChart :items="data?.condicionDevoluciones ?? []" :loading="loading" />
    </section>
  </div>
</template>